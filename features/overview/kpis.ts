import { competitorGap, marginPct } from '@/lib/domain';
import { pendingApprovalLevel } from '@/lib/actions/recommendation';
import type {
  AnomalyAlert, AuditEvent, DeploymentRecord, Product, Recommendation, Role, Strategy, UserSession,
} from '@/lib/ontology';

export interface Kpi {
  key: string;
  value: number | string | null;
  /** 'money' and 'percent' are formatted by the view in the active locale; 'date' is an ISO string. */
  kind: 'count' | 'money' | 'percent' | 'date';
  href?: string;
  /** Event counts per period across the observed span — drives the card sparkline. */
  spark?: number[];
  /** Ratio change between the last two periods (0 when both empty). */
  delta?: number;
}

const SPARK_PERIODS = 8;

/** Bucket event timestamps across their observed span; delta compares the last two buckets. */
function seriesOf(ats: (string | null | undefined)[], periods = SPARK_PERIODS): Pick<Kpi, 'spark' | 'delta'> {
  const ts = ats.filter((a): a is string => !!a).map((a) => Date.parse(a)).filter(Number.isFinite);
  if (ts.length === 0) return { spark: [], delta: 0 };
  const lo = Math.min(...ts);
  const span = Math.max(...ts) - lo || 1;
  const spark = Array.from({ length: periods }, () => 0);
  for (const t of ts) spark[Math.min(periods - 1, Math.floor(((t - lo) / span) * periods))]!++;
  const prev = spark[periods - 2]!;
  const last = spark[periods - 1]!;
  return { spark, delta: prev === 0 ? (last === 0 ? 0 : 1) : (last - prev) / prev };
}

export interface KpiInput {
  user: UserSession;
  recs: Recommendation[];
  audit: AuditEvent[];
  anomalies: AnomalyAlert[];
  threshold: number;
  strategies: Strategy[];
  deployments: DeploymentRecord[];
  /** Pending recommendations currently breaching guardrails — also drives the KPI spark. */
  breachRecs: Recommendation[];
  lastDeploymentAt: string | null;
}

const DECISIONS = ['recommendation_approve', 'recommendation_reject', 'recommendation_adjust'];

export function roleKpis(input: KpiInput): Kpi[] {
  const { user, recs, audit, anomalies, threshold, strategies, deployments } = input;
  const pending = recs.filter((r) => r.status === 'pending').length;
  const activeAnomalies = anomalies.filter((a) => Math.abs(a.deviationPercent) > threshold).length;
  const overrides = audit.filter((e) => e.type === 'manual_override').length;
  const decisions = audit.filter((e) => DECISIONS.includes(e.type)).length;
  const auditAt = (f: (e: AuditEvent) => boolean) => audit.filter(f).map((e) => e.timestamp);
  const byRole: Record<Role, Kpi[]> = {
    analyst: [
      { key: 'pendingApprovals', value: pending, kind: 'count', href: '/recommendations?status=pending', ...seriesOf(recs.map((r) => r.createdAt)) },
      { key: 'reviewed', value: audit.filter((e) => e.actorId === user.userId && DECISIONS.includes(e.type)).length, kind: 'count', href: '/audit', ...seriesOf(auditAt((e) => e.actorId === user.userId && DECISIONS.includes(e.type))) },
      { key: 'activeAnomalies', value: activeAnomalies, kind: 'count', href: '/monitoring', ...seriesOf(anomalies.map((a) => a.createdAt)) },
    ],
    manager: [
      { key: 'marginImpact', value: recs.filter((r) => r.status === 'approved' || r.status === 'adjusted').reduce((s, r) => s + r.projectedMarginImpact, 0), kind: 'money', href: '/recommendations?status=approved', ...seriesOf(auditAt((e) => DECISIONS.includes(e.type))) },
      { key: 'overrideRate', value: overrides + decisions ? overrides / (overrides + decisions) : 0, kind: 'percent', href: '/audit', ...seriesOf(auditAt((e) => e.type === 'manual_override')) },
      { key: 'strategyHealth', value: strategies.filter((s) => s.status === 'active').length, kind: 'count', href: '/strategy', ...seriesOf(auditAt((e) => e.type === 'strategy_activate')) },
      { key: 'pendingStrategies', value: strategies.filter((s) => s.status === 'pending_manager_approval').length, kind: 'count', href: '/strategy', ...seriesOf(auditAt((e) => e.type === 'strategy_submit')) },
    ],
    ops_lead: [
      { key: 'channelFailures', value: deployments.filter((d) => d.status === 'failed').length, kind: 'count', href: '/deployment?status=failed', ...seriesOf(deployments.filter((d) => d.status === 'failed').map((d) => d.updatedAt)) },
      { key: 'pendingSyncs', value: deployments.filter((d) => d.status === 'pending' || d.status === 'in_flight').length, kind: 'count', href: '/deployment?status=pending', ...seriesOf(deployments.filter((d) => d.status === 'pending' || d.status === 'in_flight').map((d) => d.updatedAt)) },
      { key: 'lastDeployment', value: input.lastDeploymentAt, kind: 'date', href: '/deployment', ...seriesOf(deployments.map((d) => d.updatedAt)) },
    ],
    approver: [
      { key: 'awaitingExecutive', value: recs.filter((r) => pendingApprovalLevel(r) === 'approver').length, kind: 'count', href: '/approvals', ...seriesOf(recs.map((r) => r.createdAt)) },
      { key: 'decidedByMe', value: audit.filter((e) => e.actorId === user.userId && DECISIONS.includes(e.type)).length, kind: 'count', href: '/audit', ...seriesOf(auditAt((e) => e.actorId === user.userId && DECISIONS.includes(e.type))) },
      { key: 'executiveImpact', value: recs.filter((r) => r.approvals.some((a) => a.level === 'approver')).reduce((s, r) => s + r.projectedMarginImpact, 0), kind: 'money', href: '/recommendations?status=approved' },
    ],
    compliance: [
      { key: 'auditVolume', value: audit.length, kind: 'count', href: '/audit', ...seriesOf(audit.map((e) => e.timestamp)) },
      { key: 'manualOverrides', value: overrides, kind: 'count', href: '/audit', ...seriesOf(auditAt((e) => e.type === 'manual_override')) },
      { key: 'guardrailExceptions', value: input.breachRecs.length, kind: 'count', href: '/recommendations', ...seriesOf(input.breachRecs.map((r) => r.createdAt)) },
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
