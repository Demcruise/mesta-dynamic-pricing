import type { UserSession } from '../ontology';
import { can } from '../rbac';
import { useAuditStore, useMonitoringStore, useNotificationStore } from '../stores';
import { track } from '../telemetry';
import { fail, ok } from './result';

/** Flags an anomaly as model feedback: updates state, audits, and confirms via notification. */
export function flagForModelReview(user: UserSession, anomalyId: string) {
  if (!can(user.role, 'monitoring.flag_model')) return fail('forbidden');
  const a = useMonitoringStore.getState().anomalies.find((x) => x.id === anomalyId);
  if (!a) return fail('not_found');
  if (!useMonitoringStore.getState().flag(anomalyId)) return fail('already_flagged');
  useAuditStore.getState().record({
    type: 'model_review_feedback', actorId: user.userId, actorRole: user.role, entityType: 'anomaly', entityId: anomalyId,
    sku: a.sku, source: 'ui', note: `${a.category} ${a.deviationPercent}%`,
  });
  useNotificationStore.getState().push({
    targetRole: user.role, groupKey: 'model_review', messageKey: 'common.notify.flagged', params: { sku: a.sku }, href: '/monitoring',
  });
  track('model_review_flagged', { anomalyId });
  return ok();
}

/** Digest grouping: one row per category with count, worst deviation and severity. */
export function groupAnomalies<T extends { category: string; deviationPercent: number; severity: 'info' | 'warning' | 'critical' }>(items: T[]) {
  const rank = { info: 0, warning: 1, critical: 2 } as const;
  const map = new Map<string, { category: string; items: T[]; maxDeviation: number; severity: T['severity'] }>();
  for (const a of items) {
    const g = map.get(a.category);
    if (!g) map.set(a.category, { category: a.category, items: [a], maxDeviation: Math.abs(a.deviationPercent), severity: a.severity });
    else {
      g.items.push(a);
      g.maxDeviation = Math.max(g.maxDeviation, Math.abs(a.deviationPercent));
      if (rank[a.severity] > rank[g.severity]) g.severity = a.severity;
    }
  }
  return [...map.values()].sort((x, y) => y.items.length - x.items.length);
}
