import { checkPrice, governingStrategy, priceBounds, type PriceBounds, type PriceCheck } from '@/lib/guardrails';
import type { Product, Rule, Strategy } from '@/lib/ontology';
import { inRuleScope } from '@/lib/rules';

const DAY_MS = 86_400_000;

export type ConstraintId = 'bounds' | 'map' | 'max_change' | 'auto_approve' | 'margin_floor' | 'staleness';

export interface ConstraintRow {
  id: ConstraintId;
  /** SKUs this constraint governs in the current scope. */
  covered: number;
  /** SKUs currently violating it (observational constraints report 0). */
  breaches: number;
  /** False for catalog entries that are observed but not enforced. */
  enforced: boolean;
  /** e.g. "8" for an active maxChangePercent — rendered by the caller with units. */
  detail?: string | undefined;
}

export function catalogRows(products: Product[], strategies: Strategy[], rules: Rule[], now: number): ConstraintRow[] {
  const active = strategies.filter((s) => s.status === 'active');
  const marginRules = rules.filter((r) => r.status === 'active' && r.then.kind === 'min_margin_pct');

  const governed = products.map((p) => ({ p, s: governingStrategy(p, strategies) }));
  const underStrategy = governed.filter((g) => g.s !== null);
  const maxChange = active.map((s) => s.guardrail.maxChangePercent).filter((v) => v > 0);
  const thresholds = active.map((s) => s.guardrail.autoApproveThreshold).filter((v) => v > 0);

  const marginBreach = (p: Product) => {
    const floor = marginRules.filter((r) => inRuleScope(r, p)).map((r) => r.then.value);
    return floor.length > 0 && ((p.price - p.cost) / p.price) * 100 < Math.max(...floor);
  };

  return [
    {
      id: 'bounds', covered: products.length, enforced: true,
      breaches: governed.filter((g) => { const c = checkPrice(g.p, g.s, g.p.price); return c === 'below_min' || c === 'above_max' || c === 'exceeds_change'; }).length,
    },
    {
      id: 'map', enforced: true,
      covered: governed.filter((g) => priceBounds(g.p, g.s).mapEnforced).length,
      breaches: governed.filter((g) => priceBounds(g.p, g.s).mapEnforced && g.p.price < g.p.mapPrice).length,
    },
    {
      id: 'max_change', enforced: true, covered: underStrategy.filter((g) => g.s!.guardrail.maxChangePercent > 0).length,
      breaches: 0, detail: maxChange.length ? String(Math.max(...maxChange)) : undefined,
    },
    {
      id: 'auto_approve', enforced: false, covered: underStrategy.filter((g) => g.s!.guardrail.autoApproveThreshold > 0).length,
      breaches: 0, detail: thresholds.length ? String(Math.min(...thresholds)) : undefined,
    },
    {
      id: 'margin_floor', enforced: marginRules.length > 0,
      covered: products.filter((p) => marginRules.some((r) => inRuleScope(r, p))).length,
      breaches: products.filter(marginBreach).length,
    },
    {
      id: 'staleness', enforced: false, covered: products.length, breaches: 0,
      detail: String(Math.round(Math.max(0, ...products.map((p) => (now - new Date(p.lastChangeAt).getTime()) / DAY_MS)))),
    },
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
