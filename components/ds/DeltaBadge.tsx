'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Props {
  /** Ratio, 0.05 = +5%. */
  value: number;
  className?: string;
}

/** Direction is always icon + text, never colour alone. */
export function DeltaBadge({ value, className }: Props) {
  const { t, locale } = useTranslation();
  const dir = Math.abs(value) < 0.0005 ? 'flat' : value > 0 ? 'up' : 'down';
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus;
  const label = t(`common.delta.${dir}`);
  const pct = formatPercent(Math.abs(value), locale);
  return (
    <span
      aria-label={`${label} ${pct}`}
      className={cn(
        'tabular inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
        dir === 'up' && 'bg-up-soft text-up',
        dir === 'down' && 'bg-down-soft text-down',
        dir === 'flat' && 'bg-hold-soft text-hold',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span aria-hidden>{pct}</span>
    </span>
  );
}
