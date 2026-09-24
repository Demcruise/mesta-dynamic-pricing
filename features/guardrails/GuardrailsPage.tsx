'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/ds/Drawer';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { checkPrice, governingStrategy } from '@/lib/guardrails';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useRules, useScopedRecommendations, useScopedSkuList, useStrategies } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { inRuleScope } from '@/lib/rules';
import { describeFormula } from '@/features/rules/rule-format';
import { catalogRows, skuReport, MIN_DAYS_BETWEEN_CHANGES, type ConstraintId, type ConstraintRow } from './report';
import { pillCls } from '@/components/ds/Pill';

const CONSTRAINT_ORDER: ConstraintId[] = [
  'bounds', 'map', 'max_change', 'auto_approve', 'margin_floor', 'staleness',
  'change_frequency', 'inventory', 'approval_threshold',
  'promotion', 'regulatory', 'channel',
];

/** K-01: cards grouped by state — breaches lead, then enforced, observed, and the honest "not modelled". */
type GroupKey = 'breached' | 'enforced' | 'observed' | 'unavailable';
const GROUP_ORDER: GroupKey[] = ['breached', 'enforced', 'observed', 'unavailable'];

function groupOf(r: ConstraintRow): GroupKey {
  if (!r.available) return 'unavailable';
  if (r.breaches > 0) return 'breached';
  return r.enforced ? 'enforced' : 'observed';
}

interface BreachRow {
  product: Product;
  constraint: ConstraintId;
  /** checkPrice code for hard breaches; 'flag' for observed-only violations tied to a pending rec. */
  detail: string;
  recId?: string;
}

export function GuardrailsPage() {
  const { t, locale } = useTranslation();
  const products = useScopedSkuList();
  const strategies = useStrategies();
  const rules = useRules();
  const recs = useScopedRecommendations();
  const [constraintFilter, setConstraintFilter] = useState<ConstraintId | ''>('');
  const [drawerSku, setDrawerSku] = useState<string | null>(null);

  const now = Date.now();
  const rows = useMemo(
    () => catalogRows(products.data, strategies.data, rules.data, recs.data, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products.data, strategies.data, rules.data, recs.data],
  );

  const grouped = useMemo(() => {
    const m = new Map<GroupKey, ConstraintRow[]>(GROUP_ORDER.map((g) => [g, []]));
    for (const id of CONSTRAINT_ORDER) {
      const r = rows.find((x) => x.id === id);
      if (r) m.get(groupOf(r))!.push(r);
    }
    return m;
  }, [rows]);

  // K-03: per-SKU breach rows — hard price violations plus observed-only pending-rec flags.
  const breachRows = useMemo(() => {
    const marginRules = rules.data.filter((r) => r.status === 'active' && r.then.kind === 'min_margin_pct');
    const pending = recs.data.filter((r) => r.status === 'pending' || r.status === 'escalated');
    const out: BreachRow[] = [];
    for (const p of products.data) {
      const s = governingStrategy(p, strategies.data);
      const check = checkPrice(p, s, p.price);
      if (check === 'below_min' || check === 'above_max' || check === 'exceeds_change') {
        out.push({ product: p, constraint: 'bounds', detail: check });
      }
      if (check === 'map_breach') out.push({ product: p, constraint: 'map', detail: check });
      const floor = marginRules.filter((r) => inRuleScope(r, p)).map((r) => r.then.value);
      if (floor.length > 0 && p.price > 0 && ((p.price - p.cost) / p.price) * 100 < Math.max(...floor)) {
        out.push({ product: p, constraint: 'margin_floor', detail: `floor:${Math.max(...floor)}%` });
      }
      const pend = pending.find((r) => r.sku === p.sku);
      if (pend && (now - new Date(p.lastChangeAt).getTime()) / 86_400_000 < MIN_DAYS_BETWEEN_CHANGES) {
        out.push({ product: p, constraint: 'change_frequency', detail: 'flag', recId: pend.id });
      }
      if (pend && p.stockStatus !== 'in_stock' && pend.proposedPrice > p.price) {
        out.push({ product: p, constraint: 'inventory', detail: 'flag', recId: pend.id });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.data, strategies.data, rules.data, recs.data]);

  const filteredBreaches = useMemo(
    () => (constraintFilter ? breachRows.filter((b) => b.constraint === constraintFilter) : breachRows),
    [breachRows, constraintFilter],
  );

  const report = useMemo(() => {
    const p = drawerSku ? products.data.find((x) => x.sku === drawerSku) ?? null : null;
    return p ? skuReport(p, strategies.data, rules.data, now) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerSku, products.data, strategies.data, rules.data]);

  if (products.isLoading || strategies.isLoading || rules.isLoading) return <LoadingRows rows={4} rowHeight={90} />;
  if (products.isError || strategies.isError || rules.isError) {
    return <ErrorState title={t('common.state.error')} onRetry={() => { products.refetch(); strategies.refetch(); rules.refetch(); }} />;
  }

  return (
    <>
      <PageHeader title={t('guardrails.page.title')} subtitle={t('guardrails.page.desc')} />

      <section aria-label={t('guardrails.catalog.title')}>
        <h2 className="mb-2 text-sm font-semibold">{t('guardrails.catalog.title')}</h2>
        {GROUP_ORDER.map((g) => {
          const cards = grouped.get(g) ?? [];
          if (cards.length === 0) return null;
          return (
            <div key={g} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                {t(`guardrails.group.${g}`)} <span className="tabular">({cards.length})</span>
              </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((r) => {
                  const clickable = r.available && r.breaches > 0;
                  const active = constraintFilter === r.id;
                  const body = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium">{t(`guardrails.constraint.${r.id}.name`)}</h4>
                        <StatusBadge
                          status={!r.available ? 'info' : r.breaches > 0 ? 'failed' : r.enforced ? 'active' : 'info'}
                          label={!r.available ? t('guardrails.notModelled') : r.breaches > 0 ? t('guardrails.breached', { n: r.breaches }) : t(r.enforced ? 'guardrails.enforced' : 'guardrails.observed')}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted">{t(`guardrails.constraint.${r.id}.desc`)}</p>
                      <p className="mt-2 text-xs text-fg">
                        {r.available
                          ? <>{t('guardrails.covered', { n: r.covered })}{r.detail ? ` · ${t(`guardrails.constraint.${r.id}.detail`, { v: r.detail })}` : ''}</>
                          : t(`guardrails.constraint.${r.id}.detail`)}
                      </p>
                      {clickable && <p className="mt-1 text-xs text-brand">{t(active ? 'guardrails.filterOn' : 'guardrails.filterHint')}</p>}
                      {/* GR-005: configuration provenance — scope, sources, last change, who can change it. */}
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-line pt-2 text-[11px] text-muted">
                        <span>{t(`guardrails.config.scope.${r.config.scope}`)}</span>
                        {r.config.sources.length > 0 && (
                          <span>· {r.config.sources.slice(0, 2).join(', ')}{r.config.sources.length > 2 ? ` +${r.config.sources.length - 2}` : ''}</span>
                        )}
                        {r.config.lastChangedAt && <span>· {t('guardrails.config.changed', { at: formatDate(r.config.lastChangedAt, locale) })}</span>}
                        {r.config.approvalRequired && (
                          <span className={pillCls('warn', 'sm')}>{t('guardrails.config.approval')}</span>
                        )}
                        <span>
                          · {r.config.editableBy.length
                            ? t('guardrails.config.editable', { roles: r.config.editableBy.map((x) => t(`common.role.${x}`)).join(', ') })
                            : t('guardrails.config.locked')}
                        </span>
                      </p>
                    </>
                  );
                  return (
                    <li key={r.id}>
                      {clickable ? (
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setConstraintFilter(active ? '' : r.id)}
                          className={cn(
                            'h-full w-full rounded-card border p-card text-left shadow-e1 transition-colors duration-fast',
                            active ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-strong',
                          )}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className={cn('h-full rounded-card border p-card shadow-e1', r.available ? 'border-line bg-surface' : 'border-dashed border-line bg-subtle')}>
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="mt-6" aria-label={t('guardrails.breaches.title')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {t('guardrails.breaches.title')} <span className="tabular text-muted">({filteredBreaches.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {constraintFilter && (
              <button type="button" className="text-xs text-brand hover:underline" onClick={() => setConstraintFilter('')}>
                {t('guardrails.clearFilter', { name: t(`guardrails.constraint.${constraintFilter}.name`) })}
              </button>
            )}
            {/* K-04 entry point: inspect any SKU, not only breached ones. */}
            <select
              aria-label={t('guardrails.drill.pick')}
              className={cn(inputCls, 'w-56')}
              value=""
              onChange={(e) => { if (e.target.value) setDrawerSku(e.target.value); }}
            >
              <option value="">{t('guardrails.drill.pick')}</option>
              {products.data.map((p) => <option key={p.sku} value={p.sku}>{p.sku} — {p.name}</option>)}
            </select>
          </div>
        </div>
        {filteredBreaches.length === 0 ? (
          <EmptyState variant="caughtUp" title={t('guardrails.breaches.none')} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
            <table className="mesta-table w-full min-w-[560px] text-sm">
              <caption className="sr-only">{t('guardrails.breaches.caption')}</caption>
              <thead className="bg-subtle text-xs text-muted">
                <tr className="h-row">
                  <th scope="col" className="px-3 py-row text-left font-medium">{t('guardrails.breaches.col.sku')}</th>
                  <th scope="col" className="px-3 py-row text-left font-medium">{t('guardrails.breaches.col.constraint')}</th>
                  <th scope="col" className="px-3 py-row text-right font-medium">{t('guardrails.breaches.col.price')}</th>
                  <th scope="col" className="px-3 py-row text-left font-medium">{t('guardrails.breaches.col.detail')}</th>
                  <th scope="col" className="px-3 py-row text-right font-medium"><span className="sr-only">{t('guardrails.breaches.col.action')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredBreaches.map((b) => (
                  <tr key={`${b.product.sku}-${b.constraint}`} className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                    <td className="px-3 py-row"><ProductIdentity product={b.product} size="sm" /></td>
                    <td className="px-3">{t(`guardrails.constraint.${b.constraint}.name`)}</td>
                    <td className="tabular px-3 text-right">{formatPrice(b.product.price, locale)}</td>
                    <td className="px-3 text-xs text-muted">
                      {b.detail === 'flag'
                        ? <>{t('guardrails.breaches.flagged')} {b.recId && <Link href={`/recommendations/${b.recId}`} className="tabular text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand">{b.recId}</Link>}</>
                        : b.detail.startsWith('floor:')
                          ? t('guardrails.breaches.floorDetail', { v: b.detail.slice(6) })
                          : t(`guardrails.check.${b.detail}`)}
                    </td>
                    <td className="px-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setDrawerSku(b.product.sku)}>
                        {t('guardrails.breaches.inspect')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* K-04: SKU guardrail investigation lives in a drawer — opened from the breach table or the picker. */}
      <Drawer
        open={report !== null}
        onClose={() => setDrawerSku(null)}
        title={report ? `${report.product.sku} · ${report.product.name}` : ''}
      >
        {report && (
          <div className="flex flex-col gap-3">
            <div className="rounded-card border border-line bg-surface p-card shadow-e1">
              <h3 className="text-sm font-medium"><ProductIdentity product={report.product} /></h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted">{t('guardrails.drill.current')}</dt>
                <dd className="text-fg">{formatPrice(report.product.price, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.rawBounds')}</dt>
                <dd className="text-fg">{formatPrice(report.product.minPrice, locale)} – {formatPrice(report.product.maxPrice, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.effectiveBounds')}</dt>
                <dd className="text-fg">{formatPrice(report.bounds.min, locale)} – {formatPrice(report.bounds.max, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.map')}</dt>
                <dd className="text-fg">{report.bounds.mapEnforced ? formatPrice(report.product.mapPrice, locale) : t('guardrails.drill.mapOff')}</dd>
                <dt className="text-muted">{t('guardrails.drill.margin')}</dt>
                <dd className="text-fg">{formatPercent(report.marginPct / 100, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.headroom')}</dt>
                <dd className="text-fg">{formatPercent(report.headroomPct / 100, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.lastChange')}</dt>
                <dd className="text-fg">{t('guardrails.drill.daysAgo', { n: report.daysSinceChange })}</dd>
                <dt className="text-muted">{t('guardrails.drill.check')}</dt>
                <dd><StatusBadge status={report.check === 'ok' ? 'healthy' : 'failed'} label={t(`guardrails.check.${report.check}`)} /></dd>
              </dl>
            </div>
            <div className="rounded-card border border-line bg-surface p-card shadow-e1">
              <h3 className="text-sm font-medium">{t('guardrails.drill.governedBy')}</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">{t('guardrails.drill.strategy')}</dt>
                  <dd className="text-fg">{report.strategy ? `${report.strategy.name} (±${report.strategy.guardrail.maxChangePercent}%, ≥${report.strategy.guardrail.autoApproveThreshold})` : t('guardrails.drill.noStrategy')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">{t('guardrails.drill.rules')}</dt>
                  <dd className="min-w-0 flex-1 text-fg">
                    {report.rules.length === 0 ? t('guardrails.drill.noRules') : (
                      <ul className="space-y-1">
                        {report.rules.map((r) => <li key={r.id}><b>{r.id}</b> {r.name} — {describeFormula(r.then, t)}</li>)}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            <Link href={`/catalog/${report.product.sku}`} className="text-sm text-brand hover:underline">
              {t('guardrails.breaches.openSku')} →
            </Link>
          </div>
        )}
      </Drawer>
    </>
  );
}
