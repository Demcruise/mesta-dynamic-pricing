'use client';

import { Eye, FlaskConical, PencilLine, ScrollText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { Sparkline } from '@/components/ds/Sparkline';
import { MestaDataTable, type ColumnVisibility, type CsvExport, type DataColumn } from '@/components/ds/table/DataTable';
import { RoleGate } from '@/components/shell/RoleGate';
import { competitorGap, elasticityBand, marginHealth, marginPct } from '@/lib/domain';
import { formatDate, formatPercent } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { cn } from '@/lib/utils';
import type { SortKey } from './filters';

interface Props {
  rows: Product[];
  rowHeight: number;
  selected: Set<string>;
  pendingSkus: Set<string>;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  onToggle: (sku: string) => void;
  onToggleAll: () => void;
  onOverride: (p: Product) => void;
  onRowClick?: (p: Product) => void;
  visibility?: ColumnVisibility;
  toolbar?: ReactNode;
  csv?: CsvExport<Product>;
}

export const CATALOG_COLUMNS = [
  'sku', 'name', 'category', 'cost', 'price', 'competitor', 'margin', 'elasticity', 'stock', 'lastChange', 'trend', 'ai', 'actions',
] as const;

const HEALTH_CLS = { healthy: 'text-up', thin: 'text-warn', critical: 'text-down' } as const;
const HEALTH_BAR = { healthy: 'bg-up', thin: 'bg-warn', critical: 'bg-down' } as const;

export function CatalogTable({
  rows, rowHeight, selected, pendingSkus, sort, dir, onSort, onToggle, onToggleAll, onOverride,
  onRowClick, visibility, toolbar, csv,
}: Props) {
  const { t, locale } = useTranslation();
  const can = useCan();
  const canOverride = can('catalog.override_price');

  const columns = useMemo<DataColumn<Product>[]>(() => [
    {
      id: 'sku', header: t('catalog.col.sku'), sortKey: 'sku', required: true,
      cell: (p) => <Link className="tabular text-brand hover:underline" href={`/catalog/${p.sku}`}>{p.sku}</Link>,
    },
    { id: 'name', header: t('catalog.col.name'), sortKey: 'name', cell: (p) => <span className="block max-w-56 truncate">{p.name}</span> },
    { id: 'category', header: t('catalog.col.category'), sortKey: 'category', cell: (p) => <span className="text-muted">{p.category}</span> },
    { id: 'cost', header: t('catalog.col.cost'), sortKey: 'cost', align: 'right', cell: (p) => <PriceValue value={p.cost} muted /> },
    {
      id: 'price', header: t('catalog.col.price'), sortKey: 'price', align: 'right',
      cell: (p) => canOverride ? (
        <button
          type="button"
          onClick={() => onOverride(p)}
          title={`${t('catalog.action.override')} ${p.sku}`}
          aria-label={`${t('catalog.action.override')} ${p.sku}`}
          className="-mx-1 rounded px-1 transition-colors duration-fast hover:bg-subtle"
        >
          <PriceValue value={p.price} />
        </button>
      ) : <PriceValue value={p.price} />,
    },
    {
      id: 'competitor', header: t('catalog.col.competitor'), sortKey: 'competitorAvg', align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-2">
          <PriceValue value={p.competitorAvg} muted />
          <DeltaBadge value={competitorGap(p)} />
        </div>
      ),
    },
    {
      id: 'margin', header: t('catalog.col.margin'), sortKey: 'margin', align: 'right',
      cell: (p) => {
        const health = marginHealth(p);
        const pct = marginPct(p);
        return (
          <div className="flex flex-col items-end gap-1">
            <span className={cn('tabular', HEALTH_CLS[health])}>
              {formatPercent(pct, locale)} <span className="text-xs">({t(`catalog.health.${health}`)})</span>
            </span>
            <div
              role="meter" aria-label={t('catalog.col.margin')} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(Math.max(0, Math.min(1, pct)) * 100)}
              className="h-1 w-16 overflow-hidden rounded-full bg-subtle"
            >
              <div className={cn('h-full rounded-full', HEALTH_BAR[health])} style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
            </div>
          </div>
        );
      },
    },
    { id: 'elasticity', header: t('catalog.col.elasticity'), sortKey: 'elasticity', cell: (p) => t(`catalog.elasticity.${elasticityBand(p.elasticity)}`) },
    {
      id: 'stock', header: t('catalog.col.stock'), sortKey: 'stock', align: 'right',
      cell: (p) => <span className="tabular">{p.stockUnits} <span className="text-xs text-muted">({t(`catalog.stock.${p.stockStatus}`)})</span></span>,
    },
    { id: 'lastChange', header: t('catalog.col.lastChange'), sortKey: 'lastChange', cell: (p) => <span className="text-muted">{formatDate(p.lastChangeAt, locale)}</span> },
    { id: 'trend', header: t('catalog.col.trend'), cell: (p) => <Sparkline points={p.priceHistory.map((h) => h.price)} className="h-5 w-20 text-faint" /> },
    {
      id: 'ai', header: t('catalog.col.ai'),
      cell: (p) => pendingSkus.has(p.sku) ? (
        <span className="inline-flex items-center gap-1 text-xs text-agent"><Sparkles className="size-3" aria-hidden />{t('catalog.ai.pending')}</span>
      ) : (
        <span className="text-faint" aria-label={t('catalog.ai.none')}>—</span>
      ),
    },
    {
      id: 'actions', header: t('catalog.col.actions'), required: true,
      cell: (p) => (
        <div className="flex items-center gap-1">
          <Link href={`/catalog/${p.sku}`} aria-label={`${t('catalog.action.view')} ${p.sku}`} title={t('catalog.action.view')} className="grid size-7 place-items-center rounded transition-colors duration-fast hover:bg-subtle"><Eye className="size-4" aria-hidden /></Link>
          <RoleGate action="simulation.use">
            <Link href={`/simulation?sku=${p.sku}`} aria-label={`${t('catalog.action.simulate')} ${p.sku}`} title={t('catalog.action.simulate')} className="grid size-7 place-items-center rounded transition-colors duration-fast hover:bg-subtle"><FlaskConical className="size-4" aria-hidden /></Link>
          </RoleGate>
          <RoleGate action="catalog.override_price">
            <button type="button" onClick={() => onOverride(p)} aria-label={`${t('catalog.action.override')} ${p.sku}`} title={t('catalog.action.override')} className="grid size-7 place-items-center rounded transition-colors duration-fast hover:bg-subtle"><PencilLine className="size-4" aria-hidden /></button>
          </RoleGate>
          <Link href={`/audit?sku=${p.sku}`} aria-label={`${t('catalog.action.audit')} ${p.sku}`} title={t('catalog.action.audit')} className="grid size-7 place-items-center rounded transition-colors duration-fast hover:bg-subtle"><ScrollText className="size-4" aria-hidden /></Link>
        </div>
      ),
    },
  ], [t, locale, canOverride, pendingSkus, onOverride]);

  return (
    <MestaDataTable
      tableId="catalog"
      caption={t('catalog.title')}
      columns={columns}
      rows={rows}
      getRowId={(p) => p.sku}
      sort={{ key: sort, dir, onSort: (k) => onSort(k as SortKey) }}
      selection={{ selected, onToggle, onToggleAll, label: t('catalog.col.select') }}
      onRowClick={onRowClick}
      virtualize
      rowHeight={rowHeight}
      minWidth={1280}
      csv={csv}
      toolbar={toolbar}
      visibility={visibility}
    />
  );
}
