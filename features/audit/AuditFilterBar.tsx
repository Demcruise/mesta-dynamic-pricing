'use client';

import { CalendarRange, ListFilter, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { useTranslation } from '@/lib/i18n';
import type { AuditEventType } from '@/lib/ontology';
import { cn } from '@/lib/utils';
import { EMPTY_AUDIT_FILTERS, type AuditFilters } from './audit-utils';

type Secondary = Pick<AuditFilters, 'actor' | 'source' | 'type'>;

/**
 * AUD-001…029 — the audit query in one compact toolbar: date range (primary, one grouped control),
 * a Filters popover for the secondary criteria (Actor → Source → Event type, staged with
 * Reset/Apply), a first-class SKU lookup, and a low-emphasis Clear. Active criteria show as
 * removable chips below. Every control is 40px (--control-h-md) with the shared input tokens.
 */
export function AuditFilterBar({ filters, set, actors, types }: {
  filters: AuditFilters;
  set: (p: Partial<AuditFilters>) => void;
  actors: string[];
  types: AuditEventType[];
}) {
  const { t } = useTranslation();
  const secondaryCount = (['actor', 'source', 'type'] as const).filter((k) => filters[k]).length;
  const anyActive = Object.values(filters).some(Boolean);

  const chips: { key: keyof AuditFilters; label: string }[] = [
    ...(filters.from || filters.to ? [{ key: 'from' as const, label: `${t('audit.filter.dateRange')}: ${filters.from || '…'} → ${filters.to || '…'}` }] : []),
    ...(filters.actor ? [{ key: 'actor' as const, label: `${t('audit.filter.actor')}: ${filters.actor}` }] : []),
    ...(filters.source ? [{ key: 'source' as const, label: `${t('audit.filter.source')}: ${t(`common.source.${filters.source}`)}` }] : []),
    ...(filters.type ? [{ key: 'type' as const, label: `${t('audit.filter.type')}: ${t(`common.event.${filters.type}`)}` }] : []),
    ...(filters.sku ? [{ key: 'sku' as const, label: `${t('audit.filter.sku')}: ${filters.sku}` }] : []),
  ];

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3" role="search">
        {/* AUD-003: date range is one grouped control, the primary filter. */}
        <div className="hidden h-control-md items-center gap-2 rounded-input border border-line-strong bg-input pl-3 pr-1 sm:flex">
          <CalendarRange className="size-4 shrink-0 text-muted" aria-hidden />
          <label className="sr-only" htmlFor="audit-from">{t('audit.filter.from')}</label>
          <input id="audit-from" type="date" className="tabular h-8 bg-transparent text-[13px] text-fg outline-offset-2" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
          <span aria-hidden className="text-faint">→</span>
          <label className="sr-only" htmlFor="audit-to">{t('audit.filter.to')}</label>
          <input id="audit-to" type="date" className="tabular h-8 bg-transparent text-[13px] text-fg outline-offset-2" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </div>

        <FiltersPopover filters={filters} count={secondaryCount} actors={actors} types={types} onApply={(p) => set(p)} set={set} />

        {/* AUD-019: SKU is a direct lookup — partial match, Enter-free, clearable. */}
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            aria-label={t('audit.filter.searchSku')}
            placeholder={t('audit.filter.searchSku')}
            className={cn(inputCls, 'tabular pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden')}
            value={filters.sku}
            onChange={(e) => set({ sku: e.target.value })}
          />
          {filters.sku && (
            <button type="button" aria-label={t('audit.filter.clearSku')} onClick={() => set({ sku: '' })}
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-subtle hover:text-fg">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        {/* AUD-008: one deterministic reset; hidden when nothing is filtered. */}
        {anyActive && (
          <button type="button" className="px-1 text-label font-medium text-brand hover:underline" onClick={() => set(EMPTY_AUDIT_FILTERS)}>
            {t('common.filter.clear')}
          </button>
        )}
      </div>

      {/* AUD-007/010: active criteria visible outside the popover, removable one by one. */}
      {chips.length > 0 && (
        <ul aria-label={t('audit.filter.active')} className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <li key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full border border-line-strong bg-surface pl-3 pr-1 text-caption font-medium text-fg">
              <span className="max-w-72 truncate">{c.label}</span>
              <button
                type="button"
                aria-label={t('audit.filter.remove', { label: c.label })}
                onClick={() => set(c.key === 'from' ? { from: '', to: '' } : { [c.key]: '' })}
                className="grid size-5 place-items-center rounded-full text-muted hover:bg-subtle hover:text-fg"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** AUD-002/009/024: staged secondary filters — focus moves in, Escape closes and returns focus. */
function FiltersPopover({ filters, count, actors, types, onApply, set }: {
  filters: AuditFilters;
  count: number;
  actors: string[];
  types: AuditEventType[];
  onApply: (p: Secondary) => void;
  set: (p: Partial<AuditFilters>) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Secondary>({ actor: filters.actor, source: filters.source, type: filters.type });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft({ actor: filters.actor, source: filters.source, type: filters.type });
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('select')?.focus());
    const close = () => { setOpen(false); trigger.current?.focus(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!panel.current?.contains(n) && !trigger.current?.contains(n)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const select = (key: keyof Secondary, label: string, options: { value: string; label: string }[], all: string) => (
    <label className="flex flex-col gap-1.5 text-label text-fg">
      {label}
      <select className={inputCls} value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="relative">
      <Button ref={trigger} variant={count > 0 ? 'selected' : 'secondary'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ListFilter className="size-4" aria-hidden />
        {t('audit.filter.filters')}
        {count > 0 && <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-fg">{count}</span>}
      </Button>
      {open && (
        <div ref={panel} role="dialog" aria-label={t('audit.filter.filters')}
          className="absolute left-0 top-12 z-30 flex w-[min(360px,calc(100vw-32px))] flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-e3">
          {/* Narrow screens: the date range moves in here (AUD-027). */}
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            <label className="flex flex-col gap-1.5 text-label">{t('audit.filter.from')}
              <input type="date" className={inputCls} value={filters.from} onChange={(e) => set({ from: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-label">{t('audit.filter.to')}
              <input type="date" className={inputCls} value={filters.to} onChange={(e) => set({ to: e.target.value })} />
            </label>
          </div>
          {select('actor', t('audit.filter.actor'), actors.map((a) => ({ value: a, label: a })), t('audit.filter.allActors'))}
          {select('source', t('audit.filter.source'), (['ui', 'agent', 'system', 'sso'] as const).map((s) => ({ value: s, label: t(`common.source.${s}`) })), t('audit.filter.allSources'))}
          {select('type', t('audit.filter.type'), types.map((x) => ({ value: x, label: t(`common.event.${x}`) })), t('audit.filter.allTypes'))}
          <div className="flex items-center justify-between gap-2 border-t border-divider pt-4">
            <Button variant="ghost" onClick={() => setDraft({ actor: '', source: '', type: '' })}>{t('audit.filter.reset')}</Button>
            <span className="flex gap-2">
              <Button variant="secondary" onClick={() => { setOpen(false); trigger.current?.focus(); }}>{t('common.action.cancel')}</Button>
              <Button onClick={() => { onApply(draft); setOpen(false); trigger.current?.focus(); }}>{t('audit.filter.apply')}</Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
