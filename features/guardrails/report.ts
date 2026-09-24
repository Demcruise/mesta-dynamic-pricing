import { checkPrice, governingStrategy, priceBounds, type PriceBounds, type PriceCheck } from '@/lib/guardrails';
import type { Product, Recommendation, Role, Rule, Strategy } from '@/lib/ontology';
import { inRuleScope } from '@/lib/rules';
import { PERMISSIONS } from '@/lib/rbac';
import { HIGH_IMPACT_IDR } from '@/lib/actions/recommendation';

const DAY_MS = 86_400_000;
/** Change-frequency guardrail horizon: a second price move inside this window is flagged. */
export const MIN_DAYS_BETWEEN_CHANGES = 7;

export type ConstraintId =
  | 'bounds' | 'map' | 'max_change' | 'auto_approve' | 'margin_floor' | 'staleness'
  | 'change_frequency' | 'inventory' | 'approval_threshold'
  | 'promotion' | 'regulatory' | 'channel';

/** Which layer configures a constraint (MESTA-GR-005). */
export type ConstraintScope = 'product' | 'strategy' | 'rule' | 'derived' | 'none';

export interface ConstraintConfig {
  /** Where the constraint is configured — not where it is evaluated. */
  scope: ConstraintScope;
  /** Names of the entities that configure it; empty for derived / not-modelled. */
  sources: string[];
  /** Latest updatedAt among the sources — the "last changed" clock. Null when not configured in-product. */
  lastChangedAt: string | null;
  /** Roles permitted to change it, read from RBAC. Empty = not editable in the product. */
  editableBy: readonly Role[];
  /** The constraint itself gates pricing changes behind an approval. */
  approvalRequired: boolean;
}

export interface ConstraintRow {
  id: ConstraintId;
  /** SKUs this constraint governs in the current scope. */
  covered: number;
  /** SKUs currently violating it (observational constraints report 0). */
  breaches: number;
  /** False for catalog entries that are observed but not enforced. */
  enforced: boolean;
  /** False for constraint types the demo data cannot express — rendered as "not modelled". */
  available: boolean;
  /** e.g. "8" for an active maxChangePercent — rendered by the caller with units. */
  detail?: string | undefined;
  /** Configuration provenance: who can change it, from what, and since when. */
  config: ConstraintConfig;
}

export function catalogRows(products: Product[], strategies: Strategy[], rules: Rule[], recs: Recommendation[], now: number): ConstraintRow[] {
  const active = strategies.filter((s) => s.status === 'active');
  const marginRules = rules.filter((r) => r.status === 'active' && r.then.kind === 'min_margin_pct');
  const pending = recs.filter((r) => r.status === 'pending' || r.status === 'escalated');

  const governed = products.map((p) => ({ p, s: governingStrategy(p, strategies) }));
  const underStrategy = governed.filter((g) => g.s !== null);
  const maxChange = active.map((s) => s.guardrail.maxChangePercent).filter((v) => v > 0);
  const thresholds = active.map((s) => s.guardrail.autoApproveThreshold).filter((v) => v > 0);

  const marginBreach = (p: Product) => {
    const floor = marginRules.filter((r) => inRuleScope(r, p)).map((r) => r.then.value);
    return floor.length > 0 && ((p.price - p.cost) / p.price) * 100 < Math.max(...floor);
  };

  const bySku = new Map(products.map((p) => [p.sku, p]));
  const names = (list: { name: string; updatedAt: string }[]) => list.map((s) => s.name);
  const latest = (list: { updatedAt: string }[]) => (list.length ? [...list].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)!.updatedAt : null);
  const mapStrategies = active.filter((s) => s.guardrail.mapEnforced);
  const thresholdStrategies = active.filter((s) => s.guardrail.autoApproveThreshold > 0);
  // MESTA-GR-005 configuration provenance, per constraint family.
  const CONFIG: Record<ConstraintId, ConstraintConfig> = {
    // Product bounds / MAP are seeded catalog data, then intersected with strategy bounds.
    bounds: { scope: 'product', sources: ['Product catalog', ...names(active)], lastChangedAt: latest(active), editableBy: [], approvalRequired: false },
    map: { scope: 'product', sources: ['Product catalog', ...names(mapStrategies)], lastChangedAt: latest(mapStrategies), editableBy: [], approvalRequired: false },
    max_change: { scope: 'strategy', sources: names(active.filter((s) => s.guardrail.maxChangePercent > 0)), lastChangedAt: latest(active), editableBy: PERMISSIONS['strategy.create'], approvalRequired: false },
    auto_approve: { scope: 'strategy', sources: names(thresholdStrategies), lastChangedAt: latest(thresholdStrategies), editableBy: PERMISSIONS['strategy.create'], approvalRequired: true },
    margin_floor: { scope: 'rule', sources: marginRules.map((r) => r.name), lastChangedAt: latest(marginRules.map((r) => ({ updatedAt: r.updatedAt }))), editableBy: PERMISSIONS['rule.manage'], approvalRequired: false },
    staleness: { scope: 'derived', sources: [], lastChangedAt: null, editableBy: [], approvalRequired: false },
    change_frequency: { scope: 'derived', sources: [], lastChangedAt: null, editableBy: [], approvalRequired: false },
    inventory: { scope: 'derived', sources: [], lastChangedAt: null, editableBy: [], approvalRequired: false },
    approval_threshold: { scope: 'strategy', sources: names(thresholdStrategies), lastChangedAt: latest(thresholdStrategies), editableBy: PERMISSIONS['strategy.create'], approvalRequired: true },
    promotion: { scope: 'none', sources: [], lastChangedAt: null, editableBy: [], approvalRequired: false },
    regulatory: { scope: 'none', sources: [], lastChangedAt: null, editableBy: [], approvalRequired: false },
    channel: { scope: 'none', sources: [], lastChangedAt: null, editableBy: [], approvalRequired: false },
  };
  const cfg = (id: ConstraintId) => CONFIG[id];
  return [
    {
      id: 'bounds', config: cfg('bounds'), covered: products.length, enforced: true, available: true,
      breaches: governed.filter((g) => { const c = checkPrice(g.p, g.s, g.p.price); return c === 'below_min' || c === 'above_max' || c === 'exceeds_change'; }).length,
    },
    {
      id: 'map', config: cfg('map'), enforced: true, available: true,
      covered: governed.filter((g) => priceBounds(g.p, g.s).mapEnforced).length,
      breaches: governed.filter((g) => priceBounds(g.p, g.s).mapEnforced && g.p.price < g.p.mapPrice).length,
    },
    {
      id: 'max_change', config: cfg('max_change'), enforced: true, available: true, covered: underStrategy.filter((g) => g.s!.guardrail.maxChangePercent > 0).length,
      breaches: 0, detail: maxChange.length ? String(Math.max(...maxChange)) : undefined,
    },
    {
      id: 'auto_approve', config: cfg('auto_approve'), enforced: false, available: true, covered: underStrategy.filter((g) => g.s!.guardrail.autoApproveThreshold > 0).length,
      breaches: 0, detail: thresholds.length ? String(Math.min(...thresholds)) : undefined,
    },
    {
      id: 'margin_floor', config: cfg('margin_floor'), enforced: marginRules.length > 0, available: true,
      covered: products.filter((p) => marginRules.some((r) => inRuleScope(r, p))).length,
      breaches: products.filter(marginBreach).length,
    },
    {
      id: 'staleness', config: cfg('staleness'), enforced: false, available: true, covered: products.length, breaches: 0,
      detail: String(Math.round(Math.max(0, ...products.map((p) => (now - new Date(p.lastChangeAt).getTime()) / DAY_MS)))),
    },
    {
      // Observed-only: a pending rec on a SKU repriced inside the quiet window is flagged, not blocked.
      id: 'change_frequency', config: cfg('change_frequency'), enforced: false, available: true, covered: products.length,
      breaches: pending.filter((r) => {
        const p = bySku.get(r.sku);
        return !!p && (now - new Date(p.lastChangeAt).getTime()) / DAY_MS < MIN_DAYS_BETWEEN_CHANGES;
      }).length,
      detail: String(MIN_DAYS_BETWEEN_CHANGES),
    },
    {
      // Observed-only: raising the price of a stockout/low-stock SKU can't sell more units.
      id: 'inventory', config: cfg('inventory'), enforced: false, available: true,
      covered: products.filter((p) => p.stockStatus !== 'in_stock').length,
      breaches: pending.filter((r) => {
        const p = bySku.get(r.sku);
        return !!p && p.stockStatus !== 'in_stock' && r.proposedPrice > p.price;
      }).length,
    },
    {
      // Policy surface: recs above the impact gate need elevated approval — coverage = pending recs.
      id: 'approval_threshold', config: cfg('approval_threshold'), enforced: true, available: true, covered: pending.length,
      breaches: 0, detail: String(HIGH_IMPACT_IDR),
    },
    // Not modelled: these constraint families need upstream data the demo catalogue doesn't carry.
    { id: 'promotion', config: cfg('promotion'), available: false, enforced: false, covered: 0, breaches: 0 },
    { id: 'regulatory', config: cfg('regulatory'), available: false, enforced: false, covered: 0, breaches: 0 },
    { id: 'channel', config: cfg('channel'), available: false, enforced: false, covered: 0, breaches: 0 },
  ];
}

export interface SkuGuardrailReport {
  product: Product;
  strategy: Strategy | null;
  rules: Rule[];
  bounds: PriceBounds;
  check: PriceCheck;
  marginPct: number;
  headroomPct: number;
  daysSinceChange: number;
}

export function skuReport(p: Product, strategies: Strategy[], rules: Rule[], now: number): SkuGuardrailReport {
  const strategy = governingStrategy(p, strategies);
  const bounds = priceBounds(p, strategy);
  return {
    product: p,
    strategy,
    rules: rules.filter((r) => r.status === 'active' && inRuleScope(r, p)),
    bounds,
    check: checkPrice(p, strategy, p.price),
    marginPct: p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0,
    headroomPct: p.price > 0 ? ((bounds.max - p.price) / p.price) * 100 : 0,
    daysSinceChange: Math.max(0, Math.round((now - new Date(p.lastChangeAt).getTime()) / DAY_MS)),
  };
}
