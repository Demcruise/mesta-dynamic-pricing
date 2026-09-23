'use client';

import { LayoutGrid, Table2, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { recommendationHealth } from '@/lib/actions/recommendation';
import { CATEGORIES } from '@/lib/categories';
import { useTranslation } from '@/lib/i18n';
import { useAnomalies, useScopedRecommendations, useScopedSkuSet, useSkuList } from '@/lib/queries';
import { track } from '@/lib/telemetry';
import { cn } from '@/lib/utils';
import { BulkDialog } from './BulkDialog';
import { QueueTable } from './QueueTable';
import {
  DEFAULT_QUEUE_FILTERS, filterAndSort, HIGH_IMPACT_IDR, isDefaultFilters, parseQueueFilters, serializeQueueFilters,
  tabMatches, type QueueFilters, type QueueTab,
} from './filters';
import { RecommendationCard } from './RecommendationCard';

const PAGE_SIZE = 50;

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select aria-label={label} className={`${inputCls} w-44`} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

export function QueuePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const recs = useScopedRecommendations();
  const skus = useSkuList();
  const anomaliesAll = useAnomalies();
  const scopedSkuSet = useScopedSkuSet();
  const anomalies = useMemo(
    () => ({ ...anomaliesAll, data: scopedSkuSet ? anomaliesAll.data.filter((a) => scopedSkuSet.has(a.sku)) : anomaliesAll.data }),
    [anomaliesAll, scopedSkuSet],
  );
  const [shown, setShown] = useState(PAGE_SIZE);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selBulk, setSelBulk] = useState(false);

  const query = sp.toString();
  const view = sp.get('view') === 'table' ? 'table' : 'cards';
  const setView = (v: 'cards' | 'table') => {
    const next = new URLSearchParams(query);
    if (v === 'cards') next.delete('view'); else next.set('view', v);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const filters = useMemo(() => parseQueueFilters(new URLSearchParams(query)), [query]);
  const setFilters = useCallback((f: QueueFilters) => {
    const s = serializeQueueFilters(f).toString();
    setShown(PAGE_SIZE);
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [router, pathname]);
  const patch = (p: Partial<QueueFilters>) => setFilters({ ...filters, ...p });

  // Active facets rendered as removable chips — the "query builder" read-out.
  const chips = useMemo(() => {
    const out: { key: string; label: string; remove: () => void }[] = [];
    if (filters.tab === 'all' && filters.status !== 'pending') {
      out.push({
        key: 'status',
        label: `${t('recommendations.filter.status')}: ${filters.status === 'all' ? t('recommendations.filter.all') : t(`common.status.${filters.status}`)}`,
        remove: () => patch({ status: 'pending' }),
      });
    }
    if (filters.category) out.push({ key: 'cat', label: `${t('recommendations.filter.category')}: ${filters.category}`, remove: () => patch({ category: '' }) });
    if (filters.source) out.push({ key: 'src', label: `${t('recommendations.filter.source')}: ${t(`recommendations.source.${filters.source}`)}`, remove: () => patch({ source: '' }) });
    if (filters.tier) out.push({ key: 'tier', label: `${t('recommendations.filter.confidence')}: ${t(`common.confidence.${filters.tier}`)}`, remove: () => patch({ tier: '' }) });
    if (filters.magnitude) out.push({ key: 'mag', label: `${t('recommendations.filter.magnitude')}: ${t(`recommendations.filter.mag.${filters.magnitude}`)}`, remove: () => patch({ magnitude: '' }) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, t]);

  const productMap = useMemo(() => new Map(skus.data.map((p) => [p.sku, p])), [skus.data]);
  const anomalySkus = useMemo(() => new Set(anomalies.data.map((a) => a.sku)), [anomalies.data]);
  const rows = useMemo(() => filterAndSort(recs.data, productMap, filters, anomalySkus), [recs.data, productMap, filters, anomalySkus]);
  const tabCounts = useMemo(() => {
    const tabs: QueueTab[] = ['all', 'decide', 'deploy', 'impact', 'stale', 'anomaly'];
    return tabs.map((tab) => ({ tab, n: recs.data.filter((r) => tabMatches(tab, r, anomalySkus)).length }));
  }, [recs.data, anomalySkus]);
  const pendingTotal = recs.data.filter((r) => r.status === 'pending').length;
  const allStale = rows.length > 0 && rows.every((r) => r.status === 'pending' && recommendationHealth(r).stale);
  const loading = recs.isLoading || skus.isLoading;

  return (
    <>
      <PageHeader
        title={t('recommendations.title')}
        subtitle={t('recommendations.subtitle', { count: rows.length, total: recs.data.length })}
        actions={
          <>
            <div role="group" aria-label={t('recommendations.view.label')} className="flex gap-1">
              {(['cards', 'table'] as const).map((v) => (
                <Button key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} aria-pressed={view === v} onClick={() => setView(v)}>
                  {v === 'cards' ? <LayoutGrid className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
                  {t(`recommendations.view.${v}`)}
                </Button>
              ))}
            </div>
            <RoleGate action="recommendation.decide">
              <Button onClick={() => { track('bulk_approval_dialog_opened'); setBulkOpen(true); }}>{t('recommendations.action.bulk')}</Button>
            </RoleGate>
          </>
        }
      />

      <nav aria-label={t('recommendations.tabs.label')} className="mb-3 flex flex-wrap gap-1 border-b border-line">
        {tabCounts.map(({ tab, n }) => (
          <button
            key={tab}
            type="button"
            aria-pressed={filters.tab === tab}
            title={tab === 'impact' ? t('recommendations.tabs.impactHint', { n: HIGH_IMPACT_IDR.toLocaleString() }) : undefined}
            onClick={() => patch({ tab })}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-fast',
              filters.tab === tab ? 'border-brand font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t(`recommendations.tabs.${tab}`)}
            <span className="tabular rounded-full bg-subtle px-1.5 py-px text-[11px] text-muted">{n}</span>
          </button>
        ))}
      </nav>

      <div className="mb-3 flex flex-wrap gap-2" role="search">
        {filters.tab === 'all' && (
        <Select label={t('recommendations.filter.status')} value={filters.status} onChange={(v) => patch({ status: v as QueueFilters['status'] })}>
          {(['pending', 'approved', 'rejected', 'adjusted', 'all'] as const).map((s) => (
            <option key={s} value={s}>{s === 'all' ? t('recommendations.filter.all') : t(`common.status.${s}`)}</option>
          ))}
        </Select>
        )}
        <Select label={t('recommendations.filter.category')} value={filters.category} onChange={(v) => patch({ category: v })}>
          <option value="">{t('recommendations.filter.category')}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select label={t('recommendations.filter.source')} value={filters.source} onChange={(v) => patch({ source: v as QueueFilters['source'] })}>
          <option value="">{t('recommendations.filter.source')}</option>
          {(['agent', 'simulation', 'manual'] as const).map((s) => <option key={s} value={s}>{t(`recommendations.source.${s}`)}</option>)}
        </Select>
        <Select label={t('recommendations.filter.confidence')} value={filters.tier} onChange={(v) => patch({ tier: v as QueueFilters['tier'] })}>
          <option value="">{t('recommendations.filter.confidence')}</option>
          {(['high', 'medium', 'low'] as const).map((s) => <option key={s} value={s}>{t(`common.confidence.${s}`)}</option>)}
        </Select>
        <Select label={t('recommendations.filter.magnitude')} value={filters.magnitude} onChange={(v) => patch({ magnitude: v as QueueFilters['magnitude'] })}>
          <option value="">{t('recommendations.filter.magnitude')}</option>
          {(['small', 'medium', 'large'] as const).map((s) => <option key={s} value={s}>{t(`recommendations.filter.mag.${s}`)}</option>)}
        </Select>
        <Select label={t('recommendations.filter.sort')} value={filters.sort} onChange={(v) => patch({ sort: v as QueueFilters['sort'] })}>
          {(['confidence', 'impact', 'age', 'category'] as const).map((s) => <option key={s} value={s}>{t(`recommendations.sort.${s}`)}</option>)}
        </Select>
      </div>

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={t('recommendations.filter.active')}>
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand">
              {c.label}
              <button
                type="button"
                aria-label={t('recommendations.filter.remove', { label: c.label })}
                onClick={c.remove}
                className="grid size-4 place-items-center rounded-full transition-colors duration-fast hover:bg-brand/20"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_QUEUE_FILTERS)}>{t('common.state.clearFilters')}</Button>
        </div>
      )}

      {loading ? (
        <LoadingRows rows={4} rowHeight={120} />
      ) : recs.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={recs.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant={isDefaultFilters(filters) && pendingTotal === 0 ? 'caughtUp' : 'filter'}
          title={isDefaultFilters(filters) && pendingTotal === 0 ? t('recommendations.empty.caughtUp') : t('recommendations.empty.noMatch')}
          {...(!isDefaultFilters(filters) ? { action: { label: t('common.state.clearFilters'), onClick: () => setFilters(DEFAULT_QUEUE_FILTERS) } } : {})}
        />
      ) : (
        <>
          {allStale && <p role="status" className="mb-3 rounded-input bg-warn-soft px-3 py-2 text-sm text-warn">{t('recommendations.empty.staleOnly')}</p>}
          {view === 'table' ? (
            <QueueTable
              rows={rows}
              productMap={productMap}
              sort={filters.sort}
              onSort={(sort) => patch({ sort })}
              selected={selected}
              onToggle={(id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
              onToggleAll={() => setSelected((s) => (rows.length > 0 && rows.every((r) => s.has(r.id)) ? new Set() : new Set(rows.map((r) => r.id))))}
              onOpen={(r) => router.push(`/recommendations/${r.id}`)}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {rows.slice(0, shown).map((r) => (
                  <li key={r.id} className="min-w-0"><RecommendationCard rec={r} product={productMap.get(r.sku)} showStatus={filters.tab === 'all'} /></li>
                ))}
              </ul>
              {rows.length > shown && (
                <div className="mt-4 text-center">
                  <Button variant="secondary" onClick={() => setShown(shown + PAGE_SIZE)}>{t('recommendations.action.more', { n: rows.length - shown })}</Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {view === 'table' && selected.size > 0 && (
        <div
          role="region"
          aria-label={t('recommendations.table.selectedCount', { n: selected.size })}
          className="glass sticky bottom-16 z-20 mt-3 flex items-center justify-between gap-3 rounded-card border border-line p-3 shadow-e3 md:bottom-4"
        >
          <span className="text-sm font-medium" aria-live="polite">{t('recommendations.table.selectedCount', { n: selected.size })}</span>
          <div className="flex flex-wrap gap-2">
            <RoleGate action="recommendation.decide">
              <Button size="sm" onClick={() => setSelBulk(true)}>{t('recommendations.action.bulk')}</Button>
            </RoleGate>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>{t('catalog.action.clearSelection')}</Button>
          </div>
        </div>
      )}

      <BulkDialog open={bulkOpen} onClose={() => setBulkOpen(false)} recs={rows} />
      <BulkDialog open={selBulk} onClose={() => setSelBulk(false)} recs={rows} preselected={selected} />
    </>
  );
}
