'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/ds/Drawer';
import { PriceValue } from '@/components/ds/PriceValue';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { SeverityChip } from '@/components/ds/SeverityChip';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RecoveryNotice } from '@/components/ds/trust';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { decideOverride } from '@/lib/actions/ops';
import { deriveExceptions, type ExceptionItem, type ExceptionKind } from '@/lib/exceptions';
import { formatDate, formatPrice, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { OverrideRequest, Product, Recommendation } from '@/lib/ontology';
import { useOverrideRequests, useScopedRecommendations, useScopedSkuSet, useSkuList } from '@/lib/queries';
import { useProductCatalogStore, useSessionStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

const KINDS: ExceptionKind[] = ['breach', 'stale', 'override_request', 'missing_input', 'stale_price'];

export function ExceptionsPage() {
  const { t, locale } = useTranslation();
  const products = useSkuList();
  const recsQuery = useScopedRecommendations();
  const overrides = useOverrideRequests();
  const scoped = useScopedSkuSet();
  const competitors = useProductCatalogStore((s) => s.competitors);
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [kind, setKind] = useState<ExceptionKind | 'all'>('all');
  const [deciding, setDeciding] = useState<{ req: OverrideRequest; approve: boolean } | null>(null);
  const [inspecting, setInspecting] = useState<ExceptionItem | null>(null);
  const [note, setNote] = useState('');

  const items = useMemo(() => {
    const list = deriveExceptions({
      products: scoped ? products.data.filter((p) => scoped.has(p.sku)) : products.data,
      competitors: scoped ? competitors.filter((c) => scoped.has(c.sku)) : competitors,
      recs: recsQuery.data, overrides: overrides.data,
    });
    return kind === 'all' ? list : list.filter((x) => x.kind === kind);
  }, [products.data, competitors, recsQuery.data, overrides.data, scoped, kind]);

  const pendingRequests = useMemo(() => overrides.data.filter((r) => r.status === 'pending'), [overrides.data]);
  const history = useMemo(() => overrides.data.filter((r) => r.status !== 'pending'), [overrides.data]);
  const productsBySku = useMemo(() => new Map(products.data.map((p) => [p.sku, p])), [products.data]);
  const recsById = useMemo(() => new Map(recsQuery.data.map((r) => [r.id, r])), [recsQuery.data]);
  const overridesById = useMemo(() => new Map(overrides.data.map((o) => [o.id, o])), [overrides.data]);

  const counts = useMemo(() => {
    const m = new Map<ExceptionKind, number>();
    const all = deriveExceptions({
      products: scoped ? products.data.filter((p) => scoped.has(p.sku)) : products.data,
      competitors: scoped ? competitors.filter((c) => scoped.has(c.sku)) : competitors,
      recs: recsQuery.data, overrides: overrides.data,
    });
    for (const x of all) m.set(x.kind, (m.get(x.kind) ?? 0) + 1);
    return m;
  }, [products.data, competitors, recsQuery.data, overrides.data, scoped]);

  const decide = () => {
    if (!deciding) return;
    const r = decideOverride(user, deciding.req.id, deciding.approve ? 'approved' : 'rejected', note);
    if (r.ok) { setDeciding(null); setNote(''); }
    else toast(t(`exceptions.err.${r.error}`));
  };

  const loading = products.isLoading || recsQuery.isLoading || overrides.isLoading;
  const errored = products.isError || recsQuery.isError || overrides.isError;

  return (
    <>
      <PageHeader title={t('exceptions.page.title')} subtitle={t('exceptions.page.desc')} />
      {loading ? <LoadingRows rows={5} /> : errored ? (
        <ErrorState title={t('common.state.error')} onRetry={() => { products.refetch(); recsQuery.refetch(); overrides.refetch(); }} />
      ) : (
        <>
          <div role="group" aria-label={t('exceptions.filterLabel')} className="mb-4 flex flex-wrap gap-1">
            <Button size="sm" variant={kind === 'all' ? 'selected' : 'secondary'} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
              {t('exceptions.kind.all')}
            </Button>
            {KINDS.map((k) => (
              <Button key={k} size="sm" variant={kind === k ? 'selected' : 'secondary'} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {t(`exceptions.kind.${k}`)} <span className="tabular">({counts.get(k) ?? 0})</span>
              </Button>
            ))}
          </div>

          {items.length === 0 ? <EmptyState variant="caughtUp" title={t('exceptions.empty')} /> : (
            <ul className="flex flex-col gap-2">
              {items.map((x) => (
                <ExceptionRow key={x.id} item={x} t={t} locale={locale} product={x.sku ? productsBySku.get(x.sku) : undefined} onInspect={setInspecting} />
              ))}
            </ul>
          )}

          <section aria-label={t('exceptions.requests.title')} className="mt-8">
            <h2 className="mb-2 text-sm font-semibold">
              {t('exceptions.requests.title')} <span className="tabular text-muted">({pendingRequests.length})</span>
            </h2>
            <p className="mb-3 text-xs text-muted">{t('exceptions.requests.desc')}</p>
            {pendingRequests.length === 0 ? (
              <p className="rounded-card border border-line bg-surface p-3 text-xs text-muted shadow-e1">{t('exceptions.requests.empty')}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="rounded-card border border-line bg-surface p-3 shadow-e1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="tabular text-sm font-medium">{r.id}</span>
                      <Link href={`/catalog/${r.sku}`} className="tabular text-sm text-brand hover:underline">{r.sku}</Link>
                      <span className="tabular text-sm">→ {formatPrice(r.requestedPrice, locale)}</span>
                      <span className="text-xs text-faint">{formatDate(r.createdAt, locale)} · {r.requestedBy}</span>
                      <span className="ms-auto flex gap-1.5">
                        <RoleGate action="override.decide">
                          <Button size="sm" variant="secondary" onClick={() => { setDeciding({ req: r, approve: false }); setNote(''); }}>
                            {t('exceptions.action.reject')}
                          </Button>
                          <Button size="sm" onClick={() => { setDeciding({ req: r, approve: true }); setNote(''); }}>
                            {t('exceptions.action.approve')}
                          </Button>
                        </RoleGate>
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">“{r.reason}”</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={t('exceptions.history.title')} className="mt-8">
            <h2 className="mb-2 text-sm font-semibold">{t('exceptions.history.title')}</h2>
            {history.length === 0 ? (
              <p className="rounded-card border border-line bg-surface p-3 text-xs text-muted shadow-e1">{t('exceptions.history.empty')}</p>
            ) : (
              <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
                <table className="mesta-table w-full min-w-[640px] text-sm">
                  <caption className="sr-only">{t('exceptions.history.title')}</caption>
                  <thead className="bg-subtle text-xs text-muted">
                    <tr className="h-row">
                      {(['id', 'sku', 'price', 'status', 'decidedBy', 'at'] as const).map((c) => (
                        <th key={c} scope="col" className="px-3 py-row text-left font-medium">{t(`exceptions.history.col.${c}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id} className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                        <td className="tabular px-3 py-row">{r.id}</td>
                        <td className="px-3"><Link href={`/catalog/${r.sku}`} className="tabular text-brand hover:underline">{r.sku}</Link></td>
                        <td className="tabular px-3">{formatPrice(r.requestedPrice, locale)}</td>
                        <td className="px-3"><StatusBadge status={r.status} /></td>
                        <td className="px-3 text-muted">{r.decidedBy ?? '—'}</td>
                        <td className="tabular px-3 text-muted">{r.decidedAt ? formatDate(r.decidedAt, locale) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={deciding !== null} onClose={() => setDeciding(null)}
        title={deciding?.approve ? t('exceptions.decide.approveTitle') : t('exceptions.decide.rejectTitle')}>
        <form noValidate className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); decide(); }}>
          {deciding && (
            <p className="tabular text-sm text-muted">
              {deciding.req.id} · {deciding.req.sku} — <PriceValue value={deciding.req.requestedPrice} />
            </p>
          )}
          {deciding?.approve && (
            <RecoveryNotice>{t('exceptions.decide.approveNote')}</RecoveryNotice>
          )}
          <Field label={t('exceptions.decide.noteLabel')}>
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeciding(null)}>{t('common.action.cancel')}</Button>
            <Button type="submit">{deciding?.approve ? t('exceptions.action.approve') : t('exceptions.action.reject')}</Button>
          </div>
        </form>
      </Dialog>

      {/* O-02: investigation drawer — evidence + recovery inline, deep links when needed. */}
      <Drawer
        open={inspecting !== null}
        onClose={() => setInspecting(null)}
        title={inspecting ? `${t(`exceptions.kind.${inspecting.kind}`)}${inspecting.sku ? ` · ${inspecting.sku}` : inspecting.category ? ` · ${inspecting.category}` : ''}` : ''}
      >
        {inspecting && (
          <ExceptionDetail
            item={inspecting}
            t={t}
            locale={locale}
            product={inspecting.sku ? productsBySku.get(inspecting.sku) : undefined}
            rec={inspecting.refId ? recsById.get(inspecting.refId) : undefined}
            override={inspecting.refId ? overridesById.get(inspecting.refId) : undefined}
            onDecide={(req, approve) => { setInspecting(null); setDeciding({ req, approve }); setNote(''); }}
          />
        )}
      </Drawer>
    </>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** O-01 row anatomy: severity, kind, product identity, evidence fragment, age, investigate. */
function ExceptionRow({ item, t, locale, product, onInspect }: {
  item: ExceptionItem; t: T; locale: 'en' | 'id';
  product: Product | undefined; onInspect: (x: ExceptionItem) => void;
}) {
  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-card border border-line bg-surface p-3 shadow-e1')}>
      <SeverityChip s={item.severity} />
      <span className="text-sm font-medium">{t(`exceptions.kind.${item.kind}`)}</span>
      {product ? <ProductIdentity product={product} size="sm" /> : item.sku && <span className="tabular text-sm text-muted">{item.sku}</span>}
      {item.category && <span className="text-sm text-muted">{item.category}</span>}
      {item.count > 1 && <span className="tabular text-xs text-muted">×{item.count}</span>}
      {item.detail && <span className="tabular text-xs text-faint">{item.detail}</span>}
      <span className="tabular text-xs text-muted">{formatRelativeTime(item.at, locale)}</span>
      <Button size="sm" variant="secondary" className="ms-auto" onClick={() => onInspect(item)}>
        {t('exceptions.action.investigate')}
      </Button>
    </li>
  );
}

/** O-02/O-03: kind-specific evidence in the drawer, with recovery actions where they exist. */
function ExceptionDetail({ item, t, locale, product, rec, override, onDecide }: {
  item: ExceptionItem; t: T; locale: 'en' | 'id';
  product: Product | undefined; rec: Recommendation | undefined; override: OverrideRequest | undefined;
  onDecide: (req: OverrideRequest, approve: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-card border border-line bg-surface p-card shadow-e1">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-muted">{t('exceptions.drawer.severity')}</dt>
          <dd><SeverityChip s={item.severity} /></dd>
          <dt className="text-muted">{t('exceptions.drawer.kind')}</dt>
          <dd className="text-fg">{t(`exceptions.kind.${item.kind}`)}</dd>
          {product && (
            <>
              <dt className="text-muted">{t('exceptions.drawer.product')}</dt>
              <dd><ProductIdentity product={product} size="sm" /></dd>
            </>
          )}
          {item.category && (
            <>
              <dt className="text-muted">{t('exceptions.drawer.category')}</dt>
              <dd className="text-fg">{item.category}</dd>
            </>
          )}
          {item.detail && (
            <>
              <dt className="text-muted">{t('exceptions.drawer.detail')}</dt>
              <dd className="tabular text-fg">{item.detail}</dd>
            </>
          )}
          <dt className="text-muted">{t('exceptions.drawer.age')}</dt>
          <dd className="tabular text-fg">{formatRelativeTime(item.at, locale)}</dd>
        </dl>
      </div>

      {rec && (
        <div className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h3 className="mb-1.5 text-sm font-medium">{t('exceptions.drawer.recTitle')}</h3>
          <p className="tabular text-sm">
            {formatPrice(rec.currentPrice, locale)} → {formatPrice(rec.proposedPrice, locale)}
            <span className="text-muted"> · {t(`common.status.${rec.status}`)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {item.kind === 'breach' ? t('exceptions.drawer.breachNote') : t('exceptions.drawer.staleNote')}
          </p>
        </div>
      )}

      {override && (
        <div className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h3 className="mb-1.5 text-sm font-medium">{t('exceptions.drawer.overrideTitle')}</h3>
          <p className="tabular text-sm">→ {formatPrice(override.requestedPrice, locale)}</p>
          <p className="mt-1 text-xs text-muted">“{override.reason}” — {override.requestedBy} · {formatDate(override.createdAt, locale)}</p>
          {/* O-03: recovery without leaving the drawer. */}
          <RoleGate action="override.decide">
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => onDecide(override, true)}>{t('exceptions.action.approve')}</Button>
              <Button size="sm" variant="secondary" onClick={() => onDecide(override, false)}>{t('exceptions.action.reject')}</Button>
            </div>
          </RoleGate>
        </div>
      )}

      <Link href={item.href} className="text-sm text-brand hover:underline">{t('exceptions.drawer.openSurface')} →</Link>
    </div>
  );
}
