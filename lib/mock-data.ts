/**
 * Deterministic mock generators. ONLY lib/bootstrap.ts may import this file.
 * Pages read data through lib/queries/* hooks.
 */
import { CATEGORIES } from './categories';
import type {
  AuditEvent, CompetitorObservation, Product, RationaleFactor, Recommendation, Strategy,
} from './ontology';

export const NOW = Date.UTC(2026, 8, 21, 6, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** mulberry32: small seeded PRNG so every reload yields the same demo data. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOUNS: Record<string, string[]> = {
  Beverages: ['Teh Botol', 'Kopi Susu', 'Air Mineral', 'Jus Jeruk', 'Soda Lemon'],
  Snacks: ['Keripik Kentang', 'Biskuit Cokelat', 'Kacang Garing', 'Wafer Keju', 'Rumput Laut'],
  Dairy: ['Susu UHT', 'Yogurt Plain', 'Keju Slice', 'Mentega', 'Krimer'],
  'Personal Care': ['Sampo', 'Sabun Cair', 'Pasta Gigi', 'Deodoran', 'Lotion'],
  Household: ['Deterjen', 'Pel Lantai', 'Tisu Gulung', 'Sabun Cuci', 'Pewangi'],
  'Frozen Food': ['Nugget Ayam', 'Sosis Sapi', 'Bakso', 'Dimsum', 'Kentang Goreng'],
  Bakery: ['Roti Tawar', 'Roti Sobek', 'Donat', 'Bolu Gulung', 'Croissant'],
};
const SIZES = ['250ml', '500ml', '1L', '100g', '250g', '500g', '1kg'];
const COMPETITORS = ['Alfamart', 'Indomaret', 'Tokopedia', 'Shopee'];

export function skuId(i: number) {
  return `SKU-${String(1000 + i)}`;
}

export function generateProducts(count: number, seed = 42): Product[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const category = CATEGORIES[Math.floor(r() * CATEGORIES.length)] as string;
    const nouns = NOUNS[category] as string[];
    const noun = nouns[Math.floor(r() * nouns.length)] as string;
    const size = SIZES[Math.floor(r() * SIZES.length)] as string;
    const cost = Math.round((3000 + r() * 60000) / 100) * 100;
    const margin = 0.08 + r() * 0.35;
    const price = Math.round((cost * (1 + margin)) / 100) * 100;
    const competitorAvg = Math.round((price * (0.88 + r() * 0.24)) / 100) * 100;
    const stockUnits = r() < 0.04 ? 0 : Math.floor(r() * 600);
    const lastChangeAt = new Date(NOW - Math.floor(r() * 30 * DAY)).toISOString();
    const priceHistory = Array.from({ length: 8 }, (_, k) => ({
      at: new Date(NOW - (7 - k) * 4 * DAY).toISOString(),
      price: Math.round((price * (0.95 + r() * 0.1)) / 100) * 100,
    }));
    priceHistory[7] = { at: lastChangeAt, price };
    return {
      sku: skuId(i),
      name: `${noun} ${size}`,
      category,
      cost,
      price,
      minPrice: Math.round((cost * 1.03) / 100) * 100,
      maxPrice: Math.round((price * 1.35) / 100) * 100,
      mapPrice: Math.round((price * 0.92) / 100) * 100,
      competitorAvg,
      elasticity: -Math.round((0.4 + r() * 2.2) * 10) / 10,
      stockUnits,
      stockStatus: stockUnits === 0 ? 'out_of_stock' : stockUnits < 40 ? 'low_stock' : 'in_stock',
      lastChangeAt,
      priceHistory,
    } satisfies Product;
  });
}

export function generateCompetitors(products: Product[], seed = 7): CompetitorObservation[] {
  const r = rng(seed);
  const out: CompetitorObservation[] = [];
  for (const p of products.slice(0, 200)) {
    for (const c of COMPETITORS.slice(0, 2 + Math.floor(r() * 3))) {
      out.push({
        sku: p.sku,
        competitor: c,
        price: Math.round((p.competitorAvg * (0.95 + r() * 0.1)) / 100) * 100,
        observedAt: new Date(NOW - Math.floor(r() * 2 * DAY)).toISOString(),
      });
    }
  }
  return out;
}

function rationale(p: Product, r: () => number): RationaleFactor[] {
  const w = [r() + 0.5, r() + 0.3, r() + 0.2, r() + 0.1];
  const sum = w.reduce((a, b) => a + b, 0);
  const n = w.map((x) => Math.round((x / sum) * 100) / 100);
  return [
    { key: 'competitor', weight: n[0] as number, detail: `Competitor avg ${p.competitorAvg}` },
    { key: 'elasticity', weight: n[1] as number, detail: `Elasticity ${p.elasticity}` },
    { key: 'stock', weight: n[2] as number, detail: `${p.stockUnits} units on hand` },
    { key: 'seasonality', weight: n[3] as number, detail: 'Seasonal index +3%' },
  ];
}

export function generateRecommendations(products: Product[], count: number, seed = 99): Recommendation[] {
  const r = rng(seed);
  const out: Recommendation[] = [];
  const step = Math.max(1, Math.floor(products.length / count));
  for (let i = 0; i < count; i++) {
    const p = products[(i * step) % products.length] as Product;
    const dir = r() < 0.55 ? 1 : -1;
    const pct = 0.01 + r() * 0.07;
    const proposed = Math.round((p.price * (1 + dir * pct)) / 100) * 100;
    const status = i < count * 0.6 ? 'pending' : i < count * 0.8 ? 'approved' : 'rejected';
    out.push({
      id: `REC-${String(1000 + i)}`,
      sku: p.sku,
      currentPrice: p.price,
      proposedPrice: proposed,
      confidence: Math.round(50 + r() * 49),
      source: 'agent',
      status,
      rationale: rationale(p, r),
      projectedMarginImpact: Math.round((proposed - p.price) * (20 + r() * 80)),
      strategyId: null,
      scenarioId: null,
      createdAt: new Date(NOW - Math.floor(r() * 3 * DAY)).toISOString(),
      decidedAt: status === 'pending' ? null : new Date(NOW - Math.floor(r() * DAY)).toISOString(),
      decisionNote: status === 'rejected' ? 'Competitor data looked stale' : null,
      deployed: false,
    });
  }
  return out;
}

export function generateStrategies(): Strategy[] {
  const base = { ownerId: 'u-analyst-1', updatedAt: new Date(NOW - 2 * DAY).toISOString() };
  return [
    {
      ...base, id: 'STR-001', name: 'Beverage margin lift', objective: 'maximize_margin', skuIds: [],
      categories: ['Beverages'], status: 'active',
      guardrail: { minPrice: null, maxPrice: null, mapEnforced: true, maxChangePercent: 8, autoApproveThreshold: 90 },
    },
    {
      ...base, id: 'STR-002', name: 'Snack competitor match', objective: 'match_competitor', skuIds: [],
      categories: ['Snacks'], status: 'pending_manager_approval',
      guardrail: { minPrice: null, maxPrice: null, mapEnforced: true, maxChangePercent: 5, autoApproveThreshold: 85 },
    },
  ];
}

export function generateAudit(recs: Recommendation[]): AuditEvent[] {
  return recs
    .filter((x) => x.status !== 'pending')
    .map((x, i) => ({
      id: `AUD-${String(1000 + i)}`,
      type: x.status === 'approved' ? 'recommendation_approve' : 'recommendation_reject',
      actorId: 'u-analyst-1',
      actorRole: 'analyst',
      entityType: 'recommendation',
      entityId: x.id,
      sku: x.sku,
      source: 'ui',
      note: x.decisionNote,
      timestamp: x.decidedAt as string,
      snapshot: { oldPrice: x.currentPrice, newPrice: x.proposedPrice },
    }));
}
