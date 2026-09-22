import { cn } from '@/lib/utils';

/** Pulsing "live" status dot. Reduced-motion users get a static dot via the global kill-switch. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-up" />
    </span>
  );
}
