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

export function checkPrice(p: Product, strategy: Pick<Strategy, 'guardrail'> | null, price: number): PriceCheck {
  if (!Number.isFinite(price) || price <= 0) return 'invalid';
  if (price < p.minPrice) return 'below_min';
  if (price > p.maxPrice) return 'above_max';
  const b = priceBounds(p, strategy);
  if (b.mapEnforced && price < p.mapPrice) return 'map_breach';
  if (price < b.min || price > b.max) return 'exceeds_change';
  return 'ok';
}
