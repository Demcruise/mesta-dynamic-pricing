'use client';

import {
  Ban, CalendarClock, CheckCircle2, Database, Flag, FlaskConical, PenLine, Pencil, Play, RotateCw, Rocket, Send,
  Settings2, Timer, TriangleAlert, Undo2, UserMinus, UserPlus, XCircle, type LucideIcon,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { AuditEvent, AuditEventType } from '@/lib/ontology';
import { cn } from '@/lib/utils';
import { eventTone, groupEventsByDay, type AuditTone } from './audit-utils';

const ICONS: Record<AuditEventType, LucideIcon> = {
  strategy_submit: Send,
  strategy_activate: CheckCircle2,
  strategy_reject: XCircle,
  strategy_rollback: Undo2,
  strategy_save: Pencil,
  strategy_schedule: CalendarClock,
  strategy_unschedule: Ban,
  scenario_sent: FlaskConical,
  recommendation_approve: CheckCircle2,
  recommendation_reject: XCircle,
  recommendation_adjust: Pencil,
  recommendation_request_changes: Pencil,
  recommendation_escalate: TriangleAlert,
  recommendation_expire: Timer,
  recommendation_resubmit: RotateCw,
  deployment_success: Rocket,
  deployment_failure: TriangleAlert,
  deployment_retry: RotateCw,
  deployment_rollback: Undo2,
  publish_scheduled: CalendarClock,
  publish_cancelled: Ban,
  rule_save: Pencil,
  rule_run: Play,
  override_request: Send,
  override_approve: CheckCircle2,
  override_reject: XCircle,
  datasource_sync: Database,
  experiment_save: FlaskConical,
  experiment_start: Play,
  experiment_conclude: CheckCircle2,
  experiment_cancel: Ban,
  delegation_grant: UserPlus,
  delegation_revoke: UserMinus,
  policy_override: Settings2,
  publish_window_end: Timer,
  model_review_feedback: Flag,
  manual_override: PenLine,
};

const TONE_CLS: Record<AuditTone, string> = {
  brand: 'bg-brand-soft text-brand',
  agent: 'bg-agent/10 text-agent',
  up: 'bg-up-soft text-up',
  down: 'bg-down-soft text-down',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
};

/** Grouped feed: per-day buckets, icon + color per event family, click drills into the drawer. */
export function AuditTimeline({ events, onSelect }: { events: AuditEvent[]; onSelect: (e: AuditEvent) => void }) {
  const { t, locale } = useTranslation();
  const groups = groupEventsByDay(events, locale);
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.day} aria-label={g.label}>
          <h2 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {g.label}
            <span className="tabular font-normal text-faint">{t('audit.timeline.count', { n: g.events.length })}</span>
          </h2>
          <ol className="relative flex flex-col gap-1 border-l border-line pl-4">
            {g.events.map((e) => {
              const Icon = ICONS[e.type];
              return (
                <li key={e.id} className="relative">
                  <span aria-hidden className={cn('absolute -left-[1.65rem] top-1.5 grid size-5 place-items-center rounded-full', TONE_CLS[eventTone(e.type)])}>
                    <Icon className="size-3" />
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelect(e)}
                    className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-input px-2 py-1.5 text-left text-sm transition-colors duration-fast hover:bg-subtle"
                  >
                    <span className="font-medium">{t(`common.event.${e.type}`)}</span>
                    <span className="tabular text-xs text-faint">{e.sku ?? e.entityId}</span>
                    <span className="ml-auto text-xs text-muted">{e.actorId}</span>
                    <span className="tabular text-xs text-faint">{formatRelativeTime(e.timestamp, locale)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
