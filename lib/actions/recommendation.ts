import { checkPrice } from '../guardrails';
import type { Product, Recommendation, RecommendationStatus, Role, UserSession } from '../ontology';
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
/** Above this, the chain extends: manager level first, then the finance approver (APR-003). */
export const EXECUTIVE_IMPACT_IDR = 350_000;

/** Ordered approval levels a rec needs; empty = any decider approves directly. */
export function approvalChain(rec: Pick<Recommendation, 'projectedMarginImpact'>): Role[] {
  const a = Math.abs(rec.projectedMarginImpact);
  if (a >= EXECUTIVE_IMPACT_IDR) return ['manager', 'approver'];
  if (a >= HIGH_IMPACT_IDR) return ['manager'];
  return [];
}

/** The chain level still waiting for a decision — null when the chain is complete. */
export function pendingApprovalLevel(rec: Pick<Recommendation, 'projectedMarginImpact' | 'approvals'>): Role | null {
  return approvalChain(rec).find((l) => !rec.approvals.some((a) => a.level === l)) ?? null;
}

/** Second-level approval rule: high-impact recs need a manager unless a live grant covers the user. */
export function requiresManager(rec: Pick<Recommendation, 'projectedMarginImpact'>): boolean {
  return Math.abs(rec.projectedMarginImpact) >= HIGH_IMPACT_IDR;
}

/** Whether the user may satisfy a chain level. 'manager' accepts a live grant; 'approver' does not — separation of duties. */
export function canDecideAtLevel(user: UserSession, level: Role): boolean {
  if (level === 'manager') return user.role === 'manager' || activeGrantFor(user.userId) !== null;
  if (level === 'approver') return user.role === 'approver';
  return can(user.role, 'recommendation.decide');
}

export function canDecideHighImpact(user: UserSession): boolean {
  return canDecideAtLevel(user, 'manager');
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
    ...(d.level ? { step: { level: d.level, actorId: d.actorId, at: new Date().toISOString(), note: d.note } } : {}),
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
  // Multi-level approval chain: high impact needs a manager (or live grant); executive impact
  // additionally needs the finance approver afterwards. Mid-chain approvals record immediately.
  if (to === 'approved') {
    const level = pendingApprovalLevel(rec);
    if (level && !canDecideAtLevel(user, level)) return fail(level === 'approver' ? 'requires_approver' : 'requires_manager');
    if (level && approvalChain(rec).some((l) => l !== level && !rec.approvals.some((a) => a.level === l))) {
      const step = { level, actorId: user.userId, at: new Date().toISOString(), note: note || null };
      if (!useRecommendationStore.getState().recordApproval(recId, step)) return fail('invalid');
      useAuditStore.getState().record({
        type: 'recommendation_approve', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
        entityId: recId, sku: rec.sku, source: 'ui', note: `approval chain: ${level}`,
        snapshot: { oldPrice: rec.currentPrice, newPrice: rec.proposedPrice },
      });
      const next = pendingApprovalLevel({ ...rec, approvals: [...rec.approvals, step] });
      if (next) {
        useNotificationStore.getState().push({
          targetRole: next, groupKey: `rec_chain:${recId}:${next}`, messageKey: 'common.notify.recAwaitingLevel',
          params: { sku: rec.sku }, href: '/approvals',
        });
      }
      track('recommendation_chain_step', { recId, level });
      return { ok: true as const, awaiting: next };
    }
  }
  if (to === 'adjusted') {
    const product = useProductCatalogStore.getState().products.find((p) => p.sku === rec.sku);
    const strategy = rec.strategyId ? useStrategyStore.getState().items.find((s) => s.id === rec.strategyId) ?? null : null;
    if (!product || opts.proposedPrice === undefined) return fail('invalid');
    const c = checkPrice(product, strategy, opts.proposedPrice);
    if (c !== 'ok') return fail(c);
  }
  useUndoStore.getState().stage({
    recId, to, note: note || null, proposedPrice: to === 'adjusted' ? (opts.proposedPrice as number) : null,
    actorId: user.userId, actorRole: user.role,
    level: to === 'approved' ? pendingApprovalLevel(rec) : null,
    expiresAt: Date.now() + UNDO_WINDOW_MS,
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

/** Approves immediately the eligible set; stale, breaching, or still-chain-blocked items are excluded. */
export function bulkEligibility(recs: Recommendation[], minConfidence: number, user?: UserSession) {
  const staged = useUndoStore.getState().staged;
  const eligible: Recommendation[] = [];
  const excluded: { rec: Recommendation; reason: 'stale' | 'breach' | 'chain' }[] = [];
  for (const r of recs) {
    if (!DECIDABLE.has(r.status) || staged[r.id] || r.confidence < minConfidence) continue;
    const level = pendingApprovalLevel(r);
    const h = recommendationHealth(r);
    // A bulk approve must complete the chain in one step — a pending level the user can't
    // satisfy (or any level when later levels remain) excludes the item.
    if (level && (!user || !canDecideAtLevel(user, level) || approvalChain(r).length > 1)) excluded.push({ rec: r, reason: 'chain' });
    else if (h.stale) excluded.push({ rec: r, reason: 'stale' });
    else if (h.breach) excluded.push({ rec: r, reason: 'breach' });
    else eligible.push(r);
  }
  return { eligible, excluded, impact: eligible.reduce((s, r) => s + r.projectedMarginImpact, 0) };
}

export function bulkApprove(user: UserSession, recs: Recommendation[], minConfidence: number, onlyIds?: Set<string>) {
  if (!can(user.role, 'recommendation.bulk_approve')) return fail('forbidden');
  track('bulk_approval_initiated', { minConfidence });
  const { eligible } = bulkEligibility(recs, minConfidence, user);
  const targets = onlyIds ? eligible.filter((r) => onlyIds.has(r.id)) : eligible;
  let count = 0;
  for (const r of targets) {
    const level = pendingApprovalLevel(r);
    const step = level ? { level, actorId: user.userId, at: new Date().toISOString(), note: 'bulk approval' } : undefined;
    if (useRecommendationStore.getState().decide(r.id, 'approved', { ...(step ? { step } : {}) }).ok) {
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

/**
 * §17 bulk reject: applies 'rejected' with one shared note across selected decidable recs.
 * Immediate like requestChanges — a rejection is not undoable via the undo window.
 */
export function bulkReject(user: UserSession, recs: Recommendation[], note: string) {
  if (!can(user.role, 'recommendation.decide')) return fail('forbidden');
  if (!note.trim()) return fail('note_required');
  const staged = useUndoStore.getState().staged;
  let count = 0;
  for (const r of recs) {
    if (!DECIDABLE.has(r.status) || staged[r.id]) continue;
    if (!useRecommendationStore.getState().decide(r.id, 'rejected', { note }).ok) continue;
    count++;
    useAuditStore.getState().record({
      type: 'recommendation_reject', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
      entityId: r.id, sku: r.sku, source: 'ui', note: `bulk reject: ${note}`,
      snapshot: { oldPrice: r.currentPrice, newPrice: r.proposedPrice },
    });
  }
  track('bulk_reject', { n: count });
  return { ok: true as const, count };
}

/** §17 bulk escalate: jumps selected decidable recs to the escalated band with one note. */
export function bulkEscalate(user: UserSession, recs: Recommendation[], note: string) {
  if (!can(user.role, 'recommendation.decide')) return fail('forbidden');
  const staged = useUndoStore.getState().staged;
  let count = 0;
  for (const r of recs) {
    if (!DECIDABLE.has(r.status) || staged[r.id]) continue;
    if (!useRecommendationStore.getState().decide(r.id, 'escalated', { note: note || undefined }).ok) continue;
    count++;
    useAuditStore.getState().record({
      type: 'recommendation_escalate', actorId: user.userId, actorRole: user.role, entityType: 'recommendation',
      entityId: r.id, sku: r.sku, source: 'ui', note: note ? `bulk escalate: ${note}` : 'bulk escalate',
    });
  }
  if (count > 0) {
    useNotificationStore.getState().push({
      targetRole: 'manager', groupKey: 'rec_bulk_escalated', messageKey: 'common.notify.recBulkEscalated',
      params: { n: count }, href: '/approvals',
    });
  }
  track('bulk_escalate', { n: count });
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
