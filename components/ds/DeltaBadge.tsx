'use client';

import { ArrowDown, ArrowUp, Minus, TriangleAlert } from 'lucide-react';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { pillCls, type PillSize } from './Pill';

export type Polarity = 'higher-better' | 'lower-better' | 'neutral';

interface Props {
  /** Ratio, 0.05 = +5%. Null/undefined renders the "unavailable" state. */
  value: number | null | undefined;
  /** Validation rejected the underlying price (out of bounds, below MAP, …). */
  invalid?: boolean;
  /**
   * pill = soft background chip (default) · text = inline coloured figure with no fill,
   * the reference treatment inside KPI cards and dense table cells.
   */
  variant?: 'pill' | 'text';
  size?: PillSize;
  /**
   * Which direction is good. The arrow always shows direction; colour shows sentiment —
   * e.g. fewer anomalies is a green ↓. `neutral` keeps direction without judging it.
   */
  polarity?: Polarity;
  className?: string;
}

type Tone = 'up' | 'down' | 'flat';

const PILL_TONE: Record<Tone, 'up' | 'down' | 'neutral'> = { up: 'up', down: 'down', flat: 'neutral' };
const TEXT_TONE: Record<Tone, string> = { up: 'text-up', down: 'text-down', flat: 'text-faint' };

/** Direction is always icon + text, never colour alone. */
export function DeltaBadge({ value, invalid = false, variant = 'pill', size = 'md', polarity = 'higher-better', className }: Props) {
  const { t, locale } = useTranslation();
  const iconCls = size === 'sm' ? 'size-3' : 'size-3.5';

  // MESTA-COMP-005 states: unavailable / invalid never render as a fake 0%.
  if (invalid || value == null || !Number.isFinite(value)) {
    const label = t(invalid ? 'common.delta.invalid' : 'common.delta.unavailable');
    const Icon = invalid ? TriangleAlert : Minus;
    return variant === 'text' ? (
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium', invalid ? 'text-warn' : 'text-faint', className)}>
        <Icon className={iconCls} aria-hidden />{label}
      </span>
    ) : (
      <span className={cn(pillCls(invalid ? 'warn' : 'neutral', size), className)}>
        <Icon className={iconCls} aria-hidden />{label}
      </span>
    );
  }

  const dir = Math.abs(value) < 0.0005 ? 'flat' : value > 0 ? 'up' : 'down';
  const good: Tone = dir === 'flat' || polarity === 'neutral'
    ? 'flat'
    : (dir === 'up') === (polarity === 'higher-better') ? 'up' : 'down';
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus;
  const label = t(`common.delta.${dir}`);
  const pct = formatPercent(Math.abs(value), locale);
  const content = (
    <>
      <Icon className={cn('shrink-0', iconCls)} aria-hidden />
      <span className="sr-only">{`${label} ${pct}`}</span>
      <span aria-hidden>{pct}</span>
    </>
  );
  return variant === 'text' ? (
    <span className={cn('tabular relative inline-flex items-center gap-0.5 whitespace-nowrap font-medium', size === 'sm' ? 'text-[11px]' : 'text-xs', TEXT_TONE[good], className)}>
      {content}
    </span>
  ) : (
    <span className={cn('tabular relative', pillCls(polarity === 'neutral' ? 'neutral' : PILL_TONE[good], size), className)}>
      {content}
    </span>
  );
}
