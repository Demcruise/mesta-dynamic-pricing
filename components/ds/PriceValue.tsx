'use client';

import { formatPrice } from '@/lib/format';
import { useUiStore } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  className?: string;
  muted?: boolean;
  loading?: boolean;
}

/** IDR price in mono tabular numerals, locale-aware. */
export function PriceValue({ value, className, muted, loading }: Props) {
  const locale = useUiStore((s) => s.locale);
  if (loading) return <span className={cn('tabular inline-block h-4 w-20 animate-pulse rounded bg-subtle', className)} aria-hidden />;
  return <span className={cn('tabular', muted ? 'text-muted' : 'text-fg', className)}>{formatPrice(value, locale)}</span>;
}
