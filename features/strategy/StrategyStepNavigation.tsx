'use client';

import { Check, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type StepState = 'completed' | 'current' | 'upcoming' | 'blocked';

export interface StepItem {
  id: string;
  title: string;
  summary: string;
  state: StepState;
}

/**
 * STRATEGY-004 — the wizard's navigation rail. Each state differs by glyph AND text, never by colour
 * alone: completed = check, current = filled index + selected row (the same treatment as the app
 * sidebar), upcoming = outlined index, blocked = warning glyph + "Needs attention". Every row has the
 * same height so the rail keeps one rhythm on every step; summaries truncate to one line.
 */
export function StrategyStepNavigation({ steps, onSelect, label, className }: {
  steps: StepItem[];
  onSelect: (index: number) => void;
  label: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {steps.map((s, i) => {
          const current = s.state === 'current';
          return (
            <li key={s.id} className="relative min-w-44 lg:min-w-0" aria-current={current ? 'step' : undefined}>
              {/* Rail connector between indices (desktop). */}
              {i < steps.length - 1 && <span aria-hidden className="absolute left-[27px] top-11 hidden h-[calc(100%-36px)] w-px bg-line-strong lg:block" />}
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  'relative flex h-16 w-full items-center gap-3 rounded-input px-3 text-left transition-colors duration-fast',
                  current ? 'bg-brand-soft' : 'hover:bg-subtle',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                    current && 'border-brand bg-brand text-brand-fg',
                    s.state === 'completed' && 'border-up-graphic bg-up-soft text-up',
                    s.state === 'upcoming' && 'border-line-strong bg-surface text-muted',
                    s.state === 'blocked' && 'border-critical bg-critical-soft text-critical',
                  )}
                >
                  {s.state === 'completed' ? <Check className="size-3.5" /> : s.state === 'blocked' ? <TriangleAlert className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', current ? 'font-semibold text-brand' : 'font-medium text-fg')}>{s.title}</span>
                  <span className={cn('block truncate text-caption', s.state === 'blocked' ? 'font-medium text-critical' : current ? 'text-brand' : 'text-faint')}>
                    {s.state === 'blocked' ? t('strategy.step.needsAttention') : s.summary}
                  </span>
                </span>
                <span className="sr-only">{t(`strategy.step.state.${s.state}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
