'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * One bordered control whose active segment is raised — used for every either/or switch
 * (chart vs table, density, digest vs granular). Buttons with aria-pressed, keyboard-native.
 * `iconOnly` keeps the label as the accessible name but shows just the icon (tight headers).
 */
export function Segmented<T extends string>({ value, onChange, options, label, iconOnly = false, compactOnMobile = false, className }: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  /** Group label for assistive tech. */
  label: string;
  iconOnly?: boolean;
  /** Below the sm breakpoint show icons only (labels stay as the accessible name). */
  compactOnMobile?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex h-9 shrink-0 items-center gap-0.5 rounded-input border border-line-strong bg-input p-0.5', className)}>
      {options.map(({ value: v, label: text, icon: Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          aria-label={iconOnly ? text : undefined}
          title={iconOnly ? text : undefined}
          onClick={() => onChange(v)}
          className={cn(
            'inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-[8px] text-xs font-medium tracking-label transition-colors duration-fast',
            iconOnly ? 'w-8 justify-center' : compactOnMobile ? 'px-2.5 max-sm:w-8 max-sm:justify-center max-sm:px-0' : 'px-2.5',
            value === v ? 'bg-surface text-fg shadow-e2 ring-1 ring-line' : 'text-muted hover:text-fg',
          )}
        >
          {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
          {!iconOnly && <span className={cn(compactOnMobile && 'max-sm:sr-only')}>{text}</span>}
        </button>
      ))}
    </div>
  );
}
