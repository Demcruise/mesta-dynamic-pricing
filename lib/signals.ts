import type { CompetitorObservation, ElasticityBand, Product } from './ontology';
import { project } from './projection';

/**
 * MI-002/MI-003: demand and inventory signal derivations for the Signals workspace.
 * Everything here is a model-derived estimate — the page labels it as such.
 */

export type StockRisk = 'stockout' | 'low' | 'healthy' | 'overstock';

export interface SkuSignals {
  product: Product;
  /** Estimated monthly units at the current price (demand model). */
  velocity: number;
  elasticityBand: ElasticityBand;
  competitorCoverage: number;
  /** Days of supply on hand at the modelled velocity — Infinity when demand is ~0. */
  daysOfSupply: number;
  stockRisk: StockRisk;
}

export function elasticityBand(p: Pick<Product, 'elasticity'>): ElasticityBand {
  const e = Math.abs(p.elasticity);
  return e < 1 ? 'inelastic' : e < 1.8 ? 'moderate' : 'elastic';
}

export function skuSignals(p: Product, observations: CompetitorObservation[]): SkuSignals {
  const velocity = project(p, p.price).units;
  const daily = velocity / 30;
  const daysOfSupply = daily > 0 ? p.stockUnits / daily : Number.POSITIVE_INFINITY;
  const stockRisk: StockRisk =
    p.stockUnits === 0 || daysOfSupply < 7 ? 'stockout' : daysOfSupply < 21 ? 'low' : daysOfSupply > 90 ? 'overstock' : 'healthy';
  return {
    product: p,
    velocity,
    elasticityBand: elasticityBand(p),
    competitorCoverage: observations.filter((o) => o.sku === p.sku).length,
    daysOfSupply,
    stockRisk,
  };
}

export function signalRows(products: Product[], observations: CompetitorObservation[]): SkuSignals[] {
  return products.map((p) => skuSignals(p, observations));
}
