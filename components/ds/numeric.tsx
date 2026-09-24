'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatPrice } from '@/lib/format';
import { useUiStore } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';

/**
 * Money (APPROVAL-003 / APPROVAL-027) — one IDR value as ONE token: tabular, never wraps, so a
 * minus sign can never detach onto its own line ("-" / "IDR 157,120"). `signed` colours by sign.
 */
export function Money({ value, signed = false, className }: { value: number; signed?: boolean; className?: string }) {
  const locale = useUiStore((s) => s.locale);
  return (
    <span className={cn('tabular whitespace-nowrap', signed && (value < 0 ? 'text-down' : value > 0 ? 'text-up' : 'text-muted'), className)}>
      {signed && value > 0 ? '+' : ''}{formatPrice(value, locale)}
    </span>
  );
}

/**
 * PriceMove (APPROVAL-002 / EXCEPTION-008) — current → proposed as a single semantic value:
 * a 3-slot grid (price · 20px arrow · price) so the arrow stays centred and both prices hold
 * predictable numeric slots. Missing `from` renders an em dash in the first slot, keeping the
 * proposed price on the same x-position as rows that have both.
 */
export function PriceMove({ from, to, align = 'end', className }: {
  from: number | null | undefined;
  to: number;
  align?: 'start' | 'end';
  className?: string;
}) {
  const locale = useUiStore((s) => s.locale);
  const dir = from == null || from === to ? 'text-faint' : to > from ? 'text-up' : 'text-down';
  return (
    <span
      className={cn(
        'tabular inline-grid grid-cols-[max-content_20px_max-content] items-center gap-x-1.5 whitespace-nowrap',
        align === 'end' ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      <span className={cn('text-right', from == null ? 'text-faint' : 'text-muted')}>{from == null ? '—' : formatPrice(from, locale)}</span>
      <ArrowRight aria-hidden className={cn('size-3.5 justify-self-center', dir)} />
      <span className="font-semibold text-fg">{formatPrice(to, locale)}</span>
    </span>
  );
}

/**
 * CellStack — the two-line cell used by every data table: primary value over a 12px context
 * line, both single-line (nowrap + truncate) so a row never grows (TABLE-004 / MON-014).
 */
export function CellStack({ primary, secondary, align = 'left', className }: {
  primary: ReactNode;
  secondary?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 flex-col gap-0.5 whitespace-nowrap', align === 'right' ? 'items-end text-right' : 'items-start', className)}>
      <span className="max-w-full truncate leading-5">{primary}</span>
      {secondary !== undefined && <span className="max-w-full truncate text-xs font-medium leading-4 text-faint">{secondary}</span>}
    </span>
  );
}
