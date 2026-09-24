'use client';

import { ArrowUpRight, Check, ListChecks, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Panel } from './states';

/** Column count per step count so the last row is never a lone orphan tile. */
const XL_COLS: Record<number, string> = { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-3', 7: 'xl:grid-cols-4' };

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

/**
 * First-run checklist adapted from the onboarding-3 React Bits block:
 * numbered tasks with a progress bar, laid out as a compact tile grid so it reads as an
 * operational tracker rather than a promotional banner. Auto-hides via the caller once
 * every step is done — the steps reflect real store state, not user dismissal.
 */
export function OnboardingChecklist({ title, subtitle, steps, doneLabel, onDismiss, dismissLabel }: {
  title: string;
  subtitle: string;
  steps: OnboardingStep[];
  doneLabel: (n: number, total: number) => string;
  /** When provided, renders a dismiss control — returning users can hide setup. */
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <Panel
      aria-label={title}
      icon={ListChecks}
      title={title}
      description={subtitle}
      actions={
        <>
          <span className="tabular hidden text-xs font-medium text-faint sm:inline">{doneLabel(done, steps.length)}</span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dismissLabel ?? title}
              title={dismissLabel}
              className="grid size-7 shrink-0 place-items-center rounded-row text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </>
      }
    >
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={doneLabel(done, steps.length)} className="h-1 overflow-hidden rounded-full bg-subtle">
        {/* Compositor-only fill: scaleX animates without layout/paint (Lighthouse NCA). */}
        <div className="h-full w-full origin-left rounded-full bg-brand transition-transform duration-slow ease-decelerate motion-reduce:transition-none" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <ul className={cn('mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2', XL_COLS[Math.min(steps.length, 7)])}>
        {steps.map((s, i) => (
          <li key={s.id} className="min-w-0">
            <Link
              href={s.href}
              className={cn(
                'group flex h-full items-center gap-2.5 rounded-row bg-row px-2.5 py-2 transition-colors duration-fast',
                !s.done && 'hover:bg-brand-soft',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                  s.done ? 'bg-up-soft text-up' : 'border border-line-strong bg-surface text-faint',
                )}
              >
                {s.done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[13px] font-semibold', s.done ? 'text-muted line-through' : 'text-fg')}>{s.title}</span>
                <span className="block truncate text-[11px] text-faint">{s.description}</span>
              </span>
              {!s.done && <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-faint transition-colors duration-fast group-hover:text-brand" />}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
