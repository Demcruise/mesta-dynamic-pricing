import type { Product } from './ontology';

/** Assumed monthly units at the current price. Disclosed to the user in the assumptions card. */
export const BASE_UNITS = 1000;
/** Half-width of the demand confidence interval (±15%). */
export const CI = 0.15;

export interface Projection {
  price: number;
  priceDelta: number; // ratio vs current
  units: number;
  unitsLow: number;
  unitsHigh: number;
  demandChange: number; // ratio
  revenue: number;
  grossMargin: number; // IDR
  marginPct: number;
}

/** Constant-elasticity demand: units = base × (P / P0) ^ elasticity. */
export function project(p: Pick<Product, 'price' | 'cost' | 'elasticity'>, price: number): Projection {
  const ratio = price / p.price;
  const units = BASE_UNITS * Math.pow(ratio, p.elasticity);
  const revenue = price * units;
  const grossMargin = (price - p.cost) * units;
  return {
    price,
    priceDelta: ratio - 1,
    units,
    unitsLow: units * (1 - CI),
    unitsHigh: units * (1 + CI),
    demandChange: units / BASE_UNITS - 1,
    revenue,
    grossMargin,
    marginPct: price > 0 ? (price - p.cost) / price : 0,
  };
}

export function curve(p: Pick<Product, 'price' | 'cost' | 'elasticity'>, min: number, max: number, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const price = min + ((max - min) * i) / steps;
    return project(p, price);
  });
}
