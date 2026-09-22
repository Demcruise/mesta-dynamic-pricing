import type { ConditionOp, Product, Rule, RuleCondition, RuleConditionField, RuleFormula } from './ontology';

const DAY_MS = 86_400_000;

/** Observed value for a condition field, derived from stored product data only. */
export function conditionValue(p: Product, field: RuleConditionField, now: number): number {
  switch (field) {
    case 'competitor_gap_pct':
      return p.competitorAvg > 0 ? (p.price / p.competitorAvg - 1) * 100 : 0;
    case 'margin_pct':
      return p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
    case 'stock_units':
      return p.stockUnits;
    case 'days_since_change':
      return (now - new Date(p.lastChangeAt).getTime()) / DAY_MS;
  }
}

export function evalCondition(c: RuleCondition, p: Product, now: number): boolean {
  const v = conditionValue(p, c.field, now);
  switch (c.op) {
    case 'lt': return v < c.value;
    case 'lte': return v <= c.value;
    case 'gt': return v > c.value;
    case 'gte': return v >= c.value;
    case 'eq': return Math.abs(v - c.value) < 1e-9;
  }
}

export function inRuleScope(rule: Rule, p: Product): boolean {
  const s = rule.scope;
  if (s.skus.length > 0 && !s.skus.includes(p.sku)) return false;
  if (s.categories.length > 0 && !s.categories.includes(p.category)) return false;
  if (s.regions.length > 0 && !s.regions.includes(p.region)) return false;
  return true;
}

/** THEN → proposed price, rounded to rupiah hundreds like the seed data. */
export function applyFormula(f: RuleFormula, p: Product): number {
  switch (f.kind) {
    case 'match_competitor':
      return Math.round((p.competitorAvg * (1 + f.value / 100)) / 100) * 100;
    case 'delta_percent':
      return Math.round((p.price * (1 + f.value / 100)) / 100) * 100;
    case 'min_margin_pct':
      // Price at which margin equals the floor: P = cost / (1 − margin).
      return Math.round((p.cost / Math.max(0.01, 1 - f.value / 100)) / 100) * 100;
  }
}

export interface RuleEvalResult {
  /** The rule that wins by priority — null when nothing fires. */
  winner: Rule | null;
  /** Rules that also fired at the winner's priority — a real conflict the UI must surface. */
  conflicts: Rule[];
  /** All rules whose scope + conditions matched, sorted by priority. */
  matched: Rule[];
  price: number | null;
}

export function evaluateProduct(p: Product, rules: Rule[], now: number): RuleEvalResult {
  const matched = rules
    .filter((r) => r.status === 'active' && inRuleScope(r, p) && r.when.every((c) => evalCondition(c, p, now)))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const winner = matched[0] ?? null;
  const conflicts = winner ? matched.filter((r) => r.priority === winner.priority && r.id !== winner.id) : [];
  return { winner, conflicts, matched, price: winner ? applyFormula(winner.then, p) : null };
}

/** Rules that overlap the same products — used by the builder's conflict warning. */
export function findConflicts(rules: Rule[], products: Product[], now: number): { ruleIds: string[]; sku: string }[] {
  const out: { ruleIds: string[]; sku: string }[] = [];
  for (const p of products) {
    const { winner, conflicts } = evaluateProduct(p, rules, now);
    if (winner && conflicts.length > 0) out.push({ sku: p.sku, ruleIds: [winner.id, ...conflicts.map((c) => c.id)] });
  }
  return out;
}

export const OPS: { op: ConditionOp; label: string }[] = [
  { op: 'lt', label: '<' }, { op: 'lte', label: '≤' }, { op: 'gt', label: '>' }, { op: 'gte', label: '≥' }, { op: 'eq', label: '=' },
];
