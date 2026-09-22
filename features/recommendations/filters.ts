import { confidenceTier } from '@/components/ds/ConfidenceBar';
import { recommendationHealth } from '@/lib/actions/recommendation';
import type { Product, Recommendation, RecommendationSource } from '@/lib/ontology';

export type SortKey = 'confidence' | 'impact' | 'age' | 'category';
export type Magnitude = 'small' | 'medium' | 'large';
export type StatusFilter = Recommendation['status'] | 'all';
/** Work-queue tabs derived from real fields (attention-queue anatomy, enterprise §8.1). */
export type QueueTab = 'all' | 'decide' | 'deploy' | 'impact' | 'stale' | 'anomaly';
/** |projectedMarginImpact| at or above this counts as "high impact" — disclosed in the UI. */
export const HIGH_IMPACT_IDR = 500_000;

export interface QueueFilters {
  category: string;
  source: RecommendationSource | '';
  status: StatusFilter;
  tier: 'high' | 'medium' | 'low' | '';
  magnitude: Magnitude | '';
  sort: SortKey;
  tab: QueueTab;
}

/** Absent status param means "pending": the queue's job is what still needs a decision. */
export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  category: '', source: '', status: 'pending', tier: '', magnitude: '', sort: 'confidence', tab: 'decide',
};

export function parseQueueFilters(sp: URLSearchParams): QueueFilters {
  const d = DEFAULT_QUEUE_FILTERS;
  const pick = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T =>
    v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  return {
    category: sp.get('cat') ?? '',
    source: pick(sp.get('src'), ['agent', 'simulation', 'manual', ''] as const, d.source),
    status: pick(sp.get('status'), ['pending', 'approved', 'rejected', 'adjusted', 'all'] as const, d.status),
    tier: pick(sp.get('tier'), ['high', 'medium', 'low', ''] as const, d.tier),
    magnitude: pick(sp.get('mag'), ['small', 'medium', 'large', ''] as const, d.magnitude),
    sort: pick(sp.get('sort'), ['confidence', 'impact', 'age', 'category'] as const, d.sort),
    // An explicit status param with no tab means an audit-style view: force the 'all' tab so
    // deep links like /recommendations?status=approved are not shadowed by the default 'decide' tab.
    tab: pick(sp.get('tab'), ['all', 'decide', 'deploy', 'impact', 'stale', 'anomaly'] as const,
      sp.get('status') !== null ? 'all' : d.tab),
  };
}

export function serializeQueueFilters(f: QueueFilters): URLSearchParams {
  const sp = new URLSearchParams();
  const d = DEFAULT_QUEUE_FILTERS;
  if (f.category) sp.set('cat', f.category);
  if (f.source) sp.set('src', f.source);
  if (f.status !== d.status) sp.set('status', f.status);
  if (f.tier) sp.set('tier', f.tier);
  if (f.magnitude) sp.set('mag', f.magnitude);
  if (f.sort !== d.sort) sp.set('sort', f.sort);
  if (f.tab !== d.tab) sp.set('tab', f.tab);
  return sp;
}

export const isDefaultFilters = (f: QueueFilters) => serializeQueueFilters(f).toString() === '';

export const changeRatio = (r: Recommendation) => (r.currentPrice ? (r.proposedPrice - r.currentPrice) / r.currentPrice : 0);

export function magnitudeOf(r: Recommendation): Magnitude {
  const a = Math.abs(changeRatio(r));
  return a < 0.03 ? 'small' : a <= 0.06 ? 'medium' : 'large';
}

/** The bucket predicate for a queue tab — every clause derives from stored data. */
export function tabMatches(tab: QueueTab, r: Recommendation, anomalySkus: Set<string>): boolean {
  switch (tab) {
    case 'decide': return r.status === 'pending';
    case 'deploy': return (r.status === 'approved' || r.status === 'adjusted') && !r.deployed;
    case 'impact': return Math.abs(r.projectedMarginImpact) >= HIGH_IMPACT_IDR;
    case 'stale': return r.status === 'pending' && recommendationHealth(r).stale;
    case 'anomaly': return anomalySkus.has(r.sku);
    default: return true;
  }
}

/** Pure: never mutates or removes anything from the source store. */
export function filterAndSort(
  recs: Recommendation[], products: Map<string, Product>, f: QueueFilters, anomalySkus: Set<string> = new Set(),
): Recommendation[] {
  const out = recs.filter((r) => {
    if (f.tab !== 'all' && !tabMatches(f.tab, r, anomalySkus)) return false;
    // The tab owns the status axis while active; the facet applies in the 'all' view.
    if (f.tab === 'all' && f.status !== 'all' && r.status !== f.status) return false;
    if (f.source && r.source !== f.source) return false;
    if (f.category && products.get(r.sku)?.category !== f.category) return false;
    if (f.tier && confidenceTier(r.confidence) !== f.tier) return false;
    if (f.magnitude && magnitudeOf(r) !== f.magnitude) return false;
    return true;
  });
  const cat = (r: Recommendation) => products.get(r.sku)?.category ?? '';
  const cmp: Record<SortKey, (a: Recommendation, b: Recommendation) => number> = {
    confidence: (a, b) => b.confidence - a.confidence,
    impact: (a, b) => Math.abs(b.projectedMarginImpact) - Math.abs(a.projectedMarginImpact),
    age: (a, b) => b.createdAt.localeCompare(a.createdAt),
    category: (a, b) => cat(a).localeCompare(cat(b)),
  };
  return [...out].sort((a, b) => cmp[f.sort](a, b) || a.id.localeCompare(b.id));
}
