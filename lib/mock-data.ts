/**
 * Deterministic mock generators. ONLY lib/bootstrap.ts may import this file.
 * Pages read data through lib/queries/* hooks.
 */
import { CATEGORIES } from './categories';
import { REGIONS, STORES_BY_REGION, type Region } from './scope';
import type {
  AnomalyAlert, AuditEvent, Channel, CompetitorObservation, DataSource, DeploymentRecord, Outcome,
  OverrideRequest, PriceEvent, Product, PublishJob, RationaleFactor, Recommendation, Rule, Strategy,
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
    const region = REGIONS[i % REGIONS.length] as Region;
    const storePool = STORES_BY_REGION[region];
    const store = storePool[Math.floor(i / REGIONS.length) % storePool.length] as string;
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
      region,
      store,
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
  let ruleLinked = 0;
  for (let i = 0; i < count; i++) {
    const p = products[(i * step) % products.length] as Product;
    const dir = r() < 0.55 ? 1 : -1;
    const pct = 0.01 + r() * 0.07;
    // Up to 3 recs are genuine RULE-001 outputs (match competitor when >5% above market):
    // the proposed price is exactly what the rule's formula produces AND passes the same
    // bounds check runRules applies — a seeded link must be a price the rule could emit.
    const gapPct = p.competitorAvg > 0 ? (p.price / p.competitorAvg - 1) * 100 : 0;
    const rulePrice = Math.round(p.competitorAvg / 100) * 100;
    const ruleFired = ruleLinked < 3 && gapPct > 5 && rulePrice >= p.minPrice && rulePrice >= p.mapPrice && rulePrice <= p.maxPrice;
    if (ruleFired) ruleLinked += 1;
    const proposed = ruleFired ? Math.round(p.competitorAvg / 100) * 100 : Math.round((p.price * (1 + dir * pct)) / 100) * 100;
    const status = i < count * 0.6 ? 'pending' : i < count * 0.8 ? 'approved' : 'rejected';
    out.push({
      id: `REC-${String(1000 + i)}`,
      sku: p.sku,
      currentPrice: p.price,
      proposedPrice: proposed,
      confidence: Math.round(50 + r() * 49),
      source: 'agent',
      status,
      rationale: ruleFired
        ? [{ key: 'rule', weight: 1, detail: `RULE-001: competitor_gap_pct > 5 (observed ${Math.round(gapPct * 10) / 10})` }]
        : rationale(p, r),
      projectedMarginImpact: Math.round((proposed - p.price) * (20 + r() * 80)),
      strategyId: null,
      scenarioId: null,
      ruleId: ruleFired ? 'RULE-001' : null,
      ownerId: 'agent',
      // The second rec is seeded 8 days old — past the 7-day decision TTL — so the
      // approvals inbox has a real `expired` row after the first expiry sweep.
      createdAt: new Date(NOW - (i === 1 ? 8 : Math.floor(r() * 3)) * DAY).toISOString(),
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

export function generateRules(): Rule[] {
  const base = { ownerId: 'u-analyst-1', updatedAt: new Date(NOW - 4 * DAY).toISOString() };
  return [
    {
      ...base, id: 'RULE-001', name: 'Match competitor when we are >5% above market', status: 'active', priority: 10,
      scope: { categories: [], regions: [], skus: [] },
      when: [{ field: 'competitor_gap_pct', op: 'gt', value: 5 }],
      then: { kind: 'match_competitor', value: 0 },
    },
    {
      ...base, id: 'RULE-002', name: 'Clear stock older than 20 days without a price move', status: 'active', priority: 20,
      scope: { categories: [], regions: ['Jawa'], skus: [] },
      when: [
        { field: 'stock_units', op: 'gt', value: 300 },
        { field: 'days_since_change', op: 'gt', value: 20 },
      ],
      then: { kind: 'delta_percent', value: -4 },
    },
    {
      ...base, id: 'RULE-003', name: 'Hold a 15% margin floor on thin-margin SKUs', status: 'draft', priority: 30,
      scope: { categories: [], regions: [], skus: [] },
      when: [{ field: 'margin_pct', op: 'lt', value: 15 }],
      then: { kind: 'min_margin_pct', value: 15 },
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

/** Marks the first `count` approved recommendations as already deployed and applies their prices. */
export function applySeedDeployments(products: Product[], recs: Recommendation[], count: number) {
  const r = rng(2026);
  const byId = new Map(products.map((p) => [p.sku, p]));
  const priceEvents: PriceEvent[] = [];
  const outcomes: Outcome[] = [];
  const nextRecs = recs.map((rec) => ({ ...rec }));
  let done = 0;
  for (const rec of nextRecs) {
    if (done >= count) break;
    if (rec.status !== 'approved') continue;
    const p = byId.get(rec.sku);
    if (!p || p.price !== rec.currentPrice) continue;
    const at = rec.decidedAt ?? new Date(NOW - DAY).toISOString();
    p.priceHistory = [...p.priceHistory.slice(0, -1), { at: p.lastChangeAt, price: rec.currentPrice }, { at, price: rec.proposedPrice }];
    p.price = rec.proposedPrice;
    p.lastChangeAt = at;
    rec.deployed = true;
    const pe: PriceEvent = { id: `PE-S${done + 1}`, sku: rec.sku, oldPrice: rec.currentPrice, newPrice: rec.proposedPrice, recommendationId: rec.id, source: 'deployment', at };
    priceEvents.push(pe);
    const units = BASE * Math.pow(rec.proposedPrice / rec.currentPrice, p.elasticity);
    const forecast = { units, revenue: units * rec.proposedPrice, margin: units * (rec.proposedPrice - p.cost) };
    const k = 0.8 + r() * 0.4;
    outcomes.push({
      id: `OUT-${1000 + done}`, sku: rec.sku, category: p.category, recommendationId: rec.id, priceEventId: pe.id, forecast,
      actual: { units: forecast.units * k, revenue: forecast.revenue * k, margin: forecast.margin * (0.85 + r() * 0.3) }, at,
    });
    done++;
  }
  return { products, recs: nextRecs, priceEvents, outcomes };
}

const BASE = 1000;

export function generateAnomalies(products: Product[]): AnomalyAlert[] {
  const r = rng(555);
  const out: AnomalyAlert[] = [];
  const channels: Channel[] = ['pos', 'ecommerce', 'marketplace_a', 'marketplace_b'];
  const bev = products.filter((p) => p.category === 'Beverages');
  const other = products.filter((p) => p.category !== 'Beverages');
  const mk = (p: Product, dev: number, i: number, strategyId: string | null): AnomalyAlert => ({
    id: `ANM-${1000 + i}`, sku: p.sku, category: p.category, deviationPercent: dev,
    severity: Math.abs(dev) >= 25 ? 'critical' : Math.abs(dev) >= 15 ? 'warning' : 'info',
    flaggedForReview: false, createdAt: new Date(NOW - Math.floor(r() * DAY)).toISOString(),
    channel: channels[Math.floor(r() * channels.length)] as Channel, strategyId,
  });
  bev.slice(0, 12).forEach((p, i) => out.push(mk(p, (r() < 0.5 ? -1 : 1) * (16 + Math.round(r() * 14)), i, 'STR-001')));
  other.slice(0, 20).forEach((p, i) => out.push(mk(p, (r() < 0.5 ? -1 : 1) * (4 + Math.round(r() * 30)), 12 + i, null)));
  return out;
}

export function generateDeployments(recs: Recommendation[]): { jobs: PublishJob[]; records: DeploymentRecord[] } {
  const target = recs.find((x) => x.status === 'approved' && !x.deployed);
  if (!target) return { jobs: [], records: [] };
  const at = new Date(NOW - HOUR).toISOString();
  const jobId = `PJ-${target.id}`;
  const statuses: DeploymentRecord['status'][] = ['synced', 'synced', 'failed', 'pending'];
  const records = (['pos', 'ecommerce', 'marketplace_a', 'marketplace_b'] as Channel[]).map((channel, i) => ({
    id: `DEP-${target.id}-${channel}`, recommendationId: target.id, jobId, sku: target.sku, channel, status: statuses[i] as DeploymentRecord['status'],
    retryCount: statuses[i] === 'failed' ? 1 : 0, errorReason: statuses[i] === 'failed' ? 'Marketplace API timeout' : null, updatedAt: at,
  }));
  // Two synced + one failed + one pending — a live partial-publish example out of the box.
  const jobs: PublishJob[] = [{
    id: jobId, recommendationId: target.id, sku: target.sku, status: 'publishing',
    scheduledFor: null, createdBy: 'u-ops-1', createdAt: at, updatedAt: at,
  }];
  return { jobs, records };
}

/** The upstream feeds the loop depends on. One degraded + one failed so Sync Health has real signal. */
export function generateDataSources(): DataSource[] {
  const mk = (id: string, name: string, kind: DataSource['kind'], status: DataSource['status'], ageMin: number, coveragePct: number, total: number, rejected: number): DataSource => ({
    id, name, kind, status, lastSyncAt: new Date(NOW - ageMin * 60_000).toISOString(),
    coveragePct, recordsTotal: total, rejectedRecords: rejected,
  });
  return [
    mk('DS-POS', 'POS price feed', 'pos_feed', 'healthy', 12, 99.4, 48_210, 6),
    mk('DS-ECOM', 'E-commerce catalog', 'ecommerce_feed', 'healthy', 8, 100, 12_904, 0),
    mk('DS-MKT', 'Marketplace listings', 'marketplace_feed', 'delayed', 190, 87.2, 9_412, 214),
    mk('DS-COMP', 'Competitor price scrape', 'competitor_feed', 'failed', 1_540, 61.8, 4_003, 1_120),
    mk('DS-ERP', 'ERP cost master', 'erp', 'paused', 4_300, 100, 500, 0),
  ];
}

/** A pending + a decided request so the exceptions queue shows both halves of the workflow. */
export function generateOverrideRequests(products: Product[]): OverrideRequest[] {
  const [a, b] = products;
  if (!a || !b) return [];
  return [
    {
      id: 'OVR-1001', sku: a.sku, requestedPrice: Math.round(a.price * 0.9 / 100) * 100,
      reason: 'Match weekend promo on marketplace', status: 'pending', requestedBy: 'u-analyst-1',
      createdAt: new Date(NOW - 5 * HOUR).toISOString(), decidedBy: null, decidedAt: null, decisionNote: null,
    },
    {
      id: 'OVR-1000', sku: b.sku, requestedPrice: Math.round(b.price * 1.05 / 100) * 100,
      reason: 'Supplier surcharge pass-through', status: 'rejected', requestedBy: 'u-analyst-1',
      createdAt: new Date(NOW - 2 * DAY).toISOString(), decidedBy: 'u-manager-1',
      decidedAt: new Date(NOW - 2 * DAY + 3 * HOUR).toISOString(), decisionNote: 'Rejected — wait for the cost master to update',
    },
  ];
}
