import { confidenceTier } from '@/components/ds/ConfidenceBar';
import type { Product, Recommendation, RecommendationSource } from '@/lib/ontology';

export type SortKey = 'confidence' | 'impact' | 'age' | 'category';
export type Magnitude = 'small' | 'medium' | 'large';
export type StatusFilter = Recommendation['status'] | 'all';

export interface QueueFilters {
  category: string;
  source: RecommendationSource | '';
  status: StatusFilter;
  tier: 'high' | 'medium' | 'low' | '';
  magnitude: Magnitude | '';
  sort: SortKey;
}

/** Absent status param means "pending": the queue's job is what still needs a decision. */
export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  category: '', source: '', status: 'pending', tier: '', magnitude: '', sort: 'confidence',
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
  return sp;
}

export const isDefaultFilters = (f: QueueFilters) => serializeQueueFilters(f).toString() === '';

export const changeRatio = (r: Recommendation) => (r.currentPrice ? (r.proposedPrice - r.currentPrice) / r.currentPrice : 0);

export function magnitudeOf(r: Recommendation): Magnitude {
  const a = Math.abs(changeRatio(r));
  return a < 0.03 ? 'small' : a <= 0.06 ? 'medium' : 'large';
}

/** Pure: never mutates or removes anything from the source store. */
export function filterAndSort(recs: Recommendation[], products: Map<string, Product>, f: QueueFilters): Recommendation[] {
  const out = recs.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false;
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
