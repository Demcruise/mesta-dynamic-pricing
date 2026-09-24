'use client';

import type { LucideIcon } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface FilterTab<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: LucideIcon;
  /** Tone of the icon — severity/status colour is secondary to the icon + label (ALERT-022). */
  iconCls?: string;
}

/**
 * Status/severity quick filter (GUARDRAIL-005, ALERT-001…008, EXCEPTION-017/018, RECOMMENDATION-026).
 * One 40px segmented row: tablist semantics, ←/→/Home/End move between tabs, counts in a fixed
 * min-width slot so a 13 → 14 change never shifts the row (ALERT-027). The active tab changes
 * surface, border and weight — never height or padding. Zero-count tabs stay visible but disabled
 * (ALERT-006) unless they are the active one. Scrolls horizontally instead of wrapping on narrow
 * screens (ALERT-025).
 */
export function FilterTabs<T extends string>({ value, onChange, tabs, label, controls, className }: {
  value: T;
  onChange: (v: T) => void;
  tabs: FilterTab<T>[];
  label: string;
  /** id of the region the tabs filter (aria-controls). */
  controls?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = (i: number) => {
    const tab = tabs[i];
    return tab !== undefined && (tab.count === undefined || tab.count > 0 || tab.value === value);
  };
  const move = (from: number, dir: 1 | -1 | 'home' | 'end') => {
    const order = tabs.map((_, i) => i).filter(enabled);
    if (order.length === 0) return;
    let idx: number;
    if (dir === 'home') idx = order[0]!;
    else if (dir === 'end') idx = order[order.length - 1]!;
    else {
      const pos = order.indexOf(from);
      idx = order[(pos + dir + order.length) % order.length]!;
    }
    refs.current[idx]?.focus();
    onChange(tabs[idx]!.value);
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const map: Record<string, 1 | -1 | 'home' | 'end'> = { ArrowRight: 1, ArrowLeft: -1, Home: 'home', End: 'end' };
    const d = map[e.key];
    if (d !== undefined) { e.preventDefault(); move(i, d); }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('inline-flex h-control-md max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-input border border-line-strong bg-input p-1', className)}
    >
      {tabs.map((tab, i) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={controls}
            tabIndex={active ? 0 : -1}
            disabled={!enabled(i)}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-[13px] transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'bg-surface font-semibold text-fg shadow-e2 ring-1 ring-line-strong' : 'font-medium text-muted hover:text-fg',
            )}
          >
            {Icon && <Icon aria-hidden className={cn('size-3.5 shrink-0', tab.iconCls)} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('tabular min-w-6 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5', active ? 'bg-brand-soft text-brand' : 'bg-subtle text-muted')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
