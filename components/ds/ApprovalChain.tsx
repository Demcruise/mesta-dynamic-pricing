'use client';

import { Check } from 'lucide-react';
import { approvalChain, pendingApprovalLevel } from '@/lib/actions/recommendation';
import { useTranslation } from '@/lib/i18n';
import type { Recommendation } from '@/lib/ontology';
import { cn } from '@/lib/utils';
import { pillCls } from './Pill';

/**
 * APR-003 / MESTA-APP-002 stepper: which approval levels a rec needs, which are
 * done, and the SLA clock — current level, completed levels, elapsed time,
 * per-level SLA, and escalation state.
 * Renders nothing for single-level recs — the badge already covers them.
 */
const SLA_HOURS = 24;

export function ApprovalChain({ rec }: { rec: Recommendation }) {
  const { t } = useTranslation();
  const chain = approvalChain(rec);
  if (chain.length < 2) return null;
  const pending = pendingApprovalLevel(rec);
  const elapsedH = Math.floor((Date.now() - new Date(rec.createdAt).getTime()) / 3_600_000);
  const overdue = pending !== null && elapsedH > SLA_HOURS;
  const escalated = rec.status === 'escalated';
  return (
    <div className="flex flex-col gap-1">
      <ol aria-label={t('recommendations.chain.title')} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {chain.map((level, i) => {
          const done = rec.approvals.some((a) => a.level === level);
          const isPending = pending === level;
          return (
            <li key={level} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-faint">→</span>}
              <span
                className={pillCls(done ? 'up' : isPending ? 'warn' : 'neutral', 'sm')}
              >
                {done && <Check className="size-3" aria-hidden />}
                {t(`common.role.${level}`)}
              </span>
            </li>
          );
        })}
        {pending === null && rec.status !== 'approved' && (
          <li className="text-faint">{t('recommendations.chain.complete')}</li>
        )}
      </ol>
      {/* SLA clock + escalation state — never colour alone. */}
      <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span className="tabular">{t('recommendations.chain.elapsed', { h: elapsedH })}</span>
        <span className={cn('tabular', overdue && 'text-warn')}>{t('recommendations.chain.sla', { h: SLA_HOURS })}</span>
        {escalated && <span className={pillCls('warn', 'sm')}>{t('recommendations.chain.escalated')}</span>}
        {overdue && !escalated && <span className={pillCls('warn', 'sm')}>{t('recommendations.chain.overdue')}</span>}
      </p>
    </div>
  );
}
