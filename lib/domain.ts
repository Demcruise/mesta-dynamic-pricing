import type { ElasticityBand, Product } from './ontology';

export function marginPct(p: Pick<Product, 'price' | 'cost'>): number {
  return p.price > 0 ? (p.price - p.cost) / p.price : 0;
}

export function elasticityBand(e: number): ElasticityBand {
  const a = Math.abs(e);
  return a < 1 ? 'inelastic' : a < 1.8 ? 'moderate' : 'elastic';
}

export type MarginHealth = 'healthy' | 'thin' | 'critical';
export function marginHealth(p: Pick<Product, 'price' | 'cost'>): MarginHealth {
  const m = marginPct(p);
  return m >= 0.2 ? 'healthy' : m >= 0.12 ? 'thin' : 'critical';
}

/** (price - competitorAvg) / competitorAvg. Negative = we are cheaper. */
export function competitorGap(p: Pick<Product, 'price' | 'competitorAvg'>): number {
  return p.competitorAvg > 0 ? (p.price - p.competitorAvg) / p.competitorAvg : 0;
}

export function belowMap(p: Pick<Product, 'price' | 'mapPrice'>): boolean {
  return p.price < p.mapPrice;
}

/** Guardrail check shared by override dialog, strategy, simulation, recommendation. */
export function validatePrice(
  p: Pick<Product, 'minPrice' | 'maxPrice' | 'mapPrice'>,
  price: number,
  opts: { enforceMap?: boolean } = {},
): 'ok' | 'invalid' | 'below_min' | 'above_max' | 'map_breach' {
  if (!Number.isFinite(price) || price <= 0) return 'invalid';
  if (price < p.minPrice) return 'below_min';
  if (price > p.maxPrice) return 'above_max';
  if (opts.enforceMap !== false && price < p.mapPrice) return 'map_breach';
  return 'ok';
}
