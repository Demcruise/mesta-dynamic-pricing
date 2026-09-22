import { recommendationHealth } from './actions/recommendation';
import type { CompetitorObservation, DataSource, OverrideRequest, Product, Recommendation } from './ontology';

export type Severity = 'info' | 'warning' | 'critical';
export type ExceptionKind = 'breach' | 'stale' | 'override_request' | 'missing_input' | 'stale_price';

export interface ExceptionItem {
  id: string;
  kind: ExceptionKind;
  severity: Severity;
  sku: string | null;
  /** Category-level aggregation (missing_input groups by category). */
  category: string | null;
  /** Item count for aggregated rows. */
  count: number;
  at: string;
  href: string;
}

const STALE_PRICE_MS = 30 * 86_400_000;

const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Unified exception feed — every row is derived from live state, never stored:
 * guardrail breaches, stale recommendations, pending override requests,
 * missing competitor input (aggregated per category), stale prices.
 */
export function deriveExceptions(input: {
  products: Product[];
  competitors: CompetitorObservation[];
  recs: Recommendation[];
  overrides: OverrideRequest[];
  now?: number;
}): ExceptionItem[] {
  const { products, competitors, recs, overrides } = input;
  const now = input.now ?? Date.now();
  const out: ExceptionItem[] = [];

  for (const r of recs) {
    if (r.status !== 'pending' && r.status !== 'escalated') continue;
    const h = recommendationHealth(r);
    if (h.breach) {
      out.push({ id: `exc-breach-${r.id}`, kind: 'breach', severity: 'critical', sku: r.sku, category: null, count: 1, at: r.createdAt, href: `/recommendations/${r.id}` });
    } else if (h.stale) {
      out.push({ id: `exc-stale-${r.id}`, kind: 'stale', severity: 'warning', sku: r.sku, category: null, count: 1, at: r.createdAt, href: `/recommendations/${r.id}` });
    }
  }

  for (const o of overrides) {
    if (o.status !== 'pending') continue;
    out.push({ id: `exc-ovr-${o.id}`, kind: 'override_request', severity: 'warning', sku: o.sku, category: null, count: 1, at: o.createdAt, href: `/exceptions` });
  }

  const observed = new Set(competitors.map((c) => c.sku));
  const missingByCat = new Map<string, { n: number; oldest: string }>();
  for (const p of products) {
    if (observed.has(p.sku)) continue;
    const m = missingByCat.get(p.category) ?? { n: 0, oldest: p.lastChangeAt };
    m.n++;
    if (p.lastChangeAt < m.oldest) m.oldest = p.lastChangeAt;
    missingByCat.set(p.category, m);
  }
  for (const [category, m] of missingByCat) {
    out.push({ id: `exc-input-${category}`, kind: 'missing_input', severity: 'warning', sku: null, category, count: m.n, at: m.oldest, href: '/catalog' });
  }

  for (const p of products) {
    if (now - new Date(p.lastChangeAt).getTime() <= STALE_PRICE_MS) continue;
    out.push({ id: `exc-staleprice-${p.sku}`, kind: 'stale_price', severity: 'info', sku: p.sku, category: null, count: 1, at: p.lastChangeAt, href: `/catalog/${p.sku}` });
  }

  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.at.localeCompare(a.at));
}

export type AlertKind = 'anomaly' | 'deploy_failure' | 'data_quality';

export interface AlertItem {
  id: string;
  kind: AlertKind;
  severity: Severity;
  sku: string | null;
  at: string;
  href: string;
  /** Anatomy fields — what changed / expected / observed. */
  observed: string;
  expected: string;
}

/**
 * One severity feed over anomalies, failed deployments and data-source issues.
 * Purely derived — the underlying stores remain the source of truth.
 */
export function deriveAlerts(input: {
  anomalies: { id: string; sku: string; category: string; deviationPercent: number; severity: Severity; createdAt: string }[];
  deployments: { id: string; sku: string; status: string; errorReason: string | null; updatedAt: string }[];
  sources: DataSource[];
}): AlertItem[] {
  const out: AlertItem[] = [];
  for (const a of input.anomalies) {
    out.push({
      id: `alert-anm-${a.id}`, kind: 'anomaly', severity: a.severity, sku: a.sku, at: a.createdAt,
      href: `/monitoring`, observed: `${a.deviationPercent}%`, expected: '±15%',
    });
  }
  for (const d of input.deployments) {
    if (d.status !== 'failed') continue;
    out.push({
      id: `alert-dep-${d.id}`, kind: 'deploy_failure', severity: 'critical', sku: d.sku, at: d.updatedAt,
      href: '/deployment', observed: d.errorReason ?? 'failed', expected: 'synced',
    });
  }
  for (const s of input.sources) {
    if (s.status === 'failed') {
      out.push({ id: `alert-ds-${s.id}`, kind: 'data_quality', severity: 'critical', sku: null, at: s.lastSyncAt, href: '/data', observed: s.name, expected: 'healthy' });
    } else if (s.status === 'delayed' || s.rejectedRecords > 0) {
      out.push({
        id: `alert-ds-${s.id}`, kind: 'data_quality', severity: s.status === 'delayed' ? 'warning' : 'info',
        sku: null, at: s.lastSyncAt, href: '/data', observed: s.name, expected: 'healthy',
      });
    }
  }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.at.localeCompare(a.at));
}
