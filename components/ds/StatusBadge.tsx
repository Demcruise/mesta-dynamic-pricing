'use client';

import {
  Ban, CalendarClock, Check, CircleCheck, CircleDashed, CircleX, Clock, GitMerge, Hourglass,
  Info, LoaderCircle, OctagonAlert, Pause, PenLine, Pencil, TimerOff, TriangleAlert, Undo2, X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * The single status vocabulary for the whole product (enterprise backlog DS-005 /
 * TR-003). Icon + translated label + tone — status is never colour alone.
 * Domain aliases (recommendation StatusChip, severity SeverityChip, deployment
 * STATUS_CLS) all resolve through this map so the language stays consistent.
 */
export type MestaStatus =
  // Workflow lifecycle — recommendations, strategies, approvals
  | 'draft' | 'pending' | 'approved' | 'rejected' | 'adjusted' | 'changes_requested'
  | 'escalated' | 'expired' | 'stale'
  // Execution — publish/deploy jobs
  | 'queued' | 'scheduled' | 'in_flight' | 'publishing' | 'published' | 'synced'
  | 'failed' | 'rolled_back' | 'cancelled' | 'partial'
  // Data / sync health
  | 'healthy' | 'syncing' | 'delayed' | 'paused'
  // Governance
  | 'blocked' | 'conflicted'
  // Signal severity
  | 'info' | 'warning' | 'critical';

const MAP: Record<MestaStatus, { icon: LucideIcon; cls: string; spin?: boolean }> = {
  draft: { icon: PenLine, cls: 'bg-subtle text-muted' },
  pending: { icon: Clock, cls: 'bg-info-soft text-info' },
  approved: { icon: Check, cls: 'bg-up-soft text-up' },
  rejected: { icon: X, cls: 'bg-down-soft text-down' },
  adjusted: { icon: Pencil, cls: 'bg-brand-soft text-brand' },
  changes_requested: { icon: Undo2, cls: 'bg-warn-soft text-warn' },
  escalated: { icon: OctagonAlert, cls: 'bg-warn-soft text-warn' },
  expired: { icon: TimerOff, cls: 'bg-warn-soft text-warn' },
  stale: { icon: TriangleAlert, cls: 'bg-warn-soft text-warn' },
  queued: { icon: Hourglass, cls: 'bg-subtle text-muted' },
  scheduled: { icon: CalendarClock, cls: 'bg-info-soft text-info' },
  in_flight: { icon: LoaderCircle, cls: 'bg-info-soft text-info', spin: true },
  publishing: { icon: LoaderCircle, cls: 'bg-info-soft text-info', spin: true },
  published: { icon: CircleCheck, cls: 'bg-up-soft text-up' },
  synced: { icon: CircleCheck, cls: 'bg-up-soft text-up' },
  failed: { icon: CircleX, cls: 'bg-down-soft text-down' },
  rolled_back: { icon: Undo2, cls: 'bg-warn-soft text-warn' },
  cancelled: { icon: Ban, cls: 'bg-subtle text-muted' },
  partial: { icon: CircleDashed, cls: 'bg-warn-soft text-warn' },
  healthy: { icon: CircleCheck, cls: 'bg-up-soft text-up' },
  syncing: { icon: LoaderCircle, cls: 'bg-info-soft text-info', spin: true },
  delayed: { icon: Clock, cls: 'bg-warn-soft text-warn' },
  paused: { icon: Pause, cls: 'bg-subtle text-muted' },
  blocked: { icon: Ban, cls: 'bg-down-soft text-down' },
  conflicted: { icon: GitMerge, cls: 'bg-warn-soft text-warn' },
  info: { icon: Info, cls: 'bg-info-soft text-info' },
  warning: { icon: TriangleAlert, cls: 'bg-warn-soft text-warn' },
  critical: { icon: CircleX, cls: 'bg-down-soft text-down' },
};

/** Icon-only variant — timelines and compact rows that carry their own label. */
export function StatusIcon({ status, className }: { status: MestaStatus; className?: string }) {
  const { icon: Icon, cls, spin } = MAP[status];
  return (
    <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-full', cls, className)}>
      <Icon className={cn('size-3', spin && 'animate-spin')} />
    </span>
  );
}

export function StatusBadge({ status, label, className }: {
  status: MestaStatus;
  /** Overrides the `common.status.<status>` label (e.g. a domain-specific wording). */
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { icon: Icon, cls, spin } = MAP[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cls, className)}>
      <Icon className={cn('size-3', spin && 'animate-spin')} aria-hidden />
      {label ?? t(`common.status.${status}`)}
    </span>
  );
}
