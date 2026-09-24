'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState, ErrorState, KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { useColumnVisibility } from '@/components/ds/table/DataTable';
import { Segmented } from '@/components/ui/segmented';
import { Percent, Rows3, Rows4, Scale, ShieldAlert, Sparkles } from 'lucide-react';
import { SavedViewMenu } from '@/components/ds/table/SavedViewMenu';
import { Button } from '@/components/ui/button';
import { RoleGate } from '@/components/shell/RoleGate';
import { marginPct } from '@/lib/domain';
import { formatPercent } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useRecommendations, useScopedSkuList } from '@/lib/queries';
import { useCatalogSelectionStore, useUiStore } from '@/lib/stores';
import { useDevStore } from '@/lib/stores/dev';
import { BulkActionBar } from './BulkActions';
import { CatalogTable } from './CatalogTable';
import { FilterBar } from './FilterBar';
import {
  applyFilters, BUILT_IN_PRESETS, computeKpis, EMPTY_FILTERS, parseFilters, serializeFilters, sortProducts,
  type CatalogFilters, type SortKey,
} from './filters';
import { OverrideDialog } from './OverrideDialog';
import { SkuDrawer } from './SkuDrawer';

/** Table contract identity rows (DS-002): 72px comfortable, 56px compact — must match --table-row-h-lg. */
const ROW_HEIGHT = { compact: 56, comfortable: 72 } as const;
const isDev = process.env.NODE_ENV !== 'production';

export function CatalogPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const skus = useScopedSkuList();
  const recs = useRecommendations();
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const selectedIds = useCatalogSelectionStore((s) => s.skuIds);
  const toggle = useCatalogSelectionStore((s) => s.toggle);
  const addMany = useCatalogSelectionStore((s) => s.addMany);
  const setMany = useCatalogSelectionStore((s) => s.setMany);
  const clearSelection = useCatalogSelectionStore((s) => s.clear);
  const failQueries = useDevStore((s) => s.failQueries);
  const setFailQueries = useDevStore((s) => s.setFailQueries);
  const [overrideTarget, setOverrideTarget] = useState<Product | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<Product | null>(null);
  // Category is shown under the product name and cost is secondary (TABLE-021 priority): both stay
  // available from the column menu, hidden by default so the core tracks fit a laptop viewport.
  const columnVis = useColumnVisibility('catalog', ['category', 'cost']);
  const can = useCan();

  // Filters live in the URL so KPIs, table and shared links agree.
  const query = sp.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(query)), [query]);
  const setFilters = useCallback(
    (f: CatalogFilters) => {
      const s = serializeFilters(f).toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const pendingSkus = useMemo(
    () => new Set(recs.data.filter((r) => r.status === 'pending').map((r) => r.sku)),
    [recs.data],
  );
  const filtered = useMemo(() => applyFilters(skus.data, filters), [skus.data, filters]);
  const sortLevels = useMemo(
    () => [{ key: filters.sort, dir: filters.dir }, ...(filters.sort2 ? [{ key: filters.sort2, dir: filters.dir2 }] : [])],
    [filters.sort, filters.dir, filters.sort2, filters.dir2],
  );
  const rows = useMemo(() => sortProducts(filtered, sortLevels), [filtered, sortLevels]);
  const kpis = useMemo(() => computeKpis(filtered, pendingSkus), [filtered, pendingSkus]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  /**
   * Plain click sets the primary sort (re-click flips direction). Shift/Cmd-click
   * adds or flips the secondary level — TABLE-001 multi-sort, "where relevant".
   */
  const onSort = (k: SortKey, additive = false) => {
    if (additive && k !== filters.sort) {
      if (filters.sort2 === k) setFilters({ ...filters, dir2: filters.dir2 === 'asc' ? 'desc' : 'asc' });
      else setFilters({ ...filters, sort2: k, dir2: 'asc' });
      return;
    }
    setFilters({ ...filters, sort: k, dir: filters.sort === k && filters.dir === 'asc' ? 'desc' : 'asc', sort2: filters.sort2 === k ? null : filters.sort2 });
  };

  const onToggleAll = () => {
    const allIn = rows.length > 0 && rows.every((r) => selected.has(r.sku));
    if (allIn) setMany(selectedIds.filter((id) => !rows.some((r) => r.sku === id)));
    else addMany(rows.map((r) => r.sku));
  };

  const loading = skus.isLoading || recs.isLoading;
  const error = skus.isError || recs.isError;

  const scope = t('catalog.kpi.inScope', { n: rows.length.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US') });
  return (
    <>
      <PageHeader
        title={t('catalog.title')}
        subtitle={t('catalog.subtitle', { count: rows.length, total: skus.data.length })}
        actions={
          <>
            <Segmented
              label={t('common.density.label')}
              value={density}
              onChange={setDensity}
              options={[
                { value: 'comfortable', label: t('common.density.comfortable'), icon: Rows3 },
                { value: 'compact', label: t('common.density.compact'), icon: Rows4 },
              ]}
            />
            {isDev && (
              <Button size="sm" variant="ghost" aria-pressed={failQueries} onClick={() => setFailQueries(!failQueries)}>
                {t('catalog.simulateError')}
              </Button>
            )}
          </>
        }
      />

      <section aria-label={t('common.a11y.kpi')} className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Percent} label={t('catalog.kpi.avgMargin')} value={kpis.avgMargin} format={(n) => formatPercent(n, locale)} comparison={scope} />
        <KpiCard icon={ShieldAlert} label={t('catalog.kpi.belowMap')} value={kpis.belowMap} comparison={scope} />
        <KpiCard icon={Sparkles} label={t('catalog.kpi.pendingAi')} value={kpis.pendingAi} comparison={scope} />
        <KpiCard icon={Scale} label={t('catalog.kpi.avgGap')} value={kpis.avgGap} format={(n) => formatPercent(n, locale)} comparison={scope} />
      </section>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort, dir: filters.dir })}
      />

      {loading ? (
        <LoadingRows rowHeight={ROW_HEIGHT[density]} />
      ) : error ? (
        <ErrorState title={t('catalog.error')} onRetry={() => { skus.refetch(); recs.refetch(); }} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="filter"
          title={t('catalog.empty')}
          action={{ label: t('common.state.clearFilters'), onClick: () => setFilters({ ...EMPTY_FILTERS }) }}
        />
      ) : (
        <CatalogTable
          rows={rows}
          rowHeight={ROW_HEIGHT[density]}
          selected={selected}
          pendingSkus={pendingSkus}
          sort={filters.sort}
          dir={filters.dir}
          sortLevels={filters.sort2 ? [{ key: filters.sort2, dir: filters.dir2 }] : undefined}
          onSort={onSort}
          onToggle={toggle}
          onToggleAll={onToggleAll}
          onOverride={setOverrideTarget}
          onRowClick={setDrawerTarget}
          detailQuery={query}
          visibility={columnVis}
          toolbar={
            <SavedViewMenu
              tableId="catalog"
              legacyKey="mesta-catalog-presets"
              currentQuery={serializeFilters(filters).toString()}
              hidden={[...columnVis.hidden]}
              onApply={({ query, hidden }) => {
                router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
                columnVis.setHidden(hidden);
              }}
              builtIns={BUILT_IN_PRESETS.map((p) => ({ id: p.key, label: t(`catalog.filter.${p.key}`), query: p.query }))}
            />
          }
          csv={can('catalog.export') ? {
            filename: 'mesta-catalog.csv',
            headers: ['sku', 'name', 'category', 'cost', 'price', 'minPrice', 'maxPrice', 'mapPrice', 'competitorAvg', 'marginPct', 'elasticity', 'stockUnits', 'stockStatus', 'lastChangeAt'],
            cells: (p) => [p.sku, p.name, p.category, p.cost, p.price, p.minPrice, p.maxPrice, p.mapPrice, p.competitorAvg, marginPct(p), p.elasticity, p.stockUnits, p.stockStatus, p.lastChangeAt],
          } : undefined}
        />
      )}

      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label={t('catalog.action.selected', { n: selectedIds.length })}
          className="glass sticky bottom-16 z-20 mt-3 flex items-center justify-between gap-3 rounded-card border border-line p-3 shadow-e3 md:bottom-4"
        >
          <span className="text-sm font-medium" aria-live="polite">{t('catalog.action.selected', { n: selectedIds.length })}</span>
          <div className="flex flex-wrap gap-2">
            <BulkActionBar products={rows.filter((r) => selected.has(r.sku))} onClear={clearSelection} />
            <RoleGate action="catalog.apply_strategy">
              <Link
                href="/strategy/new"
                className="inline-flex h-control-md items-center rounded-input bg-brand px-3 text-sm font-medium text-brand-fg transition-opacity duration-fast hover:opacity-90"
              >
                {t('catalog.action.applyStrategy')}
              </Link>
            </RoleGate>
            <Button variant="secondary" onClick={clearSelection}>{t('catalog.action.clearSelection')}</Button>
          </div>
        </div>
      )}

      <SkuDrawer product={drawerTarget} pendingSkus={pendingSkus} detailQuery={query} onClose={() => setDrawerTarget(null)} onOverride={setOverrideTarget} />
      <OverrideDialog product={overrideTarget} onClose={() => setOverrideTarget(null)} />
    </>
  );
}
