import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PillTone = 'neutral' | 'brand' | 'up' | 'down' | 'warn' | 'info' | 'critical' | 'agent' | 'faint';
export type PillSize = 'sm' | 'md';

/**
 * The one pill anatomy for every badge/chip in Mesta (status, severity, delta, tags, counts).
 * Fixed height per size, full radius, no wrapping, icon + label always vertically centred.
 * sm = inside table rows and dense lists · md = card headers, filters, standalone status.
 */
export const PILL_TONE: Record<PillTone, string> = {
  // Neutral tones are outlined, not filled, so they stay legible on tinted row bands.
  neutral: 'bg-surface text-muted ring-1 ring-inset ring-line-strong',
  faint: 'bg-surface text-faint ring-1 ring-inset ring-line',
  brand: 'bg-brand-soft text-brand',
  up: 'bg-up-soft text-up',
  down: 'bg-down-soft text-down',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
  critical: 'bg-critical-soft text-critical',
  agent: 'bg-agent-soft text-agent',
};

const SIZE: Record<PillSize, { box: string; icon: string }> = {
  sm: { box: 'h-5 gap-1 px-1.5 text-[11px]', icon: 'size-3' },
  md: { box: 'h-6 gap-1 px-2 text-xs', icon: 'size-3.5' },
};

export const pillCls = (tone: PillTone = 'neutral', size: PillSize = 'md') =>
  cn('pill inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-medium leading-none tracking-label', SIZE[size].box, PILL_TONE[tone]);

export function Pill({ tone = 'neutral', size = 'md', icon: Icon, spin, className, children }: {
  tone?: PillTone;
  size?: PillSize;
  icon?: LucideIcon;
  /** Spins the icon (in-progress states). */
  spin?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn(pillCls(tone, size), className)}>
      {Icon && <Icon aria-hidden className={cn('shrink-0', SIZE[size].icon, spin && 'animate-spin')} />}
      {children}
    </span>
  );
}
