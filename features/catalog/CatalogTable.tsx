'use client';

import { Eye, FlaskConical, PencilLine, ScrollText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { Pill } from '@/components/ds/Pill';
import { CategoryIcon } from '@/components/ds/ProductIdentity';
import { PriceValue } from '@/components/ds/PriceValue';
import { Sparkline } from '@/components/ds/Sparkline';
import { MestaDataTable, type ColumnVisibility, type CsvExport, type DataColumn } from '@/components/ds/table/DataTable';
import { RoleGate } from '@/components/shell/RoleGate';
import { competitorGap, elasticityBand, marginHealth, marginPct } from '@/lib/domain';
import { formatDate, formatPercent, formatPrice, formatRelativeTime } from '@/lib/format';
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

const HEALTH_TEXT = { healthy: 'text-up', thin: 'text-warn', critical: 'text-down' } as const;
const HEALTH_BAR = { healthy: 'bg-up-graphic', thin: 'bg-warn', critical: 'bg-down-graphic' } as const;
const STOCK_TEXT = { in_stock: 'text-faint', low_stock: 'text-warn', out_of_stock: 'text-down' } as const;

/**
 * Two-line cell (reference "Holdings" rhythm): primary figure at 12px/semibold over an
 * 11px context line. Every data column uses it, so rows share one baseline grid and no
 * value ever wraps or clips mid-number.
 */
function Stack({ primary, secondary, align = 'left' }: { primary: ReactNode; secondary?: ReactNode; align?: 'left' | 'right' }) {
  return (
    <span className={cn('flex min-w-0 flex-col gap-0.5 whitespace-nowrap', align === 'right' ? 'items-end' : 'items-start')}>
      <span className="leading-4">{primary}</span>
      {secondary !== undefined && <span className="text-[11px] font-medium leading-4 text-faint">{secondary}</span>}
    </span>
  );
}

const iconBtn = 'grid size-7 place-items-center rounded-row text-muted transition-colors duration-fast hover:bg-surface hover:text-fg';

export function CatalogTable({
  rows, rowHeight, selected, pendingSkus, sort, dir, sortLevels, onSort, onToggle, onToggleAll, onOverride,
  onRowClick, detailQuery = '', visibility, toolbar, csv,
}: Props) {
  const { t, locale } = useTranslation();
  const can = useCan();
  const canOverride = can('catalog.override_price');
  const detailHref = (sku: string) => `/catalog/${sku}${detailQuery ? `?${detailQuery}` : ''}`;

  const columns = useMemo<DataColumn<Product>[]>(() => [
    {
      id: 'sku', defaultWidth: 104, header: t('catalog.col.sku'), sortKey: 'sku', required: true,
      cell: (p) => <Link className="tabular whitespace-nowrap font-semibold text-brand hover:underline" href={detailHref(p.sku)}>{p.sku}</Link>,
    },
    {
      id: 'name', defaultWidth: 248, header: t('catalog.col.product'), sortKey: 'name',
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-line-icon bg-icon">
            <CategoryIcon category={p.category} className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-5 text-fg" title={p.name}>{p.name}</span>
            <span className="block truncate text-[11px] font-medium leading-4 text-faint">{p.category}</span>
          </span>
        </span>
      ),
    },
    { id: 'category', defaultWidth: 128, header: t('catalog.col.category'), sortKey: 'category', cell: (p) => <span className="whitespace-nowrap text-muted">{p.category}</span> },
    {
      id: 'cost', defaultWidth: 104, header: t('catalog.col.cost'), sortKey: 'cost', align: 'right',
      cell: (p) => <PriceValue value={p.cost} muted className="whitespace-nowrap" />,
    },
    {
      id: 'price', defaultWidth: 112, header: t('catalog.col.price'), sortKey: 'price', align: 'right',
      cell: (p) => canOverride ? (
        <button
          type="button"
          onClick={() => onOverride(p)}
          title={`${t('catalog.action.override')} ${p.sku}`}
          // WCAG 2.5.3: the accessible name must contain the visible label (the price).
          aria-label={`${formatPrice(p.price, locale)} — ${t('catalog.action.override')} ${p.sku}`}
          className="-mx-1.5 whitespace-nowrap rounded-row px-1.5 py-1 font-semibold transition-colors duration-fast hover:bg-surface"
        >
          <PriceValue value={p.price} animate />
        </button>
      ) : <PriceValue value={p.price} animate className="whitespace-nowrap font-semibold" />,
    },
    {
      id: 'competitor', defaultWidth: 128, header: t('catalog.col.competitor'), sortKey: 'competitorAvg', align: 'right',
      cell: (p) => (
        <Stack align="right" primary={<PriceValue value={p.competitorAvg} />} secondary={<DeltaBadge value={competitorGap(p)} variant="text" size="sm" polarity="neutral" />} />
      ),
    },
    {
      id: 'margin', defaultWidth: 128, header: t('catalog.col.margin'), sortKey: 'margin', align: 'right',
      cell: (p) => {
        const health = marginHealth(p);
        const pct = marginPct(p);
        const fill = Math.max(0, Math.min(1, pct));
        return (
          <Stack
            align="right"
            primary={
              <span className="inline-flex items-center gap-2">
                <span
                  role="meter" aria-label={t('catalog.col.margin')} aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={Math.round(fill * 100)}
                  className="h-1.5 w-10 overflow-hidden rounded-full bg-line-strong"
                >
                  <span className={cn('block h-full rounded-full', HEALTH_BAR[health])} style={{ width: `${fill * 100}%` }} />
                </span>
                <span className="tabular font-semibold">{formatPercent(pct, locale)}</span>
              </span>
            }
            secondary={<span className={HEALTH_TEXT[health]}>{t(`catalog.health.${health}`)}</span>}
          />
        );
      },
    },
    {
      id: 'elasticity', defaultWidth: 112, header: t('catalog.col.elasticity'), sortKey: 'elasticity',
      cell: (p) => <Pill size="sm" tone="neutral">{t(`catalog.elasticity.${elasticityBand(p.elasticity)}`)}</Pill>,
    },
    {
      id: 'stock', defaultWidth: 112, header: t('catalog.col.stock'), sortKey: 'stock', align: 'right',
      cell: (p) => (
        <Stack
          align="right"
          primary={<span className="tabular font-semibold">{p.stockUnits.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')}</span>}
          secondary={<span className={STOCK_TEXT[p.stockStatus]}>{t(`catalog.stock.${p.stockStatus}`)}</span>}
        />
      ),
    },
    {
      id: 'lastChange', defaultWidth: 132, header: t('catalog.col.lastChange'), sortKey: 'lastChange',
      cell: (p) => (
        <Stack
          primary={<time dateTime={p.lastChangeAt} className="tabular text-fg">{formatDate(p.lastChangeAt, locale)}</time>}
          secondary={formatRelativeTime(p.lastChangeAt, locale)}
        />
      ),
    },
    {
      id: 'trend', defaultWidth: 104, header: t('catalog.col.trend'), align: 'right',
      cell: (p) => {
        const h = p.priceHistory.map((x) => x.price);
        const up = (h[h.length - 1] ?? 0) >= (h[0] ?? 0);
        return <span className="flex justify-end"><Sparkline points={h} tone={up ? 'up' : 'down'} className="h-6 w-[72px]" /></span>;
      },
    },
    {
      id: 'ai', defaultWidth: 128, header: t('catalog.col.ai'),
      cell: (p) => pendingSkus.has(p.sku) ? (
        <Pill size="sm" tone="agent" icon={Sparkles}>{t('catalog.ai.pending')}</Pill>
      ) : (
        <span className="text-faint" aria-label={t('catalog.ai.none')}>—</span>
      ),
    },
    {
      id: 'actions', defaultWidth: 140, header: t('catalog.col.actions'), required: true, align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          <Link href={detailHref(p.sku)} aria-label={`${t('catalog.action.view')} ${p.sku}`} title={t('catalog.action.view')} className={iconBtn}><Eye className="size-4" aria-hidden /></Link>
          <RoleGate action="simulation.use">
            <Link href={`/simulation?sku=${p.sku}`} aria-label={`${t('catalog.action.simulate')} ${p.sku}`} title={t('catalog.action.simulate')} className={iconBtn}><FlaskConical className="size-4" aria-hidden /></Link>
          </RoleGate>
          <RoleGate action="catalog.override_price">
            <button type="button" onClick={() => onOverride(p)} aria-label={`${t('catalog.action.override')} ${p.sku}`} title={t('catalog.action.override')} className={iconBtn}><PencilLine className="size-4" aria-hidden /></button>
          </RoleGate>
          <Link href={`/audit?sku=${p.sku}`} aria-label={`${t('catalog.action.audit')} ${p.sku}`} title={t('catalog.action.audit')} className={iconBtn}><ScrollText className="size-4" aria-hidden /></Link>
        </div>
      ),
    },
  ], [t, locale, canOverride, pendingSkus, onOverride, detailQuery]);

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
