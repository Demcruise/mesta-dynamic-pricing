'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ds/Drawer';
import { Money, PriceMove } from '@/components/ds/numeric';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RecoveryNotice } from '@/components/ds/trust';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, inputCls } from '@/components/ui/field';
import { delegateApproval, revokeDelegation } from '@/lib/actions/ops';
import { approvalChain, expireStaleRecommendations, pendingApprovalLevel, recommendationHealth, resubmitRecommendation } from '@/lib/actions/recommendation';
import { formatDate, formatPrice, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Recommendation } from '@/lib/ontology';
import { useDelegations, useScopedRecommendations, useSkuList } from '@/lib/queries';
import { USERS, useSessionStore, useToastStore } from '@/lib/stores';
import { RecommendationCard } from '@/features/recommendations/RecommendationCard';

export function ApprovalsPage() {
  const { t, locale } = useTranslation();
  const q = useScopedRecommendations();
  const skuList = useSkuList();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [resubmitting, setResubmitting] = useState<Recommendation | null>(null);
  const [note, setNote] = useState('');
  const [inspecting, setInspecting] = useState<Recommendation | null>(null);

  // The expiry sweep is a system maintenance step — run it whenever the inbox opens.
  useEffect(() => { expireStaleRecommendations(); }, []);

  const productsBySku = useMemo(() => new Map(skuList.data.map((p) => [p.sku, p])), [skuList.data]);

  const groups = useMemo(() => ({
    // APR-003: decidable recs whose approval chain is not yet complete, by pending level.
    chain: q.data.filter((r) => (r.status === 'pending' || r.status === 'escalated') && pendingApprovalLevel(r) !== null),
    escalated: q.data.filter((r) => r.status === 'escalated'),
    changes: q.data.filter((r) => r.status === 'changes_requested'),
    expired: q.data.filter((r) => r.status === 'expired'),
  }), [q.data]);

  const total = groups.chain.length + groups.escalated.length + groups.changes.length + groups.expired.length;

  const resubmit = () => {
    if (!resubmitting) return;
    const r = resubmitRecommendation(user, resubmitting.id, note);
    if (r.ok) { setResubmitting(null); setNote(''); }
    else toast(t(`recommendations.err.${r.error}`));
  };

  return (
    <>
      <PageHeader title={t('approvals.page.title')} subtitle={t('approvals.page.desc')} />

      <RoleGate action="approval.delegate">
        <DelegationStrip t={t} locale={locale} />
      </RoleGate>

      {q.isLoading ? <LoadingRows rows={3} rowHeight={96} /> : q.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={q.refetch} />
      ) : total === 0 ? (
        <EmptyState variant="caughtUp" title={t('approvals.empty')} />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.chain.length > 0 && (
            <section aria-label={t('approvals.chain.title')}>
              <h2 className="text-section">
                {t('approvals.chain.title')} <span className="tabular text-muted">({groups.chain.length})</span>
              </h2>
              <p className="mb-4 mt-1 text-body-sm text-muted">{t('approvals.chain.desc')}</p>
              {/* N-01 condensed queue: the chain group renders rows, not full cards. */}
              <CondensedQueue recs={groups.chain} products={productsBySku} locale={locale} t={t} onInspect={setInspecting} showChain />
            </section>
          )}

          {groups.escalated.length > 0 && (
            <section aria-label={t('approvals.escalated.title')}>
              <h2 className="text-section">
                {t('approvals.escalated.title')} <span className="tabular text-muted">({groups.escalated.length})</span>
              </h2>
              <p className="mb-4 mt-1 text-body-sm text-muted">{t('approvals.escalated.desc')}</p>
              <CondensedQueue recs={groups.escalated} products={productsBySku} locale={locale} t={t} onInspect={setInspecting} />
            </section>
          )}

          {groups.changes.length > 0 && (
            <WorkflowSection title={t('approvals.changes.title')} desc={t('approvals.changes.desc')} recs={groups.changes} locale={locale}
              resubmit={(r) => { setResubmitting(r); setNote(''); }} t={t} ctaKey="approvals.action.resubmit" />
          )}

          {groups.expired.length > 0 && (
            <WorkflowSection title={t('approvals.expired.title')} desc={t('approvals.expired.desc')} recs={groups.expired} locale={locale}
              resubmit={(r) => { setResubmitting(r); setNote(''); }} t={t} ctaKey="approvals.action.reopen" extra={t('approvals.expired.note')} />
          )}
        </div>
      )}

      <Dialog open={resubmitting !== null} onClose={() => setResubmitting(null)} title={t('approvals.resubmit.title')}>
        <form noValidate className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); resubmit(); }}>
          {resubmitting && <p className="tabular text-sm text-muted">{resubmitting.id} · {resubmitting.sku} — {formatPrice(resubmitting.proposedPrice, locale)}</p>}
          {resubmitting && recommendationHealth(resubmitting).stale && (
            <RecoveryNotice>{t('approvals.resubmit.staleNote')}</RecoveryNotice>
          )}
          <Field label={t('approvals.resubmit.noteLabel')}>
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResubmitting(null)}>{t('common.action.cancel')}</Button>
            <Button type="submit">{t('approvals.action.resubmit')}</Button>
          </div>
        </form>
      </Dialog>

      {/* N-02 investigate drawer: full evidence inline without leaving the queue. */}
      <Drawer
        open={inspecting !== null}
        onClose={() => setInspecting(null)}
        title={inspecting ? `${inspecting.id} · ${inspecting.sku}` : ''}
        href={inspecting ? `/recommendations/${inspecting.id}` : undefined}
        hrefLabel={t('approvals.action.openDetail')}
      >
        {inspecting && (
          <RecommendationCard rec={inspecting} product={productsBySku.get(inspecting.sku)} variant="panel" />
        )}
      </Drawer>
    </>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * N-01 condensed approval queue — APPROVAL-001…007/025/028. Fixed column tracks shared by header
 * and rows (Recommendation 3fr · Price move · Margin impact · Awaiting · Age · Action), price move as
 * one PriceMove value, margin impact as one signed Money token (no detached minus), numeric columns
 * right-aligned on one edge, identity on two controlled lines. Age folds into the identity line
 * below xl so the medium layout keeps five readable columns.
 */
function CondensedQueue({ recs, products, locale, t, onInspect, showChain = false }: {
  recs: Recommendation[];
  products: Map<string, import('@/lib/ontology').Product>;
  locale: 'en' | 'id';
  t: T;
  onInspect: (r: Recommendation) => void;
  showChain?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="mesta-table rows-lg min-w-[880px]" style={{ tableLayout: 'fixed' }}>
        <caption className="sr-only">{t('approvals.queue.caption')}</caption>
        <colgroup>
          <col />
          <col style={{ width: 256 }} />
          <col style={{ width: 160 }} />
          {showChain && <col style={{ width: 200 }} />}
          <col className="max-xl:hidden" style={{ width: 120 }} />
          <col style={{ width: 144 }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="text-left">{t('approvals.queue.rec')}</th>
            <th scope="col" className="text-right">{t('approvals.queue.move')}</th>
            <th scope="col" className="text-right">{t('approvals.queue.impact')}</th>
            {showChain && <th scope="col" className="text-left">{t('approvals.queue.awaiting')}</th>}
            <th scope="col" className="text-left max-xl:hidden">{t('approvals.queue.age')}</th>
            <th scope="col" className="text-right"><span className="sr-only">{t('approvals.queue.investigate')}</span></th>
          </tr>
        </thead>
        <tbody>
          {recs.map((r) => {
            const level = pendingApprovalLevel(r);
            const chainLen = approvalChain(r).length;
            const product = products.get(r.sku);
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/recommendations/${r.id}`} className="tabular block font-semibold text-brand [overflow-wrap:anywhere] hover:underline">{r.id}</Link>
                  <span className="block truncate text-caption text-faint">
                    <span className="tabular whitespace-nowrap">{r.sku}</span>
                    {product && <> · {product.name}</>}
                    <span className="xl:hidden"> · {formatRelativeTime(r.createdAt, locale)}</span>
                  </span>
                </td>
                <td className="num"><PriceMove from={r.currentPrice} to={r.proposedPrice} /></td>
                <td className="num"><Money value={r.projectedMarginImpact} signed className="font-semibold" /></td>
                {showChain && (
                  <td>
                    <span className="block truncate font-medium text-fg">{t('approvals.queue.awaitingRole', { role: level ? t(`common.role.${level}`) : '—' })}</span>
                    <span className="tabular block truncate text-caption text-faint">{t('approvals.queue.levels', { done: r.approvals.length, total: chainLen })}</span>
                  </td>
                )}
                <td className="tabular whitespace-nowrap text-muted max-xl:hidden">{formatRelativeTime(r.createdAt, locale)}</td>
                <td className="text-right">
                  <Button size="sm" variant="secondary" className="min-w-28" onClick={() => onInspect(r)}>{t('approvals.action.investigate')}</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Manager's delegation strip: a live grant lets the named user approve
 * high-impact recommendations until `until`. One active grant per user.
 */
function DelegationStrip({ t, locale }: { t: T; locale: 'en' | 'id' }) {
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const grants = useDelegations();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('u-analyst-1');
  const [hours, setHours] = useState('24');
  const [err, setErr] = useState('');

  const now = Date.now();
  const active = grants.data.filter((g) => new Date(g.until).getTime() > now);
  const nameOf = (id: string) => Object.values(USERS).find((u) => u.userId === id)?.name ?? id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = delegateApproval(user, target, Number(hours));
    if (r.ok) { toast(t('approvals.delegation.toast')); setOpen(false); setErr(''); }
    else setErr(t(`approvals.err.${r.error}`));
  };

  return (
    <section aria-label={t('approvals.delegation.title')} className="mb-8 rounded-card border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('approvals.delegation.title')}</h2>
          <p className="mt-0.5 text-xs text-muted">{t('approvals.delegation.desc')}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{t('approvals.delegation.grant')}</Button>
      </div>
      {active.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-1.5">
          {active.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-input bg-subtle px-3 py-2 text-xs">
              <span className="font-medium">{nameOf(g.toUserId)}</span>
              <span className="tabular text-muted">{formatRelativeTime(g.until, locale)}</span>
              <Button size="sm" variant="ghost" className="ms-auto" onClick={() => {
                const r = revokeDelegation(user, g.id);
                if (!r.ok) toast(t(`approvals.err.${r.error}`));
              }}>{t('approvals.delegation.revoke')}</Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={t('approvals.delegation.dialogTitle')}>
        <form noValidate className="flex flex-col gap-3" onSubmit={submit}>
          <Field label={t('approvals.delegation.to')}>
            {(p) => (
              <select {...p} value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
                {Object.values(USERS).filter((u) => u.userId !== user.userId).map((u) => (
                  <option key={u.userId} value={u.userId}>{u.name} · {u.userId}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('approvals.delegation.hours')}>
            {(p) => <Input {...p} type="number" min="1" max="168" step="1" className="tabular w-28" value={hours} onChange={(e) => setHours(e.target.value)} />}
          </Field>
          <RecoveryNotice>{t('approvals.delegation.note')}</RecoveryNotice>
          {err && <p role="alert" className="text-xs text-critical">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.action.cancel')}</Button>
            <Button type="submit">{t('approvals.delegation.grant')}</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}

function WorkflowSection({ title, desc, recs, locale, resubmit, t, ctaKey, extra }: {
  title: string; desc: string; recs: Recommendation[]; locale: 'en' | 'id';
  resubmit: (r: Recommendation) => void; t: T; ctaKey: string; extra?: string;
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-section">{title} <span className="tabular text-muted">({recs.length})</span></h2>
      <p className="mb-4 mt-1 text-body-sm text-muted">{desc}</p>
      {extra && <RecoveryNotice className="mb-2">{extra}</RecoveryNotice>}
      <ul className="grid grid-cols-1 gap-2">
        {recs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-card border border-line bg-surface px-5 py-4">
            <StatusBadge status={r.status} />
            <Link href={`/recommendations/${r.id}`} className="tabular text-sm font-medium text-brand hover:underline">{r.id}</Link>
            <span className="tabular text-sm">{r.sku}</span>
            <PriceMove from={r.currentPrice} to={r.proposedPrice} align="start" className="text-sm" />
            <span className="text-xs text-faint">{formatDate(r.createdAt, locale)}</span>
            {r.decisionNote && <span className="w-full text-xs text-muted">“{r.decisionNote}”</span>}
            <span className="ms-auto"><Button size="sm" variant="secondary" onClick={() => resubmit(r)}>{t(ctaKey)}</Button></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
