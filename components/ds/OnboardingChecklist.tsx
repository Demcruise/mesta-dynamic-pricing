'use client';

import { ArrowUpRight, Check, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

/**
 * First-run checklist adapted from the onboarding-3 React Bits block:
 * numbered tasks with a progress bar. Auto-hides via the caller once every
 * step is done — the steps reflect real store state, not user dismissal.
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
    <section aria-label={title} className="mb-4 rounded-card border border-line bg-surface p-card shadow-e1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel ?? title}
            title={dismissLabel}
            className="grid size-6 shrink-0 place-items-center rounded-input text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={doneLabel(done, steps.length)} className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-subtle">
          {/* Compositor-only fill: scaleX animates without layout/paint (Lighthouse NCA). */}
          <div className="h-full w-full origin-left rounded-full bg-brand transition-transform duration-slow ease-decelerate motion-reduce:transition-none" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className="tabular shrink-0 text-xs text-faint">{doneLabel(done, steps.length)}</p>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {steps.map((s, i) => (
          <li key={s.id}>
            <Link
              href={s.href}
              className={cn(
                'group flex items-center gap-3 rounded-input border px-3 py-2.5 transition-colors duration-fast',
                s.done ? 'border-line bg-subtle' : 'border-line bg-surface hover:border-brand hover:bg-brand-soft',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold',
                  s.done ? 'border-up bg-up-soft text-up' : 'border-line text-faint',
                )}
              >
                {s.done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm font-medium', s.done ? 'text-muted line-through' : 'text-fg')}>{s.title}</span>
                <span className="block truncate text-xs text-muted">{s.description}</span>
              </span>
              {!s.done && <ArrowUpRight aria-hidden className="size-4 shrink-0 text-faint transition-colors duration-fast group-hover:text-brand" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
