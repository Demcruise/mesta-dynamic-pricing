import { belowMap, competitorGap, elasticityBand, marginHealth, marginPct } from '@/lib/domain';
import type { ElasticityBand, Product, StockStatus } from '@/lib/ontology';
import type { MarginHealth } from '@/lib/domain';

export type SortKey =
  | 'sku' | 'name' | 'category' | 'cost' | 'price' | 'competitorAvg' | 'margin' | 'elasticity' | 'stock' | 'lastChange';

export interface CatalogFilters {
  q: string;
  category: string[];
  elasticity: ElasticityBand[];
  margin: MarginHealth[];
  stock: StockStatus[];
  /** Competitor gap range in percent; null = open-ended. */
  gapMin: number | null;
  gapMax: number | null;
  sort: SortKey;
  dir: 'asc' | 'desc';
}

export const EMPTY_FILTERS: CatalogFilters = {
  q: '', category: [], elasticity: [], margin: [], stock: [], gapMin: null, gapMax: null, sort: 'sku', dir: 'asc',
};

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const num = (v: string | null) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

const SORT_KEYS: SortKey[] = ['sku', 'name', 'category', 'cost', 'price', 'competitorAvg', 'margin', 'elasticity', 'stock', 'lastChange'];

export function parseFilters(sp: URLSearchParams): CatalogFilters {
  const sort = sp.get('sort') as SortKey | null;
  return {
    q: sp.get('q') ?? '',
    category: list(sp.get('cat')),
    elasticity: list(sp.get('el')) as ElasticityBand[],
    margin: list(sp.get('mh')) as MarginHealth[],
    stock: list(sp.get('st')) as StockStatus[],
    gapMin: num(sp.get('gmin')),
    gapMax: num(sp.get('gmax')),
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'sku',
    dir: sp.get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

export function serializeFilters(f: CatalogFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set('q', f.q);
  if (f.category.length) sp.set('cat', f.category.join(','));
  if (f.elasticity.length) sp.set('el', f.elasticity.join(','));
  if (f.margin.length) sp.set('mh', f.margin.join(','));
  if (f.stock.length) sp.set('st', f.stock.join(','));
  if (f.gapMin !== null) sp.set('gmin', String(f.gapMin));
  if (f.gapMax !== null) sp.set('gmax', String(f.gapMax));
  if (f.sort !== 'sku') sp.set('sort', f.sort);
  if (f.dir !== 'asc') sp.set('dir', f.dir);
  return sp;
}

/** Number of active filter dimensions (sort excluded). */
export function activeFilterCount(f: CatalogFilters): number {
  return (
    (f.q ? 1 : 0) + (f.category.length ? 1 : 0) + (f.elasticity.length ? 1 : 0) + (f.margin.length ? 1 : 0) +
    (f.stock.length ? 1 : 0) + (f.gapMin !== null || f.gapMax !== null ? 1 : 0)
  );
}

export function applyFilters(products: Product[], f: CatalogFilters): Product[] {
  const q = f.q.trim().toLowerCase();
  return products.filter((p) => {
    if (q && !p.sku.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false;
    if (f.category.length && !f.category.includes(p.category)) return false;
    if (f.elasticity.length && !f.elasticity.includes(elasticityBand(p.elasticity))) return false;
    if (f.margin.length && !f.margin.includes(marginHealth(p))) return false;
    if (f.stock.length && !f.stock.includes(p.stockStatus)) return false;
    const gap = competitorGap(p) * 100;
    if (f.gapMin !== null && gap < f.gapMin) return false;
    if (f.gapMax !== null && gap > f.gapMax) return false;
    return true;
  });
}

const value: Record<SortKey, (p: Product) => string | number> = {
  sku: (p) => p.sku,
  name: (p) => p.name,
  category: (p) => p.category,
  cost: (p) => p.cost,
  price: (p) => p.price,
  competitorAvg: (p) => p.competitorAvg,
  margin: (p) => marginPct(p),
  elasticity: (p) => Math.abs(p.elasticity),
  stock: (p) => p.stockUnits,
  lastChange: (p) => p.lastChangeAt,
};

export function sortProducts(products: Product[], key: SortKey, dir: 'asc' | 'desc'): Product[] {
  const get = value[key];
  const sign = dir === 'asc' ? 1 : -1;
  return [...products].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return c * sign || a.sku.localeCompare(b.sku);
  });
}

export interface CatalogKpis {
  avgMargin: number;
  belowMap: number;
  pendingAi: number;
  avgGap: number;
}

/** All KPIs are computed from the already-filtered dataset. */
export function computeKpis(filtered: Product[], pendingSkus: Set<string>): CatalogKpis {
  const n = filtered.length || 1;
  return {
    avgMargin: filtered.reduce((s, p) => s + marginPct(p), 0) / n,
    belowMap: filtered.filter(belowMap).length,
    pendingAi: filtered.filter((p) => pendingSkus.has(p.sku)).length,
    avgGap: filtered.reduce((s, p) => s + competitorGap(p), 0) / n,
  };
}

export interface FilterPreset { name: string; query: string; builtIn?: boolean }

export const BUILT_IN_PRESETS: { key: 'presetRisk' | 'presetUndercut'; query: string }[] = [
  { key: 'presetRisk', query: 'mh=critical,thin' },
  { key: 'presetUndercut', query: 'gmin=5' },
];
