'use client';

import { useTranslation } from '@/lib/i18n';
import type { AnomalyAlert } from '@/lib/ontology';
import { StatusBadge } from './StatusBadge';

/** Anomaly severity chip — keeps the severity label vocabulary on the unified StatusBadge. */
export function SeverityChip({ s, className }: { s: AnomalyAlert['severity']; className?: string }) {
  const { t } = useTranslation();
  return <StatusBadge status={s} label={t(`common.severity.${s}`)} className={className} />;
}
