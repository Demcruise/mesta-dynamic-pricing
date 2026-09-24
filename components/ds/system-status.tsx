'use client';

import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { type MestaStatus, StatusBadge, StatusIcon } from './StatusBadge';

/**
 * System/operational state primitives (enterprise backlog DS-006, EX-002):
 * freshness, sync health, job progress, and execution traces — the "is the
 * pipeline alive" vocabulary, kept separate from domain workflow status.
 */

/** "Updated 2m ago" — data-provenance signal beside charts, results, and feeds. */
export function FreshnessBadge({ at, label, className }: {
  at: string | null | undefined;
  /** Overrides the default "Updated {at}" copy, e.g. "Competitor data {at}". */
  label?: string;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-faint', className)}>
      <Clock className="size-3" aria-hidden />
      <span className="tabular">
        {at ? (label ?? t('common.freshness.updated', { at: formatRelativeTime(at, locale) })) : t('common.freshness.never')}
      </span>
    </span>
  );
}

/** Semantic alias of StatusBadge for sync/data-health surfaces. */
export function SyncStatus({ status, className }: { status: MestaStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}

/** Determinate job progress — progressbar + "done/total" + percentage, reduced-motion safe. */
export function JobProgress({ done, total, label, className }: {
  done: number; total: number; label: string; className?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted">{label}</span>
        <span className="tabular shrink-0 text-faint">{done}/{total} · {pct}%</span>
      </div>
      <div
        role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
        className="h-1.5 overflow-hidden rounded-full bg-subtle"
      >
        {/* Compositor-only fill: scaleX animates without layout/paint (Lighthouse NCA). */}
        <div className="h-full w-full origin-left rounded-full bg-brand transition-transform duration-base ease-decelerate motion-reduce:transition-none" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

export interface ExecStep {
  id: string;
  label: ReactNode;
  detail?: ReactNode;
  /** ISO timestamp rendered as relative time. */
  at?: string;
  status: MestaStatus;
}

/** Vertical execution trace — the generic sibling of AgentRunTimeline, status-driven. */
export function ExecutionTimeline({ steps, ariaLabel, className }: {
  steps: ExecStep[]; ariaLabel: string; className?: string;
}) {
  const { locale } = useTranslation();
  return (
    <ol aria-label={ariaLabel} className={cn('text-sm', className)}>
      {steps.map((s, i) => (
        <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className="absolute left-[9px] top-5 h-full w-px bg-line" />}
          <StatusIcon status={s.status} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-5">
              {s.label}
              {s.at && <span className="tabular ml-2 text-[11px] font-normal text-faint">{formatRelativeTime(s.at, locale)}</span>}
            </p>
            {s.detail && <p className="text-xs text-muted">{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
