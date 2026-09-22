import type { AuditEventType, Strategy, UserSession } from '../ontology';
import { can } from '../rbac';
import { hasBlocker, validateDraft, toDraft, type StrategyDraft } from '../strategy-rules';
import {
  useAuditStore, useNotificationStore, useProductCatalogStore, useStrategyStore,
} from '../stores';
import { fail, ok, type Fail, type Ok } from './result';

const find = (id: string) => useStrategyStore.getState().items.find((s) => s.id === id);

function audit(user: UserSession, type: AuditEventType, s: Strategy, note: string | null = null) {
  useAuditStore.getState().record({
    type, actorId: user.userId, actorRole: user.role, entityType: 'strategy', entityId: s.id, sku: null, source: 'ui', note,
  });
}

function nextId() {
  const max = useStrategyStore.getState().items.reduce((m, s) => Math.max(m, Number(s.id.replace('STR-', '')) || 0), 0);
  return `STR-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Create or update a strategy draft. Non-draft strategies can only be edited by users who
 * may activate. `expectedUpdatedAt` is the optimistic-concurrency token the editor captured
 * on open — a mismatch means someone saved in between and the write fails with 'conflict'.
 */
export function saveStrategy(user: UserSession, draft: StrategyDraft, id: string | null, opts: { expectedUpdatedAt?: string } = {}): (Ok & { strategy: Strategy }) | Fail {
  if (!can(user.role, 'strategy.create')) return fail('forbidden');
  const existing = id ? find(id) : undefined;
  if (id && !existing) return fail('not_found');
  if (existing && opts.expectedUpdatedAt !== undefined && existing.updatedAt !== opts.expectedUpdatedAt) return fail('conflict');
  if (existing && existing.status !== 'draft' && !can(user.role, 'strategy.activate')) return fail('forbidden');
  if (existing?.status === 'archived') return fail('archived');
  const strategy: Strategy = {
    ...draft,
    id: existing?.id ?? nextId(),
    status: existing?.status ?? 'draft',
    activateAt: existing?.activateAt ?? null,
    ownerId: existing?.ownerId ?? user.userId,
    updatedAt: new Date().toISOString(),
  };
  useStrategyStore.getState().upsert(strategy);
  return { ok: true, strategy };
}

function blockers(s: Strategy) {
  const st = useStrategyStore.getState();
  return hasBlocker(validateDraft(toDraft(s), st.items, useProductCatalogStore.getState().products, s.id));
}

export function submitStrategy(user: UserSession, id: string) {
  if (!can(user.role, 'strategy.create')) return fail('forbidden');
  const s = find(id);
  if (!s) return fail('not_found');
  if (blockers(s)) return fail('invalid');
  const r = useStrategyStore.getState().transition(id, 'pending_manager_approval');
  if (!r.ok) return r;
  audit(user, 'strategy_submit', s);
  useNotificationStore.getState().push({
    targetRole: 'manager', groupKey: 'strategy_pending', messageKey: 'common.notify.strategyPending', params: { name: s.name }, href: '/strategy',
  });
  return ok();
}

/**
 * Approve a pending strategy. With `opts.at` in the future the activation is parked as
 * `scheduled` — `promoteScheduledStrategies` fires it once the timestamp passes (the
 * frontend stand-in for a backend job runner, same convention as runScheduledJob).
 */
export function activateStrategy(user: UserSession, id: string, opts: { at?: string } = {}) {
  if (!can(user.role, 'strategy.activate')) return fail('forbidden');
  const s = find(id);
  if (!s) return fail('not_found');
  if (blockers(s)) return fail('invalid');
  if (opts.at && new Date(opts.at).getTime() > Date.now()) {
    const r = useStrategyStore.getState().schedule(id, opts.at);
    if (!r.ok) return r;
    audit(user, 'strategy_schedule', s, opts.at);
    useNotificationStore.getState().push({
      targetRole: 'analyst', groupKey: 'strategy_scheduled', messageKey: 'common.notify.strategyScheduled', params: { name: s.name }, href: '/strategy',
    });
    return ok();
  }
  const r = s.status === 'scheduled' ? useStrategyStore.getState().promote(id) : useStrategyStore.getState().transition(id, 'active');
  if (!r.ok) return r;
  audit(user, 'strategy_activate', s);
  useNotificationStore.getState().push({
    targetRole: 'analyst', groupKey: 'strategy_activated', messageKey: 'common.notify.strategyActive', params: { name: s.name }, href: '/strategy',
  });
  return ok();
}

/** Cancel a scheduled activation — the strategy returns to pending_manager_approval. */
export function unscheduleStrategy(user: UserSession, id: string) {
  if (!can(user.role, 'strategy.activate')) return fail('forbidden');
  const s = find(id);
  if (!s) return fail('not_found');
  const r = useStrategyStore.getState().clearSchedule(id);
  if (!r.ok) return r;
  audit(user, 'strategy_unschedule', s);
  return ok();
}

/**
 * Fires scheduled activations whose time has passed. Called once at bootstrap — the
 * honest stand-in for a scheduler, documented as such wherever the timestamp shows.
 */
export function promoteScheduledStrategies(now = Date.now()): number {
  const st = useStrategyStore.getState();
  let promoted = 0;
  for (const s of st.items) {
    if (s.status === 'scheduled' && s.activateAt && new Date(s.activateAt).getTime() <= now) {
      if (!useStrategyStore.getState().promote(s.id).ok) continue;
      promoted += 1;
      useAuditStore.getState().record({
        type: 'strategy_activate', actorId: 'system', actorRole: 'ops_lead', entityType: 'strategy',
        entityId: s.id, sku: null, source: 'system', note: 'scheduled activation fired',
      });
      useNotificationStore.getState().push({
        targetRole: 'analyst', groupKey: 'strategy_activated', messageKey: 'common.notify.strategyActive', params: { name: s.name }, href: '/strategy',
      });
    }
  }
  return promoted;
}

export function rejectStrategy(user: UserSession, id: string, note: string) {
  if (!can(user.role, 'strategy.activate')) return fail('forbidden');
  if (!note.trim()) return fail('note_required');
  const s = find(id);
  if (!s) return fail('not_found');
  const r = useStrategyStore.getState().transition(id, 'draft');
  if (!r.ok) return r;
  audit(user, 'strategy_reject', s, note.trim());
  useNotificationStore.getState().push({
    targetRole: 'analyst', groupKey: 'strategy_rejected', messageKey: 'common.notify.strategyRejected', params: { name: s.name, note: note.trim() }, href: '/strategy',
  });
  return ok();
}

export function archiveStrategy(user: UserSession, id: string) {
  if (!can(user.role, 'strategy.activate')) return fail('forbidden');
  return useStrategyStore.getState().transition(id, 'archived');
}

/** Restores an earlier version's content. Manager only; keeps the current status and records an audit event. */
export function rollbackStrategy(user: UserSession, id: string, versionIndex: number) {
  if (!can(user.role, 'strategy.activate')) return fail('forbidden');
  const s = find(id);
  if (!s) return fail('not_found');
  const r = useStrategyStore.getState().rollback(id, versionIndex);
  if (!r.ok) return r;
  audit(user, 'strategy_rollback', s, `version ${versionIndex + 1}`);
  return ok();
}
