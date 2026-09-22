'use client';

import { useTranslation } from '@/lib/i18n';
import type { AnomalyAlert } from '@/lib/ontology';
import { cn } from '@/lib/utils';

const SEV_CLS = {
  info: 'bg-info-soft text-info',
  warning: 'bg-warn-soft text-warn',
  critical: 'bg-down-soft text-down',
} as const;

/** Anomaly severity chip — the single colour scheme for signal severity (alerts + monitoring). */
export function SeverityChip({ s, className }: { s: AnomalyAlert['severity']; className?: string }) {
  const { t } = useTranslation();
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEV_CLS[s], className)}>{t(`common.severity.${s}`)}</span>;
}
