'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, FlaskConical, PencilLine, ScrollText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { RoleGate } from '@/components/shell/RoleGate';
import { competitorGap, elasticityBand, marginHealth, marginPct } from '@/lib/domain';
import { formatDate, formatPercent } from '@/lib/format';
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
}

const COLS: { key: SortKey | null; label: string; align?: 'right' }[] = [
  { key: null, label: 'select' },
  { key: 'sku', label: 'sku' },
  { key: 'name', label: 'name' },
  { key: 'category', label: 'category' },
  { key: 'cost', label: 'cost', align: 'right' },
  { key: 'price', label: 'price', align: 'right' },
  { key: 'competitorAvg', label: 'competitor', align: 'right' },
  { key: 'margin', label: 'margin', align: 'right' },
  { key: 'elasticity', label: 'elasticity' },
  { key: 'stock', label: 'stock', align: 'right' },
  { key: 'lastChange', label: 'lastChange' },
  { key: null, label: 'ai' },
  { key: null, label: 'actions' },
];

const HEALTH_CLS = { healthy: 'text-up', thin: 'text-warn', critical: 'text-down' } as const;
const OVERSCAN = 12;

export function CatalogTable({
  rows, rowHeight, selected, pendingSkus, sort, dir, onSort, onToggle, onToggleAll, onOverride,
}: Props) {
  const { t, locale } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });
  const items = virt.getVirtualItems();
  const top = items.length ? (items[0] as { start: number }).start : 0;
  const bottom = items.length ? virt.getTotalSize() - (items[items.length - 1] as { end: number }).end : 0;

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.sku));
  const someSelected = !allSelected && rows.some((r) => selected.has(r.sku));

  const focusRow = (index: number) => {
    if (index < 0 || index >= rows.length) return;
    virt.scrollToIndex(index);
    requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)?.focus());
  };

  return (
    <div ref={scrollRef} className="max-h-[65vh] overflow-auto rounded-card border border-line bg-surface shadow-e1">
      <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{t('catalog.title')}</caption>
        <thead className="sticky top-0 z-10 bg-subtle">
          <tr>
            {COLS.map((c, i) => {
              const active = c.key !== null && c.key === sort;
              const label = t(`catalog.col.${c.label}`);
              return (
                <th
                  key={`${c.label}-${i}`}
                  scope="col"
                  aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : c.key ? 'none' : undefined}
                  className={cn('border-b border-line px-3 py-row text-xs font-medium text-muted', c.align === 'right' ? 'text-right' : 'text-left')}
                >
                  {c.label === 'select' ? (
                    <input
                      type="checkbox"
                      aria-label={t('catalog.col.select')}
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={onToggleAll}
                    />
                  ) : c.key ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.key as SortKey)}
                      className={cn('inline-flex items-center gap-1 transition-colors duration-fast hover:text-fg', c.align === 'right' && 'flex-row-reverse')}
                    >
                      {label}
                      {active ? (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {top > 0 && <tr aria-hidden style={{ height: top }} />}
          {items.map((vi) => {
            const p = rows[vi.index] as Product;
            const isSel = selected.has(p.sku);
            const health = marginHealth(p);
            return (
              <tr
                key={p.sku}
                data-row-index={vi.index}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(vi.index + 1); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(vi.index - 1); }
                  else if (e.key === ' ') { e.preventDefault(); onToggle(p.sku); }
                }}
                style={{ height: rowHeight }}
                className={cn('border-b border-line transition-colors duration-fast', isSel ? 'bg-selected' : 'hover:bg-subtle')}
              >
                <td className="border-b border-line px-3"><input type="checkbox" aria-label={`${t('catalog.col.select')} ${p.sku}`} checked={isSel} onChange={() => onToggle(p.sku)} /></td>
                <td className="border-b border-line px-3"><Link className="tabular text-brand hover:underline" href={`/catalog/${p.sku}`}>{p.sku}</Link></td>
                <td className="max-w-56 truncate border-b border-line px-3">{p.name}</td>
                <td className="border-b border-line px-3 text-muted">{p.category}</td>
                <td className="border-b border-line px-3 text-right"><PriceValue value={p.cost} muted /></td>
                <td className="border-b border-line px-3 text-right"><PriceValue value={p.price} /></td>
                <td className="border-b border-line px-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PriceValue value={p.competitorAvg} muted />
                    <DeltaBadge value={competitorGap(p)} />
                  </div>
                </td>
                <td className={cn('tabular border-b border-line px-3 text-right', HEALTH_CLS[health])}>
                  {formatPercent(marginPct(p), locale)} <span className="text-xs">({t(`catalog.health.${health}`)})</span>
                </td>
                <td className="border-b border-line px-3">{t(`catalog.elasticity.${elasticityBand(p.elasticity)}`)}</td>
                <td className="tabular border-b border-line px-3 text-right">
                  {p.stockUnits} <span className="text-xs text-muted">({t(`catalog.stock.${p.stockStatus}`)})</span>
                </td>
                <td className="border-b border-line px-3 text-muted">{formatDate(p.lastChangeAt, locale)}</td>
                <td className="border-b border-line px-3">
                  {pendingSkus.has(p.sku) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-agent"><Sparkles className="size-3" aria-hidden />{t('catalog.ai.pending')}</span>
                  ) : (
                    <span className="text-faint" aria-label={t('catalog.ai.none')}>—</span>
                  )}
                </td>
                <td className="border-b border-line px-3">
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
                </td>
              </tr>
            );
          })}
          {bottom > 0 && <tr aria-hidden style={{ height: bottom }} />}
        </tbody>
      </table>
    </div>
  );
}
