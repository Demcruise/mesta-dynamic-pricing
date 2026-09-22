import { checkPrice, priceBounds } from './guardrails';
import type { Product, Recommendation, Strategy } from './ontology';
import { useProductCatalogStore, useStrategyStore } from './stores';
import { isStale } from './actions/recommendation';

export type RuleKey = 'min_price' | 'max_price' | 'map' | 'max_change' | 'auto_approve' | 'freshness';

export interface RuleEvalRow {
  key: RuleKey;
  /** How the row's values render. */
  kind: 'price' | 'percent' | 'score' | 'flag';
  ok: boolean;
  /** Bound or threshold being checked against (null for flag rows). */
  expected: number | null;
  /** Observed input: proposed price, |Δ%|, confidence — depending on kind. */
  actual: number | null;
  /** Rows that don't apply to this rec (e.g. no strategy attached) are listed but marked off. */
  applicable: boolean;
}

/**
 * Rule evaluation for a recommendation — the per-check input→expected→actual→result
 * table (enterprise §8.2 RuleEvaluation). Every row derives from checkPrice inputs,
 * the strategy guardrail, or the staleness rule — nothing invented.
 */
export function evaluateRules(rec: Recommendation, product: Product | undefined): RuleEvalRow[] {
  if (!product) {
    return [
      { key: 'min_price', kind: 'price', ok: false, expected: null, actual: rec.proposedPrice, applicable: false },
      { key: 'max_price', kind: 'price', ok: false, expected: null, actual: rec.proposedPrice, applicable: false },
      { key: 'map', kind: 'price', ok: false, expected: null, actual: rec.proposedPrice, applicable: false },
      { key: 'max_change', kind: 'percent', ok: false, expected: null, actual: null, applicable: false },
      { key: 'auto_approve', kind: 'score', ok: false, expected: null, actual: rec.confidence, applicable: false },
      { key: 'freshness', kind: 'flag', ok: false, expected: null, actual: null, applicable: true },
    ];
  }
  const strategy: Strategy | null = rec.strategyId
    ? useStrategyStore.getState().items.find((s) => s.id === rec.strategyId) ?? null
    : null;
  const g = strategy?.guardrail ?? null;
  const bounds = priceBounds(product, strategy);
  const deltaPct = rec.currentPrice > 0 ? Math.abs((rec.proposedPrice - rec.currentPrice) / rec.currentPrice) * 100 : 0;
  const cat = useProductCatalogStore.getState();
  let latest: string | null = null;
  for (const c of cat.competitors) if (c.sku === rec.sku && (latest === null || c.observedAt > latest)) latest = c.observedAt;

  return [
    { key: 'min_price', kind: 'price', ok: rec.proposedPrice >= product.minPrice, expected: product.minPrice, actual: rec.proposedPrice, applicable: true },
    { key: 'max_price', kind: 'price', ok: rec.proposedPrice <= product.maxPrice, expected: product.maxPrice, actual: rec.proposedPrice, applicable: true },
    {
      key: 'map', kind: 'price', ok: !bounds.mapEnforced || rec.proposedPrice >= product.mapPrice,
      expected: product.mapPrice, actual: rec.proposedPrice, applicable: bounds.mapEnforced,
    },
    {
      key: 'max_change', kind: 'percent', ok: !g || g.maxChangePercent <= 0 || deltaPct <= g.maxChangePercent,
      expected: g && g.maxChangePercent > 0 ? g.maxChangePercent : null, actual: deltaPct, applicable: !!g && g.maxChangePercent > 0,
    },
    {
      key: 'auto_approve', kind: 'score', ok: !!g && g.autoApproveThreshold > 0 && rec.confidence >= g.autoApproveThreshold,
      expected: g && g.autoApproveThreshold > 0 ? g.autoApproveThreshold : null, actual: rec.confidence, applicable: !!g && g.autoApproveThreshold > 0,
    },
    { key: 'freshness', kind: 'flag', ok: !isStale(rec, product, latest), expected: null, actual: null, applicable: true },
  ];
}

/** Aggregate: does the proposed price pass the same gate checkPrice applies? */
export function rulesPass(rec: Recommendation, product: Product | undefined): boolean {
  if (!product) return false;
  const strategy = rec.strategyId ? useStrategyStore.getState().items.find((s) => s.id === rec.strategyId) ?? null : null;
  return checkPrice(product, strategy, rec.proposedPrice) === 'ok';
}
