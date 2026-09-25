'use client';

import { ArrowRight, CircleSlash, CircleX, Eye, LayoutGrid, Rows3, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type MouseEvent, type ReactNode } from 'react';
import { ConstraintRange } from '@/components/ds/ConstraintRange';
import { Drawer } from '@/components/ds/Drawer';
import { Money } from '@/components/ds/numeric';
import { Pill, type PillTone } from '@/components/ds/Pill';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { useScopePath } from '@/components/shell/ScopeSelector';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Segmented } from '@/components/ui/segmented';
import { describeFormula } from '@/features/rules/rule-format';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { checkPrice, explainBounds, governingStrategy } from '@/lib/guardrails';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useRules, useScopedRecommendations, useScopedSkuList, useStrategies } from '@/lib/queries';
import { inRuleScope } from '@/lib/rules';
import { useQueryState } from '@/lib/use-query-state';
import { cn } from '@/lib/utils';
import { catalogRows, skuReport, MIN_DAYS_BETWEEN_CHANGES, type ConstraintId, type ConstraintRow, type ConstraintScope } from './report';

const CONSTRAINT_ORDER: ConstraintId[] = [
  'bounds', 'map', 'max_change', 'auto_approve', 'margin_floor', 'staleness',
  'change_frequency', 'inventory', 'approval_threshold',
  'promotion', 'regulatory', 'channel',
];

/** GUARDRAIL-005: the four operational states, in the order an operator triages them. */
type Status = 'breached' | 'enforced' | 'observed' | 'unavailable';
const STATUSES: Status[] = ['breached', 'enforced', 'observed', 'unavailable'];

function statusOf(r: ConstraintRow): Status {
  if (!r.available) return 'unavailable';
  if (r.breaches > 0) return 'breached';
  return r.enforced ? 'enforced' : 'observed';
}

/** GUARDRAIL-010: constraint types reuse the existing constraint entities, grouped by what they govern. */
type ConstraintType = 'price_limits' | 'movement' | 'approval' | 'inventory' | 'external';
const TYPE_OF: Record<ConstraintId, ConstraintType> = {
  bounds: 'price_limits', map: 'price_limits', margin_floor: 'price_limits',
  max_change: 'movement', change_frequency: 'movement', staleness: 'movement',
  auto_approve: 'approval', approval_threshold: 'approval',
  inventory: 'inventory',
  promotion: 'external', regulatory: 'external', channel: 'external',
};
const TYPES: ConstraintType[] = ['price_limits', 'movement', 'approval', 'inventory', 'external'];
const SOURCES: ConstraintScope[] = ['product', 'strategy', 'rule', 'derived', 'none'];

/** GUARDRAIL-027: status is carried by icon + text; colour is secondary. */
const STATUS_PILL: Record<Status, { tone: PillTone; icon: LucideIcon }> = {
  breached: { tone: 'critical', icon: CircleX },
  enforced: { tone: 'up', icon: ShieldCheck },
  observed: { tone: 'info', icon: Eye },
  unavailable: { tone: 'faint', icon: CircleSlash },
};

interface BreachRow {
  product: Product;
  constraint: ConstraintId;
  /** Hard breaches block pricing (critical); observed flags ride on a pending rec (warning). */
  severity: 'critical' | 'warning';
  expected: string;
  actual: string;
  recId?: string;
}

const DEFAULTS = { status: 'all', type: '', edit: '', source: '', view: 'comfortable', breach: '', inspect: '', sku: '' };

export function GuardrailsPage() {
  const { t, locale } = useTranslation();
  const products = useScopedSkuList();
  const strategies = useStrategies();
  const rules = useRules();
  const recs = useScopedRecommendations();
  const scopePath = useScopePath();
  const [q, setQ, resetQ] = useQueryState(DEFAULTS);

  const now = Date.now();
  const rows = useMemo(
    () => {
      const all = catalogRows(products.data, strategies.data, rules.data, recs.data, now);
      return CONSTRAINT_ORDER.map((id) => all.find((r) => r.id === id)).filter((r): r is ConstraintRow => r !== undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products.data, strategies.data, rules.data, recs.data],
  );

  // Secondary filters narrow the set first; status counts are computed on that set so they always
  // describe what the tabs would show.
  const secondary = rows.filter((r) =>
    (!q.type || TYPE_OF[r.id] === q.type)
    && (!q.edit || (q.edit === 'editable' ? r.config.editableBy.length > 0 : r.config.editableBy.length === 0))
    && (!q.source || r.config.scope === q.source));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, secondary.filter((r) => statusOf(r) === s).length])) as Record<Status, number>;
  const visible = q.status === 'all' ? secondary : secondary.filter((r) => statusOf(r) === q.status);
  const filtersActive = q.status !== 'all' || !!q.type || !!q.edit || !!q.source;

  // K-03 / GUARDRAIL-015: per-SKU breach rows with the bound that was expected and the value observed.
  const breachRows = useMemo(() => {
    const marginRules = rules.data.filter((r) => r.status === 'active' && r.then.kind === 'min_margin_pct');
    const pending = recs.data.filter((r) => r.status === 'pending' || r.status === 'escalated');
    const out: BreachRow[] = [];
    for (const p of products.data) {
      const s = governingStrategy(p, strategies.data);
      const check = checkPrice(p, s, p.price);
      const eb = explainBounds(p, s?.guardrail ?? null);
      if (check === 'below_min' || check === 'above_max' || check === 'exceeds_change') {
        out.push({
          product: p, constraint: 'bounds', severity: 'critical',
          expected: `${formatPrice(eb.effectiveMin, locale)} – ${formatPrice(eb.effectiveMax, locale)}`, actual: formatPrice(p.price, locale),
        });
      }
      if (check === 'map_breach') {
        out.push({ product: p, constraint: 'map', severity: 'critical', expected: `≥ ${formatPrice(p.mapPrice, locale)}`, actual: formatPrice(p.price, locale) });
      }
      const floor = marginRules.filter((r) => inRuleScope(r, p)).map((r) => r.then.value);
      const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
      if (floor.length > 0 && p.price > 0 && margin < Math.max(...floor)) {
        out.push({
          product: p, constraint: 'margin_floor', severity: 'critical',
          expected: `≥ ${formatPercent(Math.max(...floor) / 100, locale)}`, actual: formatPercent(margin / 100, locale),
        });
      }
      const pend = pending.find((r) => r.sku === p.sku);
      if (pend && (now - new Date(p.lastChangeAt).getTime()) / 86_400_000 < MIN_DAYS_BETWEEN_CHANGES) {
        const days = Math.round((now - new Date(p.lastChangeAt).getTime()) / 86_400_000);
        out.push({
          product: p, constraint: 'change_frequency', severity: 'warning', recId: pend.id,
          expected: t('guardrails.constraint.change_frequency.detail', { v: MIN_DAYS_BETWEEN_CHANGES }), actual: t('guardrails.drill.daysAgo', { n: days }),
        });
      }
      if (pend && p.stockStatus !== 'in_stock' && pend.proposedPrice > p.price) {
        out.push({
          product: p, constraint: 'inventory', severity: 'warning', recId: pend.id,
          expected: `≤ ${formatPrice(p.price, locale)}`, actual: formatPrice(pend.proposedPrice, locale),
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.data, strategies.data, rules.data, recs.data, locale]);

  const breachFilter = q.breach as ConstraintId | '';
  const filteredBreaches = breachFilter ? breachRows.filter((b) => b.constraint === breachFilter) : breachRows;
  const affectedSkus = new Set(breachRows.map((b) => b.product.sku)).size;
  const breachedConstraints = rows.filter((r) => statusOf(r) === 'breached');

  const report = useMemo(() => {
    const p = q.sku ? products.data.find((x) => x.sku === q.sku) ?? null : null;
    return p ? skuReport(p, strategies.data, rules.data, now) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.sku, products.data, strategies.data, rules.data]);
  const inspected = rows.find((r) => r.id === q.inspect) ?? null;

  const viewBreaches = (id: ConstraintId) => {
    setQ({ breach: id, inspect: '' });
    requestAnimationFrame(() => document.getElementById('guardrail-breaches')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const header = <PageHeader title={t('guardrails.page.title')} subtitle={t('guardrails.page.desc')} />;

  if (products.isLoading || strategies.isLoading || rules.isLoading) {
    return <>{header}<LoadingRows rows={4} rowHeight={90} /></>;
  }
  if (products.isError || strategies.isError || rules.isError) {
    return <>{header}<ErrorState title={t('common.state.error')} onRetry={() => { products.refetch(); strategies.refetch(); rules.refetch(); }} /></>;
  }

  const statusLabel = (r: ConstraintRow) => {
    const s = statusOf(r);
    return s === 'breached' ? t('guardrails.breached', { n: r.breaches }) : s === 'unavailable' ? t('guardrails.notModelled') : t(`guardrails.${s}`);
  };
  const modeText = (r: ConstraintRow) => {
    const s = statusOf(r);
    if (s === 'breached') return t(r.enforced ? 'guardrails.mode.breached' : 'guardrails.mode.flagged');
    return t(`guardrails.mode.${s}`);
  };
  const coverageText = (r: ConstraintRow) => r.available
    ? `${t('guardrails.covered', { n: r.covered })}${r.detail ? ` · ${t(`guardrails.constraint.${r.id}.detail`, { v: r.detail })}` : ''}`
    : t(`guardrails.constraint.${r.id}.detail`);
  const editableText = (r: ConstraintRow) => r.config.editableBy.length
    ? r.config.editableBy.map((x) => t(`common.role.${x}`)).join(', ')
    : t('guardrails.config.locked');

  const statusPill = (r: ConstraintRow) => {
    const s = STATUS_PILL[statusOf(r)];
    return <Pill tone={s.tone} icon={s.icon}>{statusLabel(r)}</Pill>;
  };

  const actionFor = (r: ConstraintRow) => r.breaches > 0 ? (
    <button type="button" onClick={() => viewBreaches(r.id)} className="inline-flex items-center gap-1.5 text-label font-semibold text-brand hover:underline">
      <span className="tabular">{t('guardrails.card.viewBreaches', { n: r.breaches })}</span><ArrowRight className="size-3.5" aria-hidden />
    </button>
  ) : (
    <button type="button" onClick={() => setQ({ inspect: r.id })} className="inline-flex items-center gap-1.5 text-label font-medium text-brand hover:underline">
      {t('guardrails.card.inspect')}<ArrowRight className="size-3.5" aria-hidden />
    </button>
  );

  const openFromCard = (e: MouseEvent, r: ConstraintRow) => {
    if ((e.target as HTMLElement).closest('a,button')) return;
    setQ({ inspect: r.id });
  };
  const clearViewFilters = () => resetQ(['status', 'type', 'edit', 'source']);

  return (
    <>
      {header}

      {/* GUARDRAIL-005/007/021 — sticky view filters, visibly separate from the global data scope. */}
      <div className="sticky top-14 z-10 -mx-4 mb-5 border-b border-divider bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-7 lg:px-7">
        <p className="mb-2 truncate text-caption text-faint">
          <span className="font-semibold uppercase tracking-wide">{t('common.scope.dataScope')}</span> · {scopePath}
        </p>
        {/* GUARDRAIL-UI-001: row 1 = status tabs (+ result count, density); row 2 = the three dropdown filters. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs
            label={t('guardrails.filter.label')}
            controls="guardrail-catalog"
            value={q.status as 'all' | Status}
            onChange={(v) => setQ({ status: v })}
            tabs={[
              { value: 'all', label: t('guardrails.filter.all'), count: secondary.length },
              ...STATUSES.map((s) => ({ value: s, label: t(`guardrails.group.${s}`), count: counts[s], icon: STATUS_PILL[s].icon })),
            ]}
          />
          <span className="flex items-center gap-3">
            <span className="tabular text-caption text-muted" aria-live="polite">{t('guardrails.filter.visible', { n: visible.length })}</span>
            <Segmented
              label={t('guardrails.filter.density')}
              value={q.view as 'comfortable' | 'compact'}
              onChange={(v) => setQ({ view: v })}
              iconOnly
              options={[
                { value: 'comfortable', label: t('guardrails.filter.comfortable'), icon: LayoutGrid },
                { value: 'compact', label: t('guardrails.filter.compact'), icon: Rows3 },
              ]}
            />
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select aria-label={t('guardrails.filter.type')} className={cn(inputCls, 'w-44')} value={q.type} onChange={(e) => setQ({ type: e.target.value })}>
            <option value="">{t('guardrails.filter.typeAll')}</option>
            {TYPES.map((x) => <option key={x} value={x}>{t(`guardrails.type.${x}`)}</option>)}
          </select>
          <select aria-label={t('guardrails.filter.edit')} className={cn(inputCls, 'w-52')} value={q.edit} onChange={(e) => setQ({ edit: e.target.value })}>
            <option value="">{t('guardrails.filter.editAll')}</option>
            <option value="editable">{t('guardrails.filter.editable')}</option>
            <option value="locked">{t('guardrails.filter.locked')}</option>
          </select>
          <select aria-label={t('guardrails.filter.source')} className={cn(inputCls, 'w-56')} value={q.source} onChange={(e) => setQ({ source: e.target.value })}>
            <option value="">{t('guardrails.filter.sourceAll')}</option>
            {SOURCES.map((x) => <option key={x} value={x}>{t(`guardrails.config.scope.${x}`)}</option>)}
          </select>
          {filtersActive && (
            <button type="button" className="px-1 text-label font-medium text-brand hover:underline" onClick={clearViewFilters}>
              {t('common.filter.clear')}
            </button>
          )}
        </div>
      </div>

      {/* GUARDRAIL-014 — the situation at a glance before scanning cards. */}
      {q.status === 'breached' && breachedConstraints.length > 0 && (
        <section aria-label={t('guardrails.summary.title')} className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryFigure value={breachedConstraints.length} label={t('guardrails.summary.constraints')} />
          <SummaryFigure value={affectedSkus} label={t('guardrails.summary.skus')} />
          {breachedConstraints.slice(0, 2).map((r) => (
            <SummaryFigure key={r.id} value={r.breaches} label={t('guardrails.summary.per', { name: t(`guardrails.constraint.${r.id}.name`) })} />
          ))}
        </section>
      )}

      <section id="guardrail-catalog" aria-label={t('guardrails.catalog.title')}>
        {visible.length === 0 ? (
          <EmptyState variant="filter" title={t('guardrails.filter.empty')} action={{ label: t('common.filter.clear'), onClick: clearViewFilters }} />
        ) : q.view === 'compact' ? (
          // GUARDRAIL-022 — compact scan mode: one row per constraint.
          <div className="mb-5 overflow-x-auto rounded-card border border-line bg-surface">
            <table className="mesta-table min-w-[760px]" style={{ tableLayout: 'fixed' }}>
              <caption className="sr-only">{t('guardrails.catalog.title')}</caption>
              <colgroup><col /><col style={{ width: 176 }} /><col style={{ width: 240 }} /><col style={{ width: 176 }} /><col style={{ width: 196 }} /></colgroup>
              <thead>
                <tr>
                  <th scope="col" className="text-left">{t('guardrails.col.constraint')}</th>
                  <th scope="col" className="text-left">{t('guardrails.col.status')}</th>
                  <th scope="col" className="text-left">{t('guardrails.col.coverage')}</th>
                  <th scope="col" className="text-left">{t('guardrails.col.updated')}</th>
                  <th scope="col" className="text-right">{t('guardrails.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="block truncate font-semibold text-fg">{t(`guardrails.constraint.${r.id}.name`)}</span>
                      <span className="block truncate text-caption text-faint">{t(`guardrails.type.${TYPE_OF[r.id]}`)}</span>
                    </td>
                    <td>{statusPill(r)}</td>
                    <td className="tabular truncate text-muted" title={coverageText(r)}>{coverageText(r)}</td>
                    <td className="tabular truncate text-muted">{r.config.lastChangedAt ? formatDate(r.config.lastChangedAt, locale) : t('guardrails.card.notTracked')}</td>
                    <td className="text-right">{actionFor(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* GUARDRAIL-001…004/019/020 — one normalised grid. Cards share the row's tracks through
             subgrid, so title, status, description, coverage, action, divider and metadata sit on
             the same baselines across siblings; auto-fill keeps the last row's cards at column width. */
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-x-5">
            {visible.map((r) => {
              const status = statusOf(r);
              return (
                <li
                  key={r.id}
                  onClick={(e) => openFromCard(e, r)}
                  className={cn(
                    'row-span-6 mb-5 grid cursor-pointer grid-rows-subgrid rounded-card border px-6 transition-colors duration-fast hover:border-line-strong',
                    status === 'unavailable' ? 'border-dashed border-line-strong bg-subtle' : 'border-line bg-surface',
                    q.inspect === r.id && 'border-brand',
                  )}
                >
                  <div className="flex items-start justify-between gap-3 pt-6">
                    <h2 className="text-section">{t(`guardrails.constraint.${r.id}.name`)}</h2>
                    {statusPill(r)}
                  </div>
                  <p className="pt-3 text-caption font-medium text-muted">{modeText(r)}</p>
                  <p className="line-clamp-3 pt-3 text-body-sm text-fg">{t(`guardrails.constraint.${r.id}.desc`)}</p>
                  <p className="tabular pt-4 text-body-sm font-semibold text-fg">{coverageText(r)}</p>
                  <div className="pb-5 pt-4">{actionFor(r)}</div>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-divider pb-6 pt-4 text-caption">
                    <dt className="text-faint">{t('guardrails.card.source')}</dt>
                    <dd className="truncate text-muted" title={r.config.sources.join(', ')}>
                      {t(`guardrails.config.scope.${r.config.scope}`)}
                      {r.config.sources.length > 0 && ` · ${r.config.sources.slice(0, 2).join(', ')}${r.config.sources.length > 2 ? ` +${r.config.sources.length - 2}` : ''}`}
                    </dd>
                    <dt className="text-faint">{t('guardrails.card.editable')}</dt>
                    <dd className="truncate text-muted">{editableText(r)}</dd>
                    <dt className="text-faint">{t('guardrails.card.updated')}</dt>
                    <dd className="tabular truncate text-muted">
                      {r.config.lastChangedAt ? formatDate(r.config.lastChangedAt, locale) : t('guardrails.card.notTracked')}
                      {r.config.approvalRequired && <> · <span className="text-warn">{t('guardrails.config.approval')}</span></>}
                    </dd>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="guardrail-breaches" className="scroll-mt-40" aria-label={t('guardrails.breaches.title')}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-section">
              {t('guardrails.breaches.title')} <span className="tabular text-muted">({filteredBreaches.length})</span>
            </h2>
            {breachFilter && (
              <p className="mt-0.5 text-caption text-muted">
                {t('guardrails.breaches.filteredBy', { name: t(`guardrails.constraint.${breachFilter}.name`) })} ·{' '}
                <button type="button" className="font-medium text-brand hover:underline" onClick={() => setQ({ breach: '' })}>
                  {t('guardrails.clearFilter', { name: t(`guardrails.constraint.${breachFilter}.name`) })}
                </button>
              </p>
            )}
          </div>
          {/* K-04 entry point: inspect any SKU, not only breached ones. */}
          <select
            aria-label={t('guardrails.drill.pick')}
            className={cn(inputCls, 'w-64')}
            value=""
            onChange={(e) => { if (e.target.value) setQ({ sku: e.target.value }); }}
          >
            <option value="">{t('guardrails.drill.pick')}</option>
            {products.data.map((p) => <option key={p.sku} value={p.sku}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        {filteredBreaches.length === 0 ? (
          <EmptyState variant="caughtUp" title={t('guardrails.breaches.none')} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="mesta-table rows-lg min-w-[1040px]" style={{ tableLayout: 'fixed' }}>
              <caption className="sr-only">{t('guardrails.breaches.caption')}</caption>
              <colgroup>
                <col /><col style={{ width: 128 }} /><col style={{ width: 176 }} /><col style={{ width: 208 }} />
                <col style={{ width: 136 }} /><col style={{ width: 120 }} /><col style={{ width: 112 }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="text-left">{t('guardrails.breaches.col.sku')}</th>
                  <th scope="col" className="text-right">{t('guardrails.breaches.col.price')}</th>
                  <th scope="col" className="text-left">{t('guardrails.breaches.col.constraint')}</th>
                  <th scope="col" className="text-right">{t('guardrails.breaches.col.expected')}</th>
                  <th scope="col" className="text-right">{t('guardrails.breaches.col.actual')}</th>
                  <th scope="col" className="text-left">{t('guardrails.breaches.col.severity')}</th>
                  <th scope="col" className="text-right"><span className="sr-only">{t('guardrails.breaches.col.action')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredBreaches.map((b) => (
                  <tr key={`${b.product.sku}-${b.constraint}`}>
                    <td><ProductIdentity product={b.product} size="sm" /></td>
                    <td className="num"><Money value={b.product.price} /></td>
                    <td>
                      <span className="block truncate text-fg">{t(`guardrails.constraint.${b.constraint}.name`)}</span>
                      {b.recId && (
                        <span className="block truncate text-caption text-faint">
                          {t('guardrails.breaches.pendingRec')}{' '}
                          <Link href={`/recommendations/${b.recId}`} className="tabular text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand">{b.recId}</Link>
                        </span>
                      )}
                    </td>
                    <td className="num text-muted">{b.expected}</td>
                    <td className={cn('num font-semibold', b.severity === 'critical' ? 'text-critical' : 'text-warn')}>{b.actual}</td>
                    <td>
                      <Pill size="sm" tone={b.severity === 'critical' ? 'critical' : 'warn'} icon={b.severity === 'critical' ? CircleX : TriangleAlert}>
                        {t(`guardrails.breaches.severity.${b.severity}`)}
                      </Pill>
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => setQ({ sku: b.product.sku })}>
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

      {/* GUARDRAIL-023 — constraint detail lives in a drawer; the catalog stays short and scannable. */}
      <Drawer open={inspected !== null} onClose={() => setQ({ inspect: '' })} title={inspected ? t(`guardrails.constraint.${inspected.id}.name`) : ''}>
        {inspected && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              {statusPill(inspected)}
              <Pill tone="neutral">{t(`guardrails.type.${TYPE_OF[inspected.id]}`)}</Pill>
            </div>
            <DrawerSection title={t('guardrails.inspect.definition')}>{t(`guardrails.constraint.${inspected.id}.desc`)}</DrawerSection>
            <DrawerSection title={t('guardrails.inspect.behavior')}>{modeText(inspected)}</DrawerSection>
            {!inspected.available && (
              <>
                <DrawerSection title={t('guardrails.inspect.why')}>{t(`guardrails.constraint.${inspected.id}.why`)}</DrawerSection>
                <DrawerSection title={t('guardrails.inspect.enable')}>{t(`guardrails.constraint.${inspected.id}.enable`)}</DrawerSection>
              </>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-divider pt-6">
              <Fact label={t('guardrails.inspect.coverage')}><span className="tabular">{coverageText(inspected)}</span></Fact>
              <Fact label={t('guardrails.inspect.breaches')}><span className={cn('tabular', inspected.breaches > 0 && 'text-critical')}>{inspected.breaches}</span></Fact>
              <Fact label={t('guardrails.inspect.source')}>{t(`guardrails.config.scope.${inspected.config.scope}`)}</Fact>
              <Fact label={t('guardrails.inspect.editability')}>{editableText(inspected)}</Fact>
              <Fact label={t('guardrails.inspect.lastChanged')}>
                <span className="tabular">{inspected.config.lastChangedAt ? formatDate(inspected.config.lastChangedAt, locale) : t('guardrails.card.notTracked')}</span>
              </Fact>
              {inspected.config.approvalRequired && <Fact label={t('guardrails.config.approval')}>{t('guardrails.inspect.gates')}</Fact>}
              {inspected.config.sources.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-caption font-medium text-muted">{t('guardrails.inspect.sources')}</dt>
                  <dd className="mt-1 text-body-sm text-fg">{inspected.config.sources.join(', ')}</dd>
                </div>
              )}
            </dl>
            {inspected.breaches > 0 && (
              <Button onClick={() => viewBreaches(inspected.id)} className="self-start">
                {t('guardrails.inspect.viewAffected')} <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        )}
      </Drawer>

      {/* K-04: SKU guardrail investigation — reuses the shared constraint visualisation (STRATEGY-023). */}
      <Drawer
        open={report !== null}
        onClose={() => setQ({ sku: '' })}
        title={report ? `${report.product.sku} · ${report.product.name}` : ''}
        href={report ? `/catalog/${report.product.sku}` : undefined}
        hrefLabel={t('guardrails.breaches.openSku')}
      >
        {report && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
              <ProductIdentity product={report.product} />
              <StatusBadge status={report.check === 'ok' ? 'healthy' : 'failed'} label={t(`guardrails.check.${report.check}`)} />
            </div>
            <ConstraintRange bounds={explainBounds(report.product, report.strategy?.guardrail ?? null)} strategyName={report.strategy?.name} compact />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-divider pt-6">
              <Fact label={t('guardrails.drill.margin')}><span className="tabular">{formatPercent(report.marginPct / 100, locale)}</span></Fact>
              <Fact label={t('guardrails.drill.headroom')}><span className="tabular">{formatPercent(report.headroomPct / 100, locale)}</span></Fact>
              <Fact label={t('guardrails.drill.lastChange')}><span className="tabular">{t('guardrails.drill.daysAgo', { n: report.daysSinceChange })}</span></Fact>
              <Fact label={t('guardrails.drill.strategy')}>
                {report.strategy ? `${report.strategy.name} (±${report.strategy.guardrail.maxChangePercent}%, ≥${report.strategy.guardrail.autoApproveThreshold})` : t('guardrails.drill.noStrategy')}
              </Fact>
            </dl>
            <DrawerSection title={t('guardrails.drill.rules')}>
              {report.rules.length === 0 ? t('guardrails.drill.noRules') : (
                <ul className="flex flex-col gap-2">
                  {report.rules.map((r) => <li key={r.id}><b className="tabular">{r.id}</b> {r.name} — {describeFormula(r.then, t)}</li>)}
                </ul>
              )}
            </DrawerSection>
          </div>
        )}
      </Drawer>
    </>
  );
}

function SummaryFigure({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-5 py-4">
      <p className="tabular text-numeric-md font-semibold text-fg">{value}</p>
      <p className="mt-0.5 truncate text-caption text-muted" title={label}>{label}</p>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-caption font-semibold uppercase tracking-wide text-faint">{title}</h3>
      <div className="mt-2 text-body-sm text-fg">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-body-sm text-fg">{children}</dd>
    </div>
  );
}
