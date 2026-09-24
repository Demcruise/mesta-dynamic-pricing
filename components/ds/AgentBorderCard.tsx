'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Actor = 'agent' | 'human' | 'rule';
export type DecisionState = 'pending' | 'approved' | 'rejected' | 'adjusted' | 'changes_requested' | 'escalated' | 'expired';

/**
 * Card for content authored by an agent, a human or a rule. Backlog v11 RECOMMENDATION-001/002,
 * APPROVAL-008/015: no permanent coloured left rail — the card is neutral (1px border, surface,
 * subtle hover) and provenance/decision state are carried by explicit badges in the content plus
 * the screen-reader line below. `selected` gives the tinted selected state.
 */
export function AgentBorderCard({ actor, status, selected = false, children, className }: {
  actor: Actor;
  status?: DecisionState;
  selected?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <article
      className={cn(
        'rounded-card border bg-surface p-6 transition-colors duration-fast',
        selected ? 'border-brand bg-brand-soft/40' : 'border-line hover:border-line-strong',
        className,
      )}
    >
      <span className="sr-only">{t(`common.agent.${actor}`)}{status ? ` · ${t(`common.status.${status}`)}` : ''}</span>
      {children}
    </article>
  );
}
