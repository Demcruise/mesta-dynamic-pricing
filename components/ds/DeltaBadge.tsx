'use client';

import { ArrowDown, ArrowUp, Minus, TriangleAlert } from 'lucide-react';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Props {
  /** Ratio, 0.05 = +5%. Null/undefined renders the "unavailable" state. */
  value: number | null | undefined;
  /** Validation rejected the underlying price (out of bounds, below MAP, …). */
  invalid?: boolean;
  className?: string;
}

/** Direction is always icon + text, never colour alone. */
export function DeltaBadge({ value, invalid = false, className }: Props) {
  const { t, locale } = useTranslation();

  // MESTA-COMP-005 states: unavailable / invalid never render as a fake 0%.
  if (invalid || value == null || !Number.isFinite(value)) {
    const label = t(invalid ? 'common.delta.invalid' : 'common.delta.unavailable');
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
          invalid ? 'bg-warn-soft text-warn' : 'bg-subtle text-muted',
          className,
        )}
      >
        {invalid ? <TriangleAlert className="size-3" aria-hidden /> : <Minus className="size-3" aria-hidden />}
        {label}
      </span>
    );
  }

  const dir = Math.abs(value) < 0.0005 ? 'flat' : value > 0 ? 'up' : 'down';
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus;
  const label = t(`common.delta.${dir}`);
  const pct = formatPercent(Math.abs(value), locale);
  return (
    <span
      className={cn(
        'tabular relative inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
        dir === 'up' && 'bg-up-soft text-up',
        dir === 'down' && 'bg-down-soft text-down',
        dir === 'flat' && 'bg-hold-soft text-hold',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{`${label} ${pct}`}</span>
      <span aria-hidden>{pct}</span>
    </span>
  );
}
