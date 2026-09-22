import { checkPrice } from '../guardrails';
import type { Product, Recommendation, RecommendationStatus, UserSession } from '../ontology';
import { can } from '../rbac';
import {
  UNDO_WINDOW_MS, useAuditStore, useNotificationStore, useProductCatalogStore, useRecommendationStore, useStrategyStore, useUndoStore,
} from '../stores';
import { activeGrantFor } from '../stores/ops';
import { track } from '../telemetry';
import { fail, ok } from './result';

type Decision = 'approved' | 'rejected' | 'adjusted';
/** Statuses still awaiting a decision — pending, or escalated (higher priority, same outcome set). */
const DECIDABLE = new Set<RecommendationStatus>(['pending', 'escalated']);
/** A pending/escalated rec lapses to `expired` after this long without a decision. */
export const REC_TTL_MS = 7 * 86_400_000;
/** |projectedMarginImpact| above this (IDR) requires a manager decision — or an active delegation grant. */
export const HIGH_IMPACT_IDR = 100_000;

/** Second-level approval rule: high-impact recs need a manager unless a live grant covers the user. */
export function requiresManager(rec: Pick<Recommendation, 'projectedMarginImpact'>): boolean {
  return Math.abs(rec.projectedMarginImpact) >= HIGH_IMPACT_IDR;
}

export function canDecideHighImpact(user: UserSession): boolean {
  return user.role === 'manager' || activeGrantFor(user.userId) !== null;
}
const AUDIT_TYPE = {
  approved: 'recommendation_approve',
  rejected: 'recommendation_reject',
  adjusted: 'recommendation_adjust',
} as const;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Store errors carry context (`invalid_transition:a->b`); strip it before i18n lookup. */
const cleanError = (e: string) => e.split(':')[0] ?? e;

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
  // Approver → Ops handoff: an approved/adjusted recommendation is deployable.
  if (d.to === 'approved' || d.to === 'adjusted') {
    useNotificationStore.getState().push({
      targetRole: 'ops_lead', groupKey: `rec_ready:${recId}`, messageKey: 'common.notify.recReadyDeploy',
      params: { sku: rec.sku }, href: '/deployment',
    });
  }
}

/**
 * Stages a decision. It takes effect (and is audited) after the undo window,
 * unless undone. Enforces RBAC, note and guardrail rules regardless of UI state.
 */
export function stageDecision(
  user: UserSession, recId: string, to: Decision, opts: { note?: string; proposedPrice?: number; ackStale?: boolean } = {},
) {
  if (!can(user.role, 'recommendation.decide')) return fail('forbidden');
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recId);
  if (!rec) return fail('not_found');
  if (!DECIDABLE.has(rec.status)) return fail('not_pending');
  if (useUndoStore.getState().staged[recId]) return fail('already_staged');
  const note = opts.note?.trim() ?? '';
  if ((to === 'rejected' || to === 'adjusted') && !note) return fail('note_required');
  // Staleness re-check on approval: the product may have moved since the rec was formed.
  if (to === 'approved' && recommendationHealth(rec).stale && !opts.ackStale) return fail('stale');
  // Multi-level approval: high-impact changes need a manager (or a live delegation grant).
  if (to === 'approved' && requiresManager(rec) && !canDecideHighImpact(user)) return fail('requires_manager');
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
    if (!DECIDABLE.has(r.status) || staged[r.id] || r.confidence < minConfidence) continue;
    const h = recommendationHealth(r);
    if (h.stale) excluded.push({ rec: r, reason: 'stale' });
    else if (h.breach) excluded.push({ rec: r, reason: 'breach' });
    else eligible.push(r);
  }
  return { eligible, excluded, impact: eligible.reduce((s, r) => s + r.projectedMarginImpact, 0) };
}

export function bulkApprove(user: UserSession, recs: Recommendation[], minConfidence: number, onlyIds?: Set<string>) {
  if (!can(user.role, 'recommendation.bulk_approve')) return fail('forbidden');
  track('bulk_approval_initiated', { minConfidence });
  const { eligible } = bulkEligibility(recs, minConfidence);
  const targets = onlyIds ? eligible.filter((r) => onlyIds.has(r.id)) : eligible;
  let count = 0;
  for (const r of targets) {
    if (useRecommendationStore.getState().decide(r.id, 'approved').ok) {
      count++;
      useAuditStore.getState().record({
        type: 'recommendation_approve', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
        entityId: r.id, sku: r.sku, source: 'ui', note: 'bulk approval',
        snapshot: { oldPrice: r.currentPrice, newPrice: r.proposedPrice },
      });
    }
  }
  // Approver → Ops handoff: one grouped notification for the whole batch.
  if (count > 0) {
    useNotificationStore.getState().push({
      targetRole: 'ops_lead', groupKey: 'rec_bulk_ready', messageKey: 'common.notify.recBulkReady',
      params: { n: count }, href: '/deployment',
    });
  }
  return { ok: true as const, count };
}

/** Approver → Analyst: send a pending/escalated rec back with a note. Immediate — no undo window. */
export function requestChanges(user: UserSession, recId: string, note: string) {
  if (!can(user.role, 'recommendation.decide')) return fail('forbidden');
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recId);
  if (!rec) return fail('not_found');
  const res = useRecommendationStore.getState().decide(recId, 'changes_requested', { note });
  if (!res.ok) return fail(cleanError(res.error));
  useAuditStore.getState().record({
    type: 'recommendation_request_changes', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
    entityId: recId, sku: rec.sku, source: 'ui', note,
  });
  useNotificationStore.getState().push({
    targetRole: 'analyst', groupKey: `rec_changes:${recId}`, messageKey: 'common.notify.recChanges',
    params: { sku: rec.sku }, href: `/recommendations/${recId}`,
  });
  track('recommendation_changes_requested', { recId });
  return ok();
}

/** Anyone who can decide may escalate — the rec stays decidable but jumps the inbox. */
export function escalateRecommendation(user: UserSession, recId: string, note: string) {
  if (!can(user.role, 'recommendation.decide')) return fail('forbidden');
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recId);
  if (!rec) return fail('not_found');
  const res = useRecommendationStore.getState().decide(recId, 'escalated', { note });
  if (!res.ok) return fail(cleanError(res.error));
  useAuditStore.getState().record({
    type: 'recommendation_escalate', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
    entityId: recId, sku: rec.sku, source: 'ui', note: note || null,
  });
  useNotificationStore.getState().push({
    targetRole: 'manager', groupKey: `rec_escalated:${recId}`, messageKey: 'common.notify.recEscalated',
    params: { sku: rec.sku }, href: `/recommendations/${recId}`,
  });
  track('recommendation_escalated', { recId });
  return ok();
}

/** Returns a changes_requested/expired rec to pending. The re-check on approval then applies fresh. */
export function resubmitRecommendation(user: UserSession, recId: string, note = '') {
  if (!can(user.role, 'recommendation.decide')) return fail('forbidden');
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recId);
  if (!rec) return fail('not_found');
  const res = useRecommendationStore.getState().decide(recId, 'pending', { note });
  if (!res.ok) return fail(cleanError(res.error));
  useAuditStore.getState().record({
    type: 'recommendation_resubmit', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
    entityId: recId, sku: rec.sku, source: 'ui', note: note || null,
  });
  track('recommendation_resubmitted', { recId });
  return ok();
}

/**
 * Lapses recs that have waited longer than REC_TTL_MS into `expired`.
 * Called from the approvals inbox mount and bootstrap — a system sweep, audited as such.
 */
export function expireStaleRecommendations(now = Date.now()): number {
  const store = useRecommendationStore.getState();
  let n = 0;
  for (const r of store.items) {
    if (!DECIDABLE.has(r.status) && r.status !== 'changes_requested') continue;
    if (now - new Date(r.createdAt).getTime() < REC_TTL_MS) continue;
    if (useRecommendationStore.getState().decide(r.id, 'expired').ok) {
      n += 1;
      useAuditStore.getState().record({
        type: 'recommendation_expire', actorId: 'system', actorRole: 'compliance', entityType: 'recommendation',
        entityId: r.id, sku: r.sku, source: 'system', note: `Undecided for more than ${Math.round(REC_TTL_MS / 86_400_000)} days`,
      });
    }
  }
  return n;
}
