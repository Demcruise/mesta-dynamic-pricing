'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Actor = 'agent' | 'human' | 'rule';

const BORDER: Record<Actor, string> = {
  agent: 'border-l-agent',
  human: 'border-l-brand',
  rule: 'border-l-hold',
};

export function AgentBorderCard({ actor, children, className }: { actor: Actor; children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <article className={cn('rounded-card border border-l-4 border-line bg-surface p-card shadow-e1', BORDER[actor], className)}>
      <span className="sr-only">{t(`common.agent.${actor}`)}</span>
      {children}
    </article>
  );
}
