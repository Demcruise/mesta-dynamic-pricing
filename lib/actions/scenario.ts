import { checkPrice } from '../guardrails';
import type { Product, Recommendation, RationaleFactor, Strategy, UserSession } from '../ontology';
import { project } from '../projection';
import { can } from '../rbac';
import {
  useAuditStore, useNotificationStore, useProductCatalogStore, useRecommendationStore, useScenarioStore, useStrategyStore,
} from '../stores';
import { track } from '../telemetry';
import { fail, type Fail, type Ok } from './result';

type Inputs = { error: string } | { error?: undefined; product: Product; strategy: Strategy | null };

function inputs(sku: string, strategyId: string | null, price: number): Inputs {
  const product = useProductCatalogStore.getState().products.find((p) => p.sku === sku);
  if (!product) return { error: 'not_found' };
  const strategy = strategyId ? useStrategyStore.getState().items.find((s) => s.id === strategyId) ?? null : null;
  const check = checkPrice(product, strategy, price);
  if (check !== 'ok') return { error: check };
  return { product, strategy };
}

export function saveScenario(
  user: UserSession,
  input: { id?: string | null; sku: string; strategyId: string | null; proposedPrice: number },
) {
  if (!can(user.role, 'simulation.use')) return fail('forbidden');
  const v = inputs(input.sku, input.strategyId, input.proposedPrice);
  if (v.error !== undefined) return fail(v.error);
  const saved = useScenarioStore.getState().save({ ...input, ownerId: user.userId });
  return saved ? ({ ok: true, scenario: saved } as Ok & { scenario: typeof saved }) : fail('already_sent');
}

/** Sends a scenario to the queue exactly once: creates one recommendation, marks the scenario, audits. */
export function sendScenario(user: UserSession, scenarioId: string): (Ok & { recommendation: Recommendation }) | Fail {
  if (!can(user.role, 'simulation.use')) return fail('forbidden');
  const sc = useScenarioStore.getState().items.find((s) => s.id === scenarioId);
  if (!sc) return fail('not_found');
  if (sc.recommendationId) return fail('already_sent');
  const v = inputs(sc.sku, sc.strategyId, sc.proposedPrice);
  if (v.error !== undefined) return fail(v.error);
  const { product } = v;
  const base = project(product, product.price);
  const proj = project(product, sc.proposedPrice);
  const gap = product.competitorAvg > 0 ? (sc.proposedPrice - product.competitorAvg) / product.competitorAvg : 0;
  const rationale: RationaleFactor[] = [
    { key: 'competitor', weight: 0.35, detail: `Gap vs competitor avg ${(gap * 100).toFixed(1)}%` },
    { key: 'elasticity', weight: 0.35, detail: `Elasticity ${product.elasticity}, demand ${(proj.demandChange * 100).toFixed(1)}%` },
    { key: 'stock', weight: 0.2, detail: `${product.stockUnits} units on hand` },
    { key: 'seasonality', weight: 0.1, detail: 'Neutral seasonal index' },
  ];
  const rec: Recommendation = {
    id: `REC-${sc.id.replace('SCN-', 'S')}`,
    sku: sc.sku,
    currentPrice: product.price,
    proposedPrice: sc.proposedPrice,
    confidence: 70,
    source: 'simulation',
    status: 'pending',
    rationale,
    projectedMarginImpact: Math.round(proj.grossMargin - base.grossMargin),
    strategyId: sc.strategyId,
    scenarioId: sc.id,
    ruleId: null,
    ownerId: user.userId,
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decisionNote: null,
    deployed: false,
  };
  useRecommendationStore.getState().add(rec);
  useScenarioStore.getState().markSent(sc.id, rec.id);
  useAuditStore.getState().record({
    type: 'scenario_sent', actorId: user.userId, actorRole: user.role, entityType: 'scenario', entityId: sc.id,
    sku: sc.sku, source: 'ui', note: null, snapshot: { oldPrice: product.price, newPrice: sc.proposedPrice },
  });
  // Analyst → Manager handoff: the new recommendation needs a decision.
  useNotificationStore.getState().push({
    targetRole: 'manager', groupKey: `rec_pending:${rec.id}`, messageKey: 'common.notify.recPending',
    params: { sku: rec.sku }, href: `/recommendations/${rec.id}`,
  });
  track('scenario_sent', { scenarioId: sc.id });
  return { ok: true, recommendation: rec };
}
