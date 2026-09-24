'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { MetricDefinition } from '@/components/ds/trust';
import { inputCls } from '@/components/ui/field';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { downloadCsv, rowsToCsv, type CsvCell } from './csv';

export interface DataColumn<T> {
  id: string;
  /** Translated column label. */
  header: string;
  /** Optional definition shown via the glossary popover next to the header (S-03). */
  headerHint?: string;
  /** When set (and `sort` prop is provided) the header renders a sort toggle. */
  sortKey?: string;
  /** Numeric/currency columns are right-aligned (TABLE-002); trends and checkboxes centre. */
  align?: 'left' | 'right' | 'center';
  /**
   * Fixed track width in px (TABLE-001). When any column sets one the table switches to a fixed
   * layout driven by a shared <colgroup>, so header and every row hold identical boundaries; columns
   * without a width share the remaining space (the flexible "Product"/"Recommendation" track).
   */
  width?: number;
  /** Cannot be hidden via the column menu (e.g. primary identifier, actions). */
  required?: boolean;
  /** Default pixel width used until the user resizes (resizable tables only). */
  defaultWidth?: number;
  cell: (row: T) => ReactNode;
}

/** A toolbar-selectable row grouping. Rows are stably re-sorted by `value` when active. */
export interface TableGroupOption<T> {
  id: string;
  /** Translated option label. */
  label: string;
  /** Group key for a row. */
  value: (row: T) => string;
  /** Optional display formatter for the group key in the group header row. */
  format?: (value: string) => string;
}

export interface ColumnVisibility {
  hidden: Set<string>;
  toggle: (id: string) => void;
  setHidden: (ids: string[]) => void;
}

const colsKey = (tableId: string) => `mesta-cols-${tableId}`;
const widthsKey = (tableId: string) => `mesta-colw-${tableId}`;
const groupKey = (tableId: string) => `mesta-group-${tableId}`;

const MIN_COL_W = 64;
const MAX_COL_W = 600;
const FALLBACK_COL_W = 160;

const clampWidth = (w: number) => Math.min(MAX_COL_W, Math.max(MIN_COL_W, Math.round(w)));

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
  sort?: {
    key: string;
    dir: 'asc' | 'desc';
    /** Reports a header click. `additive` is true when Shift/Cmd was held (TABLE-001 multi-sort). */
    onSort: (key: string, additive?: boolean) => void;
    /** Secondary levels after the primary, rendered as priority badges in the header. */
    levels?: { key: string; dir: 'asc' | 'desc' }[];
  };
  selection?: {
    selected: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: () => void;
    /** aria-label for the header + row checkboxes, e.g. "Select". */
    label: string;
  };
  /** Row click (non-interactive targets) opens a quick-view surface, e.g. a Drawer. */
  onRowClick?: (row: T) => void;
  /** Windowed rendering for large datasets. */
  virtualize?: boolean;
  /**
   * Row size from the table contract (DS-002): `md` = 56px (44 compact) for single/two-line cells,
   * `lg` = 72px (56 compact) for identity rows with an icon + name + meta.
   */
  rowSize?: 'md' | 'lg';
  /** Pixel row height the virtualizer uses — must match `rowSize` at the active density. */
  rowHeight?: number;
  minWidth?: number;
  /** Adds a CSV export button to the table toolbar (caller gates by permission). */
  csv?: CsvExport<T>;
  /** Extra toolbar controls (e.g. SavedViewMenu), rendered before the column menu. */
  toolbar?: ReactNode;
  /** From `useColumnVisibility`. Omit to render all columns without the menu. */
  visibility?: ColumnVisibility;
  /** Draggable + keyboard column resize, widths persisted per `tableId`. Switches the table to fixed layout. */
  resizable?: boolean;
  /** Pins the first visible column while the rest scrolls horizontally (TABLE-001). */
  stickyFirst?: boolean;
  /** Row grouping options surfaced as a toolbar select. Ignored when `virtualize` is set. */
  groups?: TableGroupOption<T>[];
}

const OVERSCAN = 12;

/**
 * Cell chrome shared by every header and body cell: the table contract inset (16px, 12 compact)
 * and a 1px divider. The table is one continuous surface — no floating row cards (VIS-001).
 */
const cellBase = 'px-cell align-middle border-b border-divider';
const alignCls = (a: 'left' | 'right' | 'center' | undefined) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : undefined);
const checkboxCls = 'size-4 cursor-pointer rounded accent-brand';
const SELECT_COL_W = 48;

export function MestaDataTable<T>({
  tableId, caption, columns, rows, getRowId, sort, selection, onRowClick,
  virtualize = false, rowSize = 'md', rowHeight = 56, minWidth = 680, csv, toolbar, visibility,
  resizable = false, stickyFirst = false, groups,
}: MestaDataTableProps<T>) {
  const { t } = useTranslation();
  const toast = useToastStore((s) => s.push);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startW: number } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(widthsKey(tableId));
      if (raw) setWidths(JSON.parse(raw) as Record<string, number>);
      const g = localStorage.getItem(groupKey(tableId));
      if (g) setGroupId(g);
    } catch { /* storage unavailable */ }
  }, [tableId]);

  const setColWidth = (id: string, w: number | undefined) => {
    setWidths((prev) => {
      const next = { ...prev };
      if (w === undefined) delete next[id]; else next[id] = clampWidth(w);
      try { localStorage.setItem(widthsKey(tableId), JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };

  const chooseGroup = (id: string) => {
    setGroupId(id);
    try { localStorage.setItem(groupKey(tableId), id); } catch { /* storage unavailable */ }
  };

  const activeGroup = groups?.find((g) => g.id === groupId);
  const groupingOn = activeGroup !== undefined && !virtualize;
  const displayRows = useMemo(() => {
    if (!groupingOn) return rows;
    return [...rows].sort((a, b) => {
      const av = activeGroup.value(a);
      const bv = activeGroup.value(b);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
  }, [rows, groupingOn, activeGroup]);
  const groupCounts = useMemo(() => {
    if (!groupingOn) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const r of displayRows) {
      const k = activeGroup.value(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [displayRows, groupingOn, activeGroup]);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    enabled: virtualize,
  });

  const visible = columns.filter((c) => c.required || !visibility?.hidden.has(c.id));
  // Deterministic column model (TABLE-001): any fixed track → fixed layout with a shared colgroup.
  const fixedTracks = resizable || visible.some((c) => c.width !== undefined);
  const trackWidth = (c: DataColumn<T>) => (resizable ? widths[c.id] ?? c.defaultWidth ?? c.width ?? FALLBACK_COL_W : c.width);
  const firstColId = stickyFirst ? visible[0]?.id : undefined;
  // Multi-sort priority: primary key plus any secondary levels.
  const sortLevels = sort ? [{ key: sort.key, dir: sort.dir }, ...(sort.levels ?? [])] : [];
  const levelOf = (key: string | undefined) => (key === undefined ? -1 : sortLevels.findIndex((l) => l.key === key));
  const dirOf = (key: string | undefined) => sortLevels.find((l) => l.key === key)?.dir;
  const items = virtualize ? virt.getVirtualItems() : null;
  const top = items?.length ? items[0]!.start : 0;
  const bottom = items?.length ? virt.getTotalSize() - items[items.length - 1]!.end : 0;

  const allSelected = selection && rows.length > 0 && rows.every((r) => selection.selected.has(getRowId(r)));
  const someSelected = selection && !allSelected && rows.some((r) => selection.selected.has(getRowId(r)));

  const focusRow = (index: number) => {
    if (index < 0 || index >= displayRows.length) return;
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
      aria-selected={selection ? selection.selected.has(getRowId(row)) : undefined}
      className={cn(
        // Cells paint the fill so pinned cells occlude scrolled content; one divider per row.
        'group/row outline-none [&>td]:transition-colors [&>td]:duration-fast focus-visible:[&>td]:bg-brand-soft [&:last-child>td]:border-b-0',
        !virtualize && (rowSize === 'lg' ? 'h-table-row-lg' : 'h-table-row'),
        selection?.selected.has(getRowId(row))
          ? '[&>td]:bg-selected'
          : '[&>td]:bg-surface hover:[&>td]:bg-subtle',
        onRowClick && 'cursor-pointer',
      )}
    >
      {selection && (
        <td className={cn(cellBase, 'text-center')}>
          <input
            type="checkbox"
            className={checkboxCls}
            aria-label={`${selection.label} ${getRowId(row)}`}
            checked={selection.selected.has(getRowId(row))}
            onChange={() => selection.onToggle(getRowId(row))}
          />
        </td>
      )}
      {visible.map((c) => (
        <td
          key={c.id}
          className={cn(
            cellBase,
            'py-cell-y',
            alignCls(c.align),
            // Fixed tracks never let content widen a column; overflow truncates inside the cell (TABLE-022).
            fixedTracks && 'overflow-hidden',
            // Pinned cell keeps its fill so it occludes scrolled content; hairline edge on the right.
            stickyFirst && c.id === firstColId && 'sticky left-0 z-[5] shadow-pin-edge',
          )}
        >
          {c.cell(row)}
        </td>
      ))}
    </tr>
  );

  const groupHeaderRow = (key: string) => (
    <tr key={`group-${key}`}>
      <td colSpan={visible.length + (selection ? 1 : 0)} className="h-9 border-b border-divider bg-subtle px-cell text-xs font-semibold tracking-label text-muted">
        {activeGroup!.format ? activeGroup!.format(key) : key} <span className="tabular text-faint">· {groupCounts.get(key) ?? 0}</span>
      </td>
    </tr>
  );

  return (
    <div>
      {(visibility || csv || toolbar || (groups && groups.length > 0)) && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {toolbar}
          {groups && groups.length > 0 && !virtualize && (
            <select
              aria-label={t('common.table.groupBy')}
              className={cn(inputCls, 'w-44')}
              value={groupId}
              onChange={(e) => chooseGroup(e.target.value)}
            >
              <option value="">{`${t('common.table.groupBy')}: ${t('common.table.groupNone')}`}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{`${t('common.table.groupBy')}: ${g.label}`}</option>)}
            </select>
          )}
          {csv && (
            <button
              type="button"
              onClick={exportCsv}
              aria-label={t('common.table.exportCsv')}
              title={t('common.table.exportCsv')}
              className="grid size-control-md place-items-center rounded-input border border-line-strong bg-input text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg"
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
      {/* One framed surface: header band, 1px row dividers; the scrollbar gutter is reserved so
          columns never shift when a scrollbar appears (MON-018). */}
      <div ref={scrollRef} className={cn('rounded-card border border-line bg-surface', virtualize ? 'table-scroll max-h-[70vh]' : 'overflow-x-auto')}>
        <table
          className="tabular w-full border-separate border-spacing-0 text-[13px] font-medium text-fg"
          style={{ minWidth, tableLayout: fixedTracks ? 'fixed' : undefined }}
        >
          <caption className="sr-only">{caption}</caption>
          {fixedTracks && (
            <colgroup>
              {selection && <col style={{ width: SELECT_COL_W }} />}
              {visible.map((c) => <col key={c.id} style={{ width: trackWidth(c) }} />)}
            </colgroup>
          )}
          <thead className="sticky top-0 z-10">
            <tr className="h-table-head">
              {selection && (
                <th scope="col" className={cn(cellBase, 'bg-head text-center')} style={fixedTracks ? undefined : { width: SELECT_COL_W }}>
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    aria-label={selection.label}
                    checked={allSelected ?? false}
                    ref={(el) => { if (el) el.indeterminate = someSelected ?? false; }}
                    onChange={selection.onToggleAll}
                  />
                </th>
              )}
              {visible.map((c) => {
                const level = levelOf(c.sortKey);
                const active = sort !== undefined && level >= 0;
                const dir = dirOf(c.sortKey);
                const sortable = sort !== undefined && c.sortKey !== undefined;
                const pinned = stickyFirst && c.id === firstColId;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
                    className={cn(
                      cellBase,
                      'whitespace-nowrap bg-head text-left text-xs font-semibold tracking-label text-muted',
                      alignCls(c.align),
                      resizable && 'relative',
                      pinned && 'sticky left-0 z-20 shadow-pin-edge',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={(e) => sort.onSort(c.sortKey!, e.shiftKey || e.metaKey || e.ctrlKey)}
                        className={cn(
                          'group/sort inline-flex min-h-6 max-w-full items-center gap-1 rounded transition-colors duration-fast hover:text-fg',
                          active && 'text-fg',
                          // Right-aligned columns keep the label flush with the figures; the arrow sits before it.
                          c.align === 'right' && 'flex-row-reverse',
                          c.align === 'center' && 'justify-center',
                        )}
                      >
                        <span className="truncate">{c.header}</span>
                        {active
                          ? (dir === 'asc' ? <ArrowUp className="size-3 shrink-0 text-brand" aria-hidden /> : <ArrowDown className="size-3 shrink-0 text-brand" aria-hidden />)
                          : <ArrowUpDown className="size-3 shrink-0 opacity-0 transition-opacity duration-fast group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60" aria-hidden />}
                        {active && sortLevels.length > 1 && (
                          <span className="tabular grid size-4 place-items-center rounded-full bg-brand-soft text-[10px] text-brand" aria-label={t('common.table.sortPriority', { n: level + 1 })}>{level + 1}</span>
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                    {c.headerHint && (
                      <MetricDefinition label={t('common.table.colAbout', { name: c.header })} definition={c.headerHint} className="ml-1 align-middle" />
                    )}
                    {resizable && (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={t('common.table.resize', { col: c.header })}
                        aria-valuenow={widths[c.id] ?? c.defaultWidth ?? FALLBACK_COL_W}
                        aria-valuemin={MIN_COL_W}
                        aria-valuemax={MAX_COL_W}
                        tabIndex={0}
                        title={t('common.table.resizeHint')}
                        className="absolute inset-y-0 -right-1 z-10 w-2.5 cursor-col-resize touch-none hover:bg-brand/50 focus-visible:bg-brand/60 focus-visible:outline-none"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragRef.current = { id: c.id, startX: e.clientX, startW: widths[c.id] ?? c.defaultWidth ?? FALLBACK_COL_W };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          const d = dragRef.current;
                          if (d?.id === c.id) setColWidth(c.id, d.startW + e.clientX - d.startX);
                        }}
                        onPointerUp={() => { dragRef.current = null; }}
                        onPointerCancel={() => { dragRef.current = null; }}
                        onKeyDown={(e) => {
                          const w = widths[c.id] ?? c.defaultWidth ?? FALLBACK_COL_W;
                          if (e.key === 'ArrowLeft') { e.preventDefault(); setColWidth(c.id, w - 16); }
                          else if (e.key === 'ArrowRight') { e.preventDefault(); setColWidth(c.id, w + 16); }
                        }}
                        onDoubleClick={() => setColWidth(c.id, undefined)}
                        onClick={(e) => e.stopPropagation()}
                      />
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
              : displayRows.map((r, i) => {
                  const gk = groupingOn ? activeGroup.value(r) : '';
                  const first = groupingOn && (i === 0 || activeGroup.value(displayRows[i - 1] as T) !== gk);
                  return (
                    <Fragment key={getRowId(r)}>
                      {first && groupHeaderRow(gk)}
                      {renderRow(r, i)}
                    </Fragment>
                  );
                })}
            {virtualize && bottom > 0 && <tr aria-hidden style={{ height: bottom }} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
