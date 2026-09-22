import { competitorGap, marginPct } from '@/lib/domain';
import type {
  AnomalyAlert, AuditEvent, DeploymentRecord, Product, Recommendation, Role, Strategy, UserSession,
} from '@/lib/ontology';

export interface Kpi {
  key: string;
  value: number | string | null;
  /** 'money' and 'percent' are formatted by the view in the active locale; 'date' is an ISO string. */
  kind: 'count' | 'money' | 'percent' | 'date';
  href?: string;
}

export interface KpiInput {
  user: UserSession;
  recs: Recommendation[];
  audit: AuditEvent[];
  anomalies: AnomalyAlert[];
  threshold: number;
  strategies: Strategy[];
  deployments: DeploymentRecord[];
  breachCount: number;
  lastDeploymentAt: string | null;
}

const DECISIONS = ['recommendation_approve', 'recommendation_reject', 'recommendation_adjust'];

export function roleKpis(input: KpiInput): Kpi[] {
  const { user, recs, audit, anomalies, threshold, strategies, deployments } = input;
  const pending = recs.filter((r) => r.status === 'pending').length;
  const activeAnomalies = anomalies.filter((a) => Math.abs(a.deviationPercent) > threshold).length;
  const overrides = audit.filter((e) => e.type === 'manual_override').length;
  const decisions = audit.filter((e) => DECISIONS.includes(e.type)).length;
  const byRole: Record<Role, Kpi[]> = {
    analyst: [
      { key: 'pendingApprovals', value: pending, kind: 'count', href: '/recommendations?status=pending' },
      { key: 'reviewed', value: audit.filter((e) => e.actorId === user.userId && DECISIONS.includes(e.type)).length, kind: 'count', href: '/audit' },
      { key: 'activeAnomalies', value: activeAnomalies, kind: 'count', href: '/monitoring' },
    ],
    manager: [
      { key: 'marginImpact', value: recs.filter((r) => r.status === 'approved' || r.status === 'adjusted').reduce((s, r) => s + r.projectedMarginImpact, 0), kind: 'money', href: '/recommendations?status=approved' },
      { key: 'overrideRate', value: overrides + decisions ? overrides / (overrides + decisions) : 0, kind: 'percent', href: '/audit' },
      { key: 'strategyHealth', value: strategies.filter((s) => s.status === 'active').length, kind: 'count', href: '/strategy' },
      { key: 'pendingStrategies', value: strategies.filter((s) => s.status === 'pending_manager_approval').length, kind: 'count', href: '/strategy' },
    ],
    ops_lead: [
      { key: 'channelFailures', value: deployments.filter((d) => d.status === 'failed').length, kind: 'count', href: '/deployment?status=failed' },
      { key: 'pendingSyncs', value: deployments.filter((d) => d.status === 'pending' || d.status === 'in_flight').length, kind: 'count', href: '/deployment?status=pending' },
      { key: 'lastDeployment', value: input.lastDeploymentAt, kind: 'date', href: '/deployment' },
    ],
    compliance: [
      { key: 'auditVolume', value: audit.length, kind: 'count', href: '/audit' },
      { key: 'manualOverrides', value: overrides, kind: 'count', href: '/audit' },
      { key: 'guardrailExceptions', value: input.breachCount, kind: 'count', href: '/recommendations' },
    ],
  };
  return byRole[user.role];
}

/** Average margin across the last `periods` price-history points of every product. */
export function marginTrend(products: Product[], periods = 8): number[] {
  const out: number[] = [];
  for (let back = periods - 1; back >= 0; back--) {
    let sum = 0, n = 0;
    for (const p of products) {
      const h = p.priceHistory[p.priceHistory.length - 1 - back];
      if (h) { sum += marginPct({ price: h.price, cost: p.cost }); n++; }
    }
    out.push(n ? sum / n : 0);
  }
  return out;
}

export function decisionsByCategory(recs: Recommendation[], products: Product[]): { label: string; value: number }[] {
  const cat = new Map(products.map((p) => [p.sku, p.category]));
  const counts = new Map<string, number>();
  for (const r of recs) {
    if (r.status === 'pending') continue;
    const c = cat.get(r.sku) ?? '—';
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Average competitor gap per category, as a ratio (negative = we are cheaper). */
export function gapByCategory(products: Product[]): { label: string; value: number }[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const p of products) {
    const a = acc.get(p.category) ?? { sum: 0, n: 0 };
    a.sum += competitorGap(p);
    a.n++;
    acc.set(p.category, a);
  }
  return [...acc].map(([label, a]) => ({ label, value: a.sum / a.n })).sort((x, y) => y.value - x.value);
}
