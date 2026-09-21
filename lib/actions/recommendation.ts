import { checkPrice } from '../guardrails';
import type { Product, Recommendation, RecommendationStatus, UserSession } from '../ontology';
import { can } from '../rbac';
import {
  UNDO_WINDOW_MS, useAuditStore, useProductCatalogStore, useRecommendationStore, useStrategyStore, useUndoStore,
} from '../stores';
import { track } from '../telemetry';
import { fail, ok } from './result';

type Decision = Exclude<RecommendationStatus, 'pending'>;
const AUDIT_TYPE = {
  approved: 'recommendation_approve',
  rejected: 'recommendation_reject',
  adjusted: 'recommendation_adjust',
} as const;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function cancelAllDecisionTimers() {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  useUndoStore.getState().reset();
}

export interface Health {
  stale: boolean;
  breach: boolean;
}

/** Stale = the product price moved, or a newer competitor observation exists, since the recommendation was made. */
export function isStale(r: Recommendation, product: Product | undefined, latestCompetitorAt: string | null): boolean {
  if (!product) return true;
  if (product.price !== r.currentPrice) return true;
  return latestCompetitorAt !== null && latestCompetitorAt > r.createdAt;
}

export function hasBreach(r: Recommendation, product: Product | undefined): boolean {
  if (!product) return true;
  const strategy = r.strategyId ? useStrategyStore.getState().items.find((s) => s.id === r.strategyId) ?? null : null;
  return checkPrice(product, strategy, r.proposedPrice) !== 'ok';
}

export function recommendationHealth(r: Recommendation): Health {
  const cat = useProductCatalogStore.getState();
  const product = cat.products.find((p) => p.sku === r.sku);
  let latest: string | null = null;
  for (const c of cat.competitors) if (c.sku === r.sku && (latest === null || c.observedAt > latest)) latest = c.observedAt;
  return { stale: isStale(r, product, latest), breach: hasBreach(r, product) };
}

function commit(recId: string) {
  timers.delete(recId);
  const d = useUndoStore.getState().unstage(recId);
  if (!d) return;
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recId);
  const res = useRecommendationStore.getState().decide(recId, d.to, {
    ...(d.note ? { note: d.note } : {}),
    ...(d.proposedPrice !== null ? { proposedPrice: d.proposedPrice } : {}),
  });
  if (!res.ok || !rec) return;
  useAuditStore.getState().record({
    type: AUDIT_TYPE[d.to], actorId: d.actorId, actorRole: d.actorRole, entityType: 'recommendation', entityId: recId,
    sku: rec.sku, source: 'ui', note: d.note,
    snapshot: { oldPrice: rec.currentPrice, newPrice: d.proposedPrice ?? rec.proposedPrice },
  });
}

/**
 * Stages a decision. It takes effect (and is audited) after the undo window,
 * unless undone. Enforces RBAC, note and guardrail rules regardless of UI state.
 */
export function stageDecision(
  user: UserSession, recId: string, to: Decision, opts: { note?: string; proposedPrice?: number } = {},
) {
  if (!can(user.role, 'recommendation.decide')) return fail('forbidden');
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recId);
  if (!rec) return fail('not_found');
  if (rec.status !== 'pending') return fail('not_pending');
  if (useUndoStore.getState().staged[recId]) return fail('already_staged');
  const note = opts.note?.trim() ?? '';
  if ((to === 'rejected' || to === 'adjusted') && !note) return fail('note_required');
  if (to === 'adjusted') {
    const product = useProductCatalogStore.getState().products.find((p) => p.sku === rec.sku);
    const strategy = rec.strategyId ? useStrategyStore.getState().items.find((s) => s.id === rec.strategyId) ?? null : null;
    if (!product || opts.proposedPrice === undefined) return fail('invalid');
    const c = checkPrice(product, strategy, opts.proposedPrice);
    if (c !== 'ok') return fail(c);
  }
  useUndoStore.getState().stage({
    recId, to, note: note || null, proposedPrice: to === 'adjusted' ? (opts.proposedPrice as number) : null,
    actorId: user.userId, actorRole: user.role, expiresAt: Date.now() + UNDO_WINDOW_MS,
  });
  timers.set(recId, setTimeout(() => commit(recId), UNDO_WINDOW_MS));
  track(`recommendation_${to}`, { recId });
  return ok();
}

/** Cancels a staged decision: nothing was written to the audit log. */
export function undoDecision(recId: string) {
  const t = timers.get(recId);
  if (t) clearTimeout(t);
  timers.delete(recId);
  const d = useUndoStore.getState().unstage(recId);
  if (d) track('undo_used', { recId });
  return d ? ok() : fail('not_staged');
}

/** Approves immediately the eligible set; stale or guardrail-breaching items are excluded. */
export function bulkEligibility(recs: Recommendation[], minConfidence: number) {
  const staged = useUndoStore.getState().staged;
  const eligible: Recommendation[] = [];
  const excluded: { rec: Recommendation; reason: 'stale' | 'breach' }[] = [];
  for (const r of recs) {
    if (r.status !== 'pending' || staged[r.id] || r.confidence < minConfidence) continue;
    const h = recommendationHealth(r);
    if (h.stale) excluded.push({ rec: r, reason: 'stale' });
    else if (h.breach) excluded.push({ rec: r, reason: 'breach' });
    else eligible.push(r);
  }
  return { eligible, excluded, impact: eligible.reduce((s, r) => s + r.projectedMarginImpact, 0) };
}

export function bulkApprove(user: UserSession, recs: Recommendation[], minConfidence: number) {
  if (!can(user.role, 'recommendation.bulk_approve')) return fail('forbidden');
  track('bulk_approval_initiated', { minConfidence });
  const { eligible } = bulkEligibility(recs, minConfidence);
  let count = 0;
  for (const r of eligible) {
    if (useRecommendationStore.getState().decide(r.id, 'approved').ok) {
      count++;
      useAuditStore.getState().record({
        type: 'recommendation_approve', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
        entityId: r.id, sku: r.sku, source: 'ui', note: 'bulk approval',
        snapshot: { oldPrice: r.currentPrice, newPrice: r.proposedPrice },
      });
    }
  }
  return { ok: true as const, count };
}
