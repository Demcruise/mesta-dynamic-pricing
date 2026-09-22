'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState, ErrorState, KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { Button } from '@/components/ui/button';
import { RoleGate } from '@/components/shell/RoleGate';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useRecommendations, useSkuList } from '@/lib/queries';
import { useCatalogSelectionStore, useUiStore } from '@/lib/stores';
import { useDevStore } from '@/lib/stores/dev';
import { CatalogTable } from './CatalogTable';
import { FilterBar } from './FilterBar';
import {
  applyFilters, computeKpis, EMPTY_FILTERS, parseFilters, serializeFilters, sortProducts,
  type CatalogFilters, type SortKey,
} from './filters';
import { OverrideDialog } from './OverrideDialog';

const ROW_HEIGHT = { compact: 34, comfortable: 44 } as const;
const isDev = process.env.NODE_ENV !== 'production';

export function CatalogPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const skus = useSkuList();
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
  const rows = useMemo(() => sortProducts(filtered, filters.sort, filters.dir), [filtered, filters.sort, filters.dir]);
  const kpis = useMemo(() => computeKpis(filtered, pendingSkus), [filtered, pendingSkus]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const onSort = (k: SortKey) =>
    setFilters({ ...filters, sort: k, dir: filters.sort === k && filters.dir === 'asc' ? 'desc' : 'asc' });

  const onToggleAll = () => {
    const allIn = rows.length > 0 && rows.every((r) => selected.has(r.sku));
    if (allIn) setMany(selectedIds.filter((id) => !rows.some((r) => r.sku === id)));
    else addMany(rows.map((r) => r.sku));
  };

  const loading = skus.isLoading || recs.isLoading;
  const error = skus.isError || recs.isError;

  return (
    <>
      <PageHeader
        title={t('catalog.title')}
        subtitle={t('catalog.subtitle', { count: rows.length, total: skus.data.length })}
        actions={
          <>
            <div role="group" aria-label={t('catalog.density.label')} className="flex gap-1">
              {(['comfortable', 'compact'] as const).map((d) => (
                <Button key={d} size="sm" variant={density === d ? 'primary' : 'secondary'} aria-pressed={density === d} onClick={() => setDensity(d)}>
                  {t(`catalog.density.${d}`)}
                </Button>
              ))}
            </div>
            {isDev && (
              <Button size="sm" variant="ghost" aria-pressed={failQueries} onClick={() => setFailQueries(!failQueries)}>
                {t('catalog.simulateError')}
              </Button>
            )}
          </>
        }
      />

      <section aria-label={t('common.a11y.kpi')} className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('catalog.kpi.avgMargin')} value={formatPercent(kpis.avgMargin, locale)} />
        <KpiCard label={t('catalog.kpi.belowMap')} value={kpis.belowMap} />
        <KpiCard label={t('catalog.kpi.pendingAi')} value={kpis.pendingAi} />
        <KpiCard label={t('catalog.kpi.avgGap')} value={formatPercent(kpis.avgGap, locale)} />
      </section>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onApplyQuery={(q) => router.replace(`${pathname}?${q}`, { scroll: false })}
        onClear={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort, dir: filters.dir })}
        currentQuery={serializeFilters({ ...filters, sort: 'sku', dir: 'asc' }).toString()}
      />

      {loading ? (
        <LoadingRows rowHeight={ROW_HEIGHT[density]} />
      ) : error ? (
        <ErrorState title={t('catalog.error')} onRetry={() => { skus.refetch(); recs.refetch(); }} />
      ) : rows.length === 0 ? (
        <EmptyState
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
          onSort={onSort}
          onToggle={toggle}
          onToggleAll={onToggleAll}
          onOverride={setOverrideTarget}
        />
      )}

      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label={t('catalog.action.selected', { n: selectedIds.length })}
          className="sticky bottom-16 z-20 mt-3 flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3 shadow-lg md:bottom-4"
        >
          <span className="text-sm font-medium" aria-live="polite">{t('catalog.action.selected', { n: selectedIds.length })}</span>
          <div className="flex gap-2">
            <RoleGate action="catalog.apply_strategy">
              <Link
                href="/strategy/new"
                className="inline-flex h-9 items-center rounded-input bg-brand px-3 text-sm font-medium text-brand-fg hover:opacity-90"
              >
                {t('catalog.action.applyStrategy')}
              </Link>
            </RoleGate>
            <Button variant="secondary" onClick={clearSelection}>{t('catalog.action.clearSelection')}</Button>
          </div>
        </div>
      )}

      <OverrideDialog product={overrideTarget} onClose={() => setOverrideTarget(null)} />
    </>
  );
}
