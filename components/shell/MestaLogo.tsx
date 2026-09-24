import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Mesta brand mark. `full` = neuron mark + wordmark, `mark` = neuron only (collapsed rail, tight headers).
 * Both ink variants are rendered and swapped by theme so there is no flash on hydration.
 */
export function MestaLogo({ variant = 'full', className, label = 'Mesta' }: {
  variant?: 'full' | 'mark';
  className?: string;
  label?: string;
}) {
  const full = variant === 'full';
  const size = full ? { width: 85, height: 24 } : { width: 30, height: 24 };
  const base = full ? 'mesta-logo' : 'mesta-mark';
  return (
    <span role="img" aria-label={label} className={cn('inline-flex shrink-0 items-center', className)}>
      <Image src={`/brand/${base}-dark-ink.png`} alt="" aria-hidden {...size} priority className="block dark:hidden" />
      <Image src={`/brand/${base}-light-ink.png`} alt="" aria-hidden {...size} priority className="hidden dark:block" />
    </span>
  );
}
