'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { downloadCsv, rowsToCsv, type CsvCell } from './csv';

export interface DataColumn<T> {
  id: string;
  /** Translated column label. */
  header: string;
  /** When set (and `sort` prop is provided) the header renders a sort toggle. */
  sortKey?: string;
  align?: 'left' | 'right';
  /** Cannot be hidden via the column menu (e.g. primary identifier, actions). */
  required?: boolean;
  cell: (row: T) => ReactNode;
}

export interface ColumnVisibility {
  hidden: Set<string>;
  toggle: (id: string) => void;
  setHidden: (ids: string[]) => void;
}

const colsKey = (tableId: string) => `mesta-cols-${tableId}`;

/** Per-table hidden-column state, persisted to localStorage. Pass the result to `MestaDataTable`. */
export function useColumnVisibility(tableId: string, defaultHidden: string[] = []): ColumnVisibility {
  const [hidden, setHiddenState] = useState<Set<string>>(() => new Set(defaultHidden));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(colsKey(tableId));
      if (raw) setHiddenState(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable */ }
  }, [tableId]);
  const setHidden = (ids: string[]) => {
    setHiddenState(new Set(ids));
    try { localStorage.setItem(colsKey(tableId), JSON.stringify(ids)); } catch { /* storage unavailable */ }
  };
  return {
    hidden,
    setHidden,
    toggle: (id) => {
      const next = new Set(hidden);
      if (next.has(id)) next.delete(id); else next.add(id);
      setHidden([...next]);
    },
  };
}

export interface CsvExport<T> {
  filename: string;
  headers: string[];
  cells: (row: T) => CsvCell[];
  /** Called after the download starts (telemetry, extra toasts). */
  onDone?: (rowCount: number) => void;
}

export interface MestaDataTableProps<T> {
  /** Stable id used to persist column visibility (and saved views) per table. */
  tableId: string;
  caption: string;
  columns: DataColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sort?: { key: string; dir: 'asc' | 'desc'; onSort: (key: string) => void };
  selection?: {
    selected: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: () => void;
    /** aria-label for the header + row checkboxes, e.g. "Select". */
    label: string;
  };
  /** Row click (non-interactive targets) opens a quick-view surface, e.g. a Drawer. */
  onRowClick?: (row: T) => void;
  /** Windowed rendering for large datasets. Rows keep `h-row` density otherwise. */
  virtualize?: boolean;
  rowHeight?: number;
  minWidth?: number;
  /** Adds a CSV export button to the table toolbar (caller gates by permission). */
  csv?: CsvExport<T>;
  /** Extra toolbar controls (e.g. SavedViewMenu), rendered before the column menu. */
  toolbar?: ReactNode;
  /** From `useColumnVisibility`. Omit to render all columns without the menu. */
  visibility?: ColumnVisibility;
}

const OVERSCAN = 12;

export function MestaDataTable<T>({
  tableId, caption, columns, rows, getRowId, sort, selection, onRowClick,
  virtualize = false, rowHeight = 44, minWidth = 680, csv, toolbar, visibility,
}: MestaDataTableProps<T>) {
  const { t } = useTranslation();
  const toast = useToastStore((s) => s.push);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    enabled: virtualize,
  });

  const visible = columns.filter((c) => c.required || !visibility?.hidden.has(c.id));
  const items = virtualize ? virt.getVirtualItems() : null;
  const top = items?.length ? items[0]!.start : 0;
  const bottom = items?.length ? virt.getTotalSize() - items[items.length - 1]!.end : 0;

  const allSelected = selection && rows.length > 0 && rows.every((r) => selection.selected.has(getRowId(r)));
  const someSelected = selection && !allSelected && rows.some((r) => selection.selected.has(getRowId(r)));

  const focusRow = (index: number) => {
    if (index < 0 || index >= rows.length) return;
    if (virtualize) virt.scrollToIndex(index);
    requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)?.focus());
  };

  const rowClick = (e: React.MouseEvent, row: T) => {
    if (!onRowClick) return;
    if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
    onRowClick(row);
  };

  const rowKey = (e: React.KeyboardEvent, row: T, index: number) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(index + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(index - 1); }
    else if (e.key === ' ' && selection) { e.preventDefault(); selection.onToggle(getRowId(row)); }
    else if (e.key === 'Enter' && onRowClick) { e.preventDefault(); onRowClick(row); }
  };

  const exportCsv = () => {
    if (!csv) return;
    downloadCsv(csv.filename, rowsToCsv(csv.headers, rows, csv.cells));
    csv.onDone?.(rows.length);
    toast(t('common.table.exported', { n: rows.length }));
  };

  const renderRow = (row: T, index: number) => (
    <tr
      key={getRowId(row)}
      data-row-index={index}
      tabIndex={0}
      onKeyDown={(e) => rowKey(e, row, index)}
      onClick={(e) => rowClick(e, row)}
      style={virtualize ? { height: rowHeight } : undefined}
      className={cn(
        'border-b border-line transition-colors duration-fast',
        !virtualize && 'h-row',
        selection?.selected.has(getRowId(row)) ? 'bg-selected' : 'hover:bg-subtle',
        onRowClick && 'cursor-pointer',
      )}
    >
      {selection && (
        <td className="border-b border-line px-3">
          <input
            type="checkbox"
            aria-label={`${selection.label} ${getRowId(row)}`}
            checked={selection.selected.has(getRowId(row))}
            onChange={() => selection.onToggle(getRowId(row))}
          />
        </td>
      )}
      {visible.map((c) => (
        <td
          key={c.id}
          className={cn('border-b border-line px-3', c.align === 'right' && 'text-right')}
        >
          {c.cell(row)}
        </td>
      ))}
    </tr>
  );

  return (
    <div>
      {(visibility || csv || toolbar) && (
        <div className="mb-2 flex items-center justify-end gap-1">
          {toolbar}
          {csv && (
            <button
              type="button"
              onClick={exportCsv}
              aria-label={t('common.table.exportCsv')}
              title={t('common.table.exportCsv')}
              className="grid size-9 place-items-center rounded-input text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg"
            >
              <Download className="size-4" aria-hidden />
            </button>
          )}
          {visibility && (
            <ColumnVisibilityMenu
              columns={columns.filter((c) => !c.required).map((c) => ({ id: c.id, header: c.header }))}
              hidden={visibility.hidden}
              onToggle={visibility.toggle}
            />
          )}
        </div>
      )}
      <div ref={scrollRef} className={cn('rounded-card border border-line bg-surface shadow-e1', virtualize ? 'max-h-[65vh] overflow-auto' : 'overflow-x-auto')}>
        <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-subtle">
            <tr className={virtualize ? undefined : 'h-row'}>
              {selection && (
                <th scope="col" className="w-8 border-b border-line px-3 py-row">
                  <input
                    type="checkbox"
                    aria-label={selection.label}
                    checked={allSelected ?? false}
                    ref={(el) => { if (el) el.indeterminate = someSelected ?? false; }}
                    onChange={selection.onToggleAll}
                  />
                </th>
              )}
              {visible.map((c) => {
                const active = sort !== undefined && c.sortKey === sort.key;
                const sortable = sort !== undefined && c.sortKey !== undefined;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
                    className={cn(
                      'border-b border-line px-3 py-row text-left text-xs font-medium text-muted',
                      c.align === 'right' && 'text-right',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => sort.onSort(c.sortKey!)}
                        className={cn('inline-flex items-center gap-1 transition-colors duration-fast hover:text-fg', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        {active
                          ? (sort.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)
                          : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {virtualize && top > 0 && <tr aria-hidden style={{ height: top }} />}
            {virtualize
              ? items!.map((vi) => renderRow(rows[vi.index] as T, vi.index))
              : rows.map((r, i) => renderRow(r, i))}
            {virtualize && bottom > 0 && <tr aria-hidden style={{ height: bottom }} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
