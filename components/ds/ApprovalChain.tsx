'use client';

import { Check } from 'lucide-react';
import { approvalChain, pendingApprovalLevel } from '@/lib/actions/recommendation';
import { useTranslation } from '@/lib/i18n';
import type { Recommendation } from '@/lib/ontology';
import { cn } from '@/lib/utils';

/**
 * APR-003 stepper: which approval levels a rec needs and which are done.
 * Renders nothing for single-level recs — the badge already covers them.
 */
export function ApprovalChain({ rec }: { rec: Recommendation }) {
  const { t } = useTranslation();
  const chain = approvalChain(rec);
  if (chain.length < 2) return null;
  const pending = pendingApprovalLevel(rec);
  return (
    <ol aria-label={t('recommendations.chain.title')} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {chain.map((level, i) => {
        const done = rec.approvals.some((a) => a.level === level);
        const isPending = pending === level;
        return (
          <li key={level} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-faint">→</span>}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                done ? 'bg-up-soft text-up' : isPending ? 'bg-warn-soft text-warn' : 'bg-subtle text-muted',
              )}
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
  );
}
