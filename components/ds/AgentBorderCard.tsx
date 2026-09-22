'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Actor = 'agent' | 'human' | 'rule';
export type DecisionState = 'pending' | 'approved' | 'rejected' | 'adjusted' | 'changes_requested' | 'escalated' | 'expired';

const BORDER: Record<Actor, string> = {
  agent: 'border-l-agent',
  human: 'border-l-brand',
  rule: 'border-l-hold',
};

/** Once a human decides, the border encodes the outcome — readable without the status text. */
const STATE_BORDER: Record<DecisionState, string> = {
  pending: 'border-l-agent',
  approved: 'border-l-up',
  rejected: 'border-l-down',
  adjusted: 'border-l-brand',
  changes_requested: 'border-l-warn',
  escalated: 'border-l-warn',
  expired: 'border-l-line',
};

export function AgentBorderCard({ actor, status, children, className }: {
  actor: Actor;
  status?: DecisionState;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <article className={cn('rounded-card border border-l-4 border-line bg-surface p-card shadow-e1', status ? STATE_BORDER[status] : BORDER[actor], className)}>
      <span className="sr-only">{t(`common.agent.${actor}`)}{status ? ` · ${t(`common.status.${status}`)}` : ''}</span>
      {children}
    </article>
  );
}
