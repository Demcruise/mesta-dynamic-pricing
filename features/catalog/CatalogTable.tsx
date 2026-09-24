'use client';

import { Eye, FlaskConical, PencilLine, ScrollText } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { CellStack } from '@/components/ds/numeric';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { PriceValue } from '@/components/ds/PriceValue';
import {
  SkuActions, SkuElasticity, SkuId, SkuLastChange, SkuMargin, SkuRecommendationBadge, SkuStock, SkuTrend, type SkuAction,
} from '@/components/ds/sku';
import { MestaDataTable, type ColumnVisibility, type CsvExport, type DataColumn } from '@/components/ds/table/DataTable';
import { competitorGap } from '@/lib/domain';
import { formatPrice } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import type { SortKey } from './filters';

interface Props {
  rows: Product[];
  rowHeight: number;
  selected: Set<string>;
  pendingSkus: Set<string>;
  sort: SortKey;
  dir: 'asc' | 'desc';
  /** TABLE-001 secondary sort levels (beyond the primary key/dir). */
  sortLevels?: { key: SortKey; dir: 'asc' | 'desc' }[];
  onSort: (k: SortKey, additive?: boolean) => void;
  onToggle: (sku: string) => void;
  onToggleAll: () => void;
  onOverride: (p: Product) => void;
  onRowClick?: (p: Product) => void;
  /** Serialized catalog filters appended to detail links so the SKU page can offer prev/next in context. */
  detailQuery?: string;
  visibility?: ColumnVisibility;
  toolbar?: ReactNode;
  csv?: CsvExport<Product>;
}

export const CATALOG_COLUMNS = [
  'sku', 'name', 'category', 'cost', 'price', 'competitor', 'margin', 'elasticity', 'stock', 'lastChange', 'trend', 'ai', 'actions',
] as const;

/**
 * SKU catalogue (backlog v11 TABLE-001…022). One deterministic column model — every track has a
 * fixed default width except Product, which absorbs the remaining space — rendered by the shared
 * MestaDataTable as one continuous surface (72px identity rows, 56 compact). Cells come from the
 * shared SKU family in components/ds/sku.tsx so other surfaces render SKUs identically.
 */
export function CatalogTable({
  rows, rowHeight, selected, pendingSkus, sort, dir, sortLevels, onSort, onToggle, onToggleAll, onOverride,
  onRowClick, detailQuery = '', visibility, toolbar, csv,
}: Props) {
  const { t, locale } = useTranslation();
  const can = useCan();
  const canOverride = can('catalog.override_price');
  const canSimulate = can('simulation.use');
  const detailHref = (sku: string) => `/catalog/${sku}${detailQuery ? `?${detailQuery}` : ''}`;

  const columns = useMemo<DataColumn<Product>[]>(() => [
    {
      id: 'sku', defaultWidth: 104, header: t('catalog.col.sku'), sortKey: 'sku', required: true,
      cell: (p) => <SkuId sku={p.sku} href={detailHref(p.sku)} />,
    },
    {
      id: 'name', defaultWidth: 268, header: t('catalog.col.product'), sortKey: 'name',
      cell: (p) => <ProductIdentity product={p} size="lg" showSku={false} />,
    },
    { id: 'category', defaultWidth: 140, header: t('catalog.col.category'), sortKey: 'category', cell: (p) => <span className="block truncate text-muted" title={p.category}>{p.category}</span> },
    {
      id: 'cost', defaultWidth: 112, header: t('catalog.col.cost'), sortKey: 'cost', align: 'right',
      cell: (p) => <PriceValue value={p.cost} muted className="whitespace-nowrap" />,
    },
    {
      id: 'price', defaultWidth: 116, header: t('catalog.col.price'), sortKey: 'price', align: 'right',
      cell: (p) => canOverride ? (
        <button
          type="button"
          onClick={() => onOverride(p)}
          title={`${t('catalog.action.override')} ${p.sku}`}
          // WCAG 2.5.3: the accessible name must contain the visible label (the price).
          aria-label={`${formatPrice(p.price, locale)} — ${t('catalog.action.override')} ${p.sku}`}
          className="whitespace-nowrap rounded-row font-semibold underline-offset-4 transition-colors duration-fast hover:text-brand hover:underline"
        >
          <PriceValue value={p.price} animate className="text-inherit" />
        </button>
      ) : <PriceValue value={p.price} animate className="whitespace-nowrap font-semibold" />,
    },
    {
      id: 'competitor', defaultWidth: 128, header: t('catalog.col.competitor'), sortKey: 'competitorAvg', align: 'right',
      cell: (p) => (
        <CellStack align="right" primary={<PriceValue value={p.competitorAvg} />} secondary={<DeltaBadge value={competitorGap(p)} variant="text" size="sm" polarity="neutral" />} />
      ),
    },
    { id: 'margin', defaultWidth: 124, header: t('catalog.col.margin'), sortKey: 'margin', align: 'right', cell: (p) => <SkuMargin product={p} /> },
    { id: 'elasticity', defaultWidth: 116, header: t('catalog.col.elasticity'), sortKey: 'elasticity', cell: (p) => <SkuElasticity elasticity={p.elasticity} /> },
    { id: 'stock', defaultWidth: 104, header: t('catalog.col.stock'), sortKey: 'stock', align: 'right', cell: (p) => <SkuStock product={p} /> },
    { id: 'lastChange', defaultWidth: 176, header: t('catalog.col.lastChange'), sortKey: 'lastChange', cell: (p) => <SkuLastChange at={p.lastChangeAt} /> },
    {
      id: 'trend', defaultWidth: 112, header: t('catalog.col.trend'), align: 'center',
      cell: (p) => <SkuTrend points={p.priceHistory.map((x) => x.price)} />,
    },
    {
      id: 'ai', defaultWidth: 148, header: t('catalog.col.ai'),
      cell: (p) => <SkuRecommendationBadge label={pendingSkus.has(p.sku) ? t('catalog.ai.pending') : undefined} emptyLabel={t('catalog.ai.none')} />,
    },
    {
      id: 'actions', defaultWidth: 184, header: t('catalog.col.actions'), required: true, align: 'right',
      cell: (p) => {
        const actions: SkuAction[] = [
          { id: 'view', label: t('catalog.action.view'), icon: Eye, href: detailHref(p.sku) },
          ...(canSimulate ? [{ id: 'simulate', label: t('catalog.action.simulate'), icon: FlaskConical, href: `/simulation?sku=${p.sku}` }] : []),
          ...(canOverride ? [{ id: 'override', label: t('catalog.action.override'), icon: PencilLine, onSelect: () => onOverride(p) }] : []),
          { id: 'audit', label: t('catalog.action.audit'), icon: ScrollText, href: `/audit?sku=${p.sku}` },
        ];
        return <SkuActions actions={actions} subject={p.sku} moreLabel={t('common.table.moreActions')} />;
      },
    },
  ], [t, locale, canOverride, canSimulate, pendingSkus, onOverride, detailQuery]);

  return (
    <MestaDataTable
      tableId="catalog"
      caption={t('catalog.title')}
      columns={columns}
      rows={rows}
      getRowId={(p) => p.sku}
      sort={{ key: sort, dir, ...(sortLevels ? { levels: sortLevels } : {}), onSort: (k, additive) => onSort(k as SortKey, additive) }}
      selection={{ selected, onToggle, onToggleAll, label: t('catalog.col.select') }}
      onRowClick={onRowClick}
      virtualize
      rowSize="lg"
      rowHeight={rowHeight}
      minWidth={1440}
      resizable
      stickyFirst
      csv={csv}
      toolbar={toolbar}
      visibility={visibility}
    />
  );
}
