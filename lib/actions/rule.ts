import type { Recommendation, Rule, RationaleFactorKey, UserSession } from '../ontology';
import { checkPrice, governingStrategy } from '../guardrails';
import { can } from '../rbac';
import { applyFormula, conditionValue, evaluateProduct } from '../rules';
import { useAuditStore, useNotificationStore, useProductCatalogStore, useRecommendationStore, useRuleStore, useStrategyStore } from '../stores';
import { track } from '../telemetry';
import { fail, ok, type Fail, type Result } from './result';

const FIELD_FACTOR: Record<string, RationaleFactorKey> = {
  competitor_gap_pct: 'competitor', stock_units: 'stock', margin_pct: 'rule', days_since_change: 'rule',
};

/**
 * Optimistic concurrency: pass the `updatedAt` observed when the editor opened.
 * If the stored rule changed since, the save fails closed with 'conflict'.
 */
export function saveRule(user: UserSession, rule: Rule, opts: { expectedUpdatedAt?: string } = {}): Result {
  if (!can(user.role, 'rule.manage')) return fail('forbidden');
  const existing = useRuleStore.getState().items.find((x) => x.id === rule.id);
  if (existing && opts.expectedUpdatedAt !== undefined && existing.updatedAt !== opts.expectedUpdatedAt) return fail('conflict');
  useRuleStore.getState().upsert({ ...rule, updatedAt: new Date().toISOString() });
  useAuditStore.getState().record({
    type: 'rule_save', actorId: user.userId, actorRole: user.role, entityType: 'rule', entityId: rule.id,
    sku: null, source: 'ui', note: rule.name,
  });
  return ok();
}

export function setRuleStatus(user: UserSession, id: string, status: Rule['status']): Result {
  if (!can(user.role, 'rule.manage')) return fail('forbidden');
  if (!useRuleStore.getState().items.some((r) => r.id === id)) return fail('not_found');
  useRuleStore.getState().patch(id, { status });
  useAuditStore.getState().record({
    type: 'rule_save', actorId: user.userId, actorRole: user.role, entityType: 'rule', entityId: id,
    sku: null, source: 'ui', note: status,
  });
  return ok();
}

export interface RunSummary {
  evaluated: number;
  created: number;
  /** Skipped: already pending, price unchanged, guardrail-blocked, or conflicting rules. */
  skipped: { pending: number; unchanged: number; guardrail: number; conflict: number };
  /** SKUs where multiple rules tied on the top priority — no rec created, needs a human. */
  conflicts: { sku: string; ruleIds: string[] }[];
}

/**
 * Runs every active rule over the catalogue and drafts recommendations for the winner's
 * price. Confidence is a transparent heuristic: 70 + 5 per satisfied condition (cap 95) —
 * rules are deterministic, so confidence reflects coverage, not a model estimate.
 */
export function runRules(user: UserSession): Fail | { ok: true; summary: RunSummary } {
  if (!can(user.role, 'rule.run')) return fail('forbidden');
  const now = Date.now();
  const cat = useProductCatalogStore.getState();
  const recStore = useRecommendationStore.getState();
  const rules = useRuleStore.getState().items;
  const strategies = useStrategyStore.getState().items;
  const pendingSkus = new Set(recStore.items.filter((r) => r.status === 'pending' || r.status === 'escalated' || r.status === 'changes_requested').map((r) => r.sku));
  const summary: RunSummary = { evaluated: 0, created: 0, skipped: { pending: 0, unchanged: 0, guardrail: 0, conflict: 0 }, conflicts: [] };
  const runId = now.toString(36);
  const created: Recommendation[] = [];

  for (const p of cat.products) {
    summary.evaluated += 1;
    const { winner, conflicts } = evaluateProduct(p, rules, strategies, cat.products, now);
    if (!winner) continue;
    if (conflicts.length > 0) {
      summary.skipped.conflict += 1;
      summary.conflicts.push({ sku: p.sku, ruleIds: [winner.id, ...conflicts.map((c) => c.id)] });
      continue;
    }
    if (pendingSkus.has(p.sku)) { summary.skipped.pending += 1; continue; }
    const price = applyFormula(winner.then, p);
    if (price === p.price) { summary.skipped.unchanged += 1; continue; }
    const strategy = governingStrategy(p, strategies);
    if (checkPrice(p, strategy, price) !== 'ok') { summary.skipped.guardrail += 1; continue; }

    const matchedConds = winner.when.map((c) => ({ c, v: conditionValue(p, c.field, now) }));
    const w = 1 / Math.max(1, matchedConds.length);
    const rec: Recommendation = {
      id: `REC-R${runId}-${p.sku}`,
      sku: p.sku,
      currentPrice: p.price,
      proposedPrice: price,
      confidence: Math.min(95, 70 + matchedConds.length * 5),
      source: 'agent',
      status: 'pending',
      rationale: matchedConds.map(({ c, v }) => ({
        key: FIELD_FACTOR[c.field] ?? 'rule',
        weight: Math.round(w * 100) / 100,
        detail: `${winner.id}: ${c.field} ${c.op} ${c.value} (observed ${Math.round(v * 10) / 10})`,
      })),
      projectedMarginImpact: Math.round((price - p.price) * p.stockUnits * 0.2),
      strategyId: strategy?.id ?? null,
      scenarioId: null,
      ruleId: winner.id,
      ownerId: winner.ownerId,
      createdAt: new Date(now).toISOString(),
      decidedAt: null,
      decisionNote: null,
      approvals: [],
      deployed: false,
    };
    recStore.add(rec);
    pendingSkus.add(p.sku);
    created.push(rec);
    summary.created += 1;
  }

  useAuditStore.getState().record({
    type: 'rule_run', actorId: user.userId, actorRole: user.role, entityType: 'rule', entityId: 'all',
    sku: null, source: 'ui',
    note: `${summary.created} recommendations · ${summary.conflicts.length} conflicts · ${summary.evaluated} SKUs evaluated`,
  });
  if (created.length > 0) {
    useNotificationStore.getState().push({
      targetRole: 'manager', groupKey: 'rule_run', messageKey: 'common.notify.ruleRun',
      params: { n: created.length }, href: '/recommendations',
    });
  }
  track('rule_run', { created: summary.created, conflicts: summary.conflicts.length });
  return { ok: true, summary };
}
