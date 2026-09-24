'use client';

import {
  Archive, Ban, CalendarClock, Check, CircleCheck, CircleDashed, CircleX, Clock, Eye, Flag, GitMerge, Hourglass,
  Info, LoaderCircle, OctagonAlert, Pause, PenLine, Pencil, TimerOff, TriangleAlert, Undo2, X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Pill, PILL_TONE, type PillSize, type PillTone } from './Pill';

/**
 * The single status vocabulary for the whole product (enterprise backlog DS-005 /
 * TR-003). Icon + translated label + tone — status is never colour alone.
 * Domain aliases (recommendation StatusChip, severity SeverityChip, deployment
 * STATUS_CLS) all resolve through this map so the language stays consistent.
 */
export type MestaStatus =
  // Workflow lifecycle — recommendations, strategies, rules, approvals
  | 'draft' | 'pending' | 'approved' | 'rejected' | 'adjusted' | 'changes_requested'
  | 'escalated' | 'expired' | 'stale' | 'active' | 'archived' | 'pending_manager_approval'
  // Execution — publish/deploy jobs, experiments
  | 'queued' | 'scheduled' | 'in_flight' | 'publishing' | 'published' | 'synced'
  | 'failed' | 'rolled_back' | 'cancelled' | 'partial' | 'running' | 'concluded'
  | 'ready' | 'completed'
  // Data / sync health
  | 'healthy' | 'syncing' | 'delayed' | 'paused'
  // Governance
  | 'blocked' | 'conflicted'
  // Guardrail / data-quality states (MESTA-COMP-003)
  | 'observed' | 'breached' | 'not_modelled'
  // Signal severity
  | 'info' | 'warning' | 'critical';

const MAP: Record<MestaStatus, { icon: LucideIcon; tone: PillTone; spin?: boolean }> = {
  draft: { icon: PenLine, tone: 'neutral' },
  pending: { icon: Clock, tone: 'info' },
  approved: { icon: Check, tone: 'up' },
  rejected: { icon: X, tone: 'down' },
  adjusted: { icon: Pencil, tone: 'brand' },
  changes_requested: { icon: Undo2, tone: 'warn' },
  escalated: { icon: OctagonAlert, tone: 'warn' },
  expired: { icon: TimerOff, tone: 'warn' },
  stale: { icon: TriangleAlert, tone: 'warn' },
  active: { icon: CircleCheck, tone: 'up' },
  queued: { icon: Hourglass, tone: 'neutral' },
  scheduled: { icon: CalendarClock, tone: 'info' },
  in_flight: { icon: LoaderCircle, tone: 'info', spin: true },
  publishing: { icon: LoaderCircle, tone: 'info', spin: true },
  published: { icon: CircleCheck, tone: 'up' },
  synced: { icon: CircleCheck, tone: 'up' },
  failed: { icon: CircleX, tone: 'down' },
  rolled_back: { icon: Undo2, tone: 'warn' },
  cancelled: { icon: Ban, tone: 'neutral' },
  partial: { icon: CircleDashed, tone: 'warn' },
  running: { icon: LoaderCircle, tone: 'info', spin: true },
  concluded: { icon: Flag, tone: 'up' },
  ready: { icon: Hourglass, tone: 'info' },
  completed: { icon: Check, tone: 'info' },
  healthy: { icon: CircleCheck, tone: 'up' },
  syncing: { icon: LoaderCircle, tone: 'info', spin: true },
  delayed: { icon: Clock, tone: 'warn' },
  paused: { icon: Pause, tone: 'neutral' },
  archived: { icon: Archive, tone: 'faint' },
  pending_manager_approval: { icon: Clock, tone: 'warn' },
  blocked: { icon: Ban, tone: 'down' },
  conflicted: { icon: GitMerge, tone: 'warn' },
  observed: { icon: Eye, tone: 'info' },
  breached: { icon: OctagonAlert, tone: 'down' },
  not_modelled: { icon: CircleDashed, tone: 'faint' },
  info: { icon: Info, tone: 'info' },
  warning: { icon: TriangleAlert, tone: 'warn' },
  critical: { icon: CircleX, tone: 'down' },
};

/** Icon-only variant — timelines and compact rows that carry their own label. */
export function StatusIcon({ status, className }: { status: MestaStatus; className?: string }) {
  const { icon: Icon, tone, spin } = MAP[status];
  return (
    <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-full', PILL_TONE[tone], className)}>
      <Icon className={cn('size-3', spin && 'animate-spin')} />
    </span>
  );
}

export function StatusBadge({ status, label, size = 'md', className }: {
  status: MestaStatus;
  /** Overrides the `common.status.<status>` label (e.g. a domain-specific wording). */
  label?: string;
  /** sm inside table rows / dense lists, md elsewhere. */
  size?: PillSize;
  className?: string;
}) {
  const { t } = useTranslation();
  const { icon, tone, spin } = MAP[status];
  return (
    <Pill tone={tone} size={size} icon={icon} spin={spin} className={className}>
      {label ?? t(`common.status.${status}`)}
    </Pill>
  );
}
