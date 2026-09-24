import type { Product, Strategy } from './ontology';

export interface PriceBounds {
  min: number;
  max: number;
  mapEnforced: boolean;
}

export type PriceCheck = 'ok' | 'invalid' | 'below_min' | 'above_max' | 'map_breach' | 'exceeds_change';

/**
 * Effective bounds = product bounds intersected with strategy guardrail
 * (min/max and max change % per cycle around the current price).
 * Without a strategy only product bounds and MAP apply.
 */
export function priceBounds(p: Product, strategy: Pick<Strategy, 'guardrail'> | null): PriceBounds {
  let min = p.minPrice;
  let max = p.maxPrice;
  let mapEnforced = true;
  if (strategy) {
    const g = strategy.guardrail;
    if (g.minPrice !== null) min = Math.max(min, g.minPrice);
    if (g.maxPrice !== null) max = Math.min(max, g.maxPrice);
    if (g.maxChangePercent > 0) {
      min = Math.max(min, Math.ceil(p.price * (1 - g.maxChangePercent / 100)));
      max = Math.min(max, Math.floor(p.price * (1 + g.maxChangePercent / 100)));
    }
    mapEnforced = g.mapEnforced;
  }
  return { min, max, mapEnforced };
}

/** The active strategy whose scope covers this SKU — the same resolution runRules uses. */
export function governingStrategy(p: Pick<Product, 'sku' | 'category'>, strategies: Strategy[]): Strategy | null {
  return strategies.find((s) => s.status === 'active' && (s.skuIds.includes(p.sku) || s.categories.includes(p.category))) ?? null;
}

export function checkPrice(p: Product, strategy: Pick<Strategy, 'guardrail'> | null, price: number): PriceCheck {
  if (!Number.isFinite(price) || price <= 0) return 'invalid';
  if (price < p.minPrice) return 'below_min';
  if (price > p.maxPrice) return 'above_max';
  const b = priceBounds(p, strategy);
  if (b.mapEnforced && price < p.mapPrice) return 'map_breach';
  if (price < b.min || price > b.max) return 'exceeds_change';
  return 'ok';
}

export type BoundSource = 'product' | 'strategy' | 'change' | 'map';
export type BoundsState = 'within' | 'below' | 'above' | 'equal' | 'invalid';

export interface BoundTerm {
  source: BoundSource;
  value: number;
}

export interface BoundsExplanation {
  current: number;
  /** Strategy guardrail limits as configured — null when unset ("No minimum"/"No maximum"). */
  strategyMin: number | null;
  strategyMax: number | null;
  /** Price window the max-change-per-cycle limit allows around the current price (null when 0 = off). */
  changeMin: number | null;
  changeMax: number | null;
  productMin: number;
  productMax: number;
  map: number;
  mapEnforced: boolean;
  /** Max(terms) — every lower limit that applies. */
  minTerms: BoundTerm[];
  /** Min(terms) — every upper limit that applies. */
  maxTerms: BoundTerm[];
  effectiveMin: number;
  effectiveMax: number;
  /** Which terms decide each effective bound (ties list every binding term). */
  minBinding: BoundSource[];
  maxBinding: BoundSource[];
  state: BoundsState;
}

/**
 * Backlog v11 STRATEGY-008…016 — the effective price range as an explainable intersection:
 * effective min = Max(product min, strategy min, change-window floor, MAP when enforced),
 * effective max = Min(product max, strategy max, change-window ceiling). Same arithmetic as
 * priceBounds + checkPrice (MAP is the extra floor checkPrice enforces), exposed term-by-term so
 * the UI can show where each bound comes from.
 */
export function explainBounds(p: Pick<Product, 'price' | 'minPrice' | 'maxPrice' | 'mapPrice'>, guardrail: Strategy['guardrail'] | null): BoundsExplanation {
  const g = guardrail;
  const pct = g && g.maxChangePercent > 0 ? g.maxChangePercent : 0;
  const changeMin = pct ? Math.ceil(p.price * (1 - pct / 100)) : null;
  const changeMax = pct ? Math.floor(p.price * (1 + pct / 100)) : null;
  const mapEnforced = g ? g.mapEnforced : true;
  const minTerms: BoundTerm[] = [{ source: 'product', value: p.minPrice }];
  const maxTerms: BoundTerm[] = [{ source: 'product', value: p.maxPrice }];
  if (g?.minPrice != null) minTerms.push({ source: 'strategy', value: g.minPrice });
  if (g?.maxPrice != null) maxTerms.push({ source: 'strategy', value: g.maxPrice });
  if (changeMin !== null) minTerms.push({ source: 'change', value: changeMin });
  if (changeMax !== null) maxTerms.push({ source: 'change', value: changeMax });
  if (mapEnforced) minTerms.push({ source: 'map', value: p.mapPrice });
  const effectiveMin = Math.max(...minTerms.map((x) => x.value));
  const effectiveMax = Math.min(...maxTerms.map((x) => x.value));
  const state: BoundsState = effectiveMin > effectiveMax ? 'invalid'
    : effectiveMin === effectiveMax ? 'equal'
    : p.price < effectiveMin ? 'below'
    : p.price > effectiveMax ? 'above'
    : 'within';
  return {
    current: p.price,
    strategyMin: g?.minPrice ?? null,
    strategyMax: g?.maxPrice ?? null,
    changeMin, changeMax,
    productMin: p.minPrice, productMax: p.maxPrice,
    map: p.mapPrice, mapEnforced,
    minTerms, maxTerms, effectiveMin, effectiveMax,
    minBinding: minTerms.filter((x) => x.value === effectiveMin).map((x) => x.source),
    maxBinding: maxTerms.filter((x) => x.value === effectiveMax).map((x) => x.source),
    state,
  };
}
