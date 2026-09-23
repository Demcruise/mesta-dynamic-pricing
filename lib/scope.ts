import type { Product } from './ontology';

/**
 * Organisational scope hierarchy (enterprise APP-002): Org → BU → Region → Store.
 * Every product sits in one store; BU is derived from region so it can't drift.
 * Demo catalogue: one org ("Mesta Retail"), two BUs, four regions, ten stores.
 */
export const ORG_NAME = 'Mesta Retail';

export const BU_BY_REGION = {
  Jawa: 'ID-West',
  Sumatra: 'ID-West',
  Kalimantan: 'ID-East',
  'Indonesia Timur': 'ID-East',
} as const;

export type Region = keyof typeof BU_BY_REGION;
export const REGIONS = Object.keys(BU_BY_REGION) as Region[];
export const BUS = [...new Set(Object.values(BU_BY_REGION))] as string[];

export const STORES_BY_REGION: Record<Region, string[]> = {
  Jawa: ['Jakarta HQ', 'Bandung', 'Surabaya'],
  Sumatra: ['Medan', 'Palembang'],
  Kalimantan: ['Balikpapan', 'Banjarmasin', 'Pontianak'],
  'Indonesia Timur': ['Makassar', 'Denpasar'],
};

export const ALL_STORES = REGIONS.flatMap((r) => STORES_BY_REGION[r]);

export const buOf = (region: string): string => BU_BY_REGION[region as Region] ?? '—';
export const regionOfStore = (store: string): Region | null =>
  REGIONS.find((r) => STORES_BY_REGION[r].includes(store)) ?? null;

export interface ScopeSelection {
  /** null = whole org. */
  region: Region | null;
  /** null = whole region. Store implies its region. */
  store: string | null;
  /** null = all categories. Independent of store — the hierarchy's Category level (APP-002). */
  category: string | null;
}

export const ORG_SCOPE: ScopeSelection = { region: null, store: null, category: null };

export function inScope(p: Pick<Product, 'region' | 'store' | 'category'>, s: ScopeSelection): boolean {
  if (s.category && p.category !== s.category) return false;
  if (s.store) return p.store === s.store;
  if (s.region) return p.region === s.region;
  return true;
}

export function inScopeSkus<T extends { sku: string }>(items: T[], products: Map<string, Product>, s: ScopeSelection): T[] {
  if (!s.region && !s.store && !s.category) return items;
  return items.filter((i) => {
    const p = products.get(i.sku);
    return p ? inScope(p, s) : false;
  });
}
