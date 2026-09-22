'use client';

import { formatPrice } from '@/lib/format';
import { useUiStore } from '@/lib/stores/ui';
import { useCountUp } from '@/lib/use-count-up';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  className?: string;
  muted?: boolean;
  loading?: boolean;
  /** Count-up animate toward a new value (e.g. after a deploy). Off by default in dense tables. */
  animate?: boolean;
}

/** IDR price in mono tabular numerals, locale-aware. */
export function PriceValue({ value, className, muted, loading, animate = false }: Props) {
  const locale = useUiStore((s) => s.locale);
  const shown = useCountUp(value, animate);
  if (loading) return <span className={cn('tabular inline-block h-4 w-20 animate-pulse rounded bg-subtle', className)} aria-hidden />;
  return <span className={cn('tabular', muted ? 'text-muted' : 'text-fg', className)}>{formatPrice(shown, locale)}</span>;
}
