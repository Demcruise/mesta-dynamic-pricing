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

/** Create or update a strategy draft. Non-draft strategies can only be edited by users who may activate. */
export function saveStrategy(user: UserSession, draft: StrategyDraft, id: string | null): (Ok & { strategy: Strategy }) | Fail {
  if (!can(user.role, 'strategy.create')) return fail('forbidden');
  const existing = id ? find(id) : undefined;
  if (id && !existing) return fail('not_found');
  if (existing && existing.status !== 'draft' && !can(user.role, 'strategy.activate')) return fail('forbidden');
  if (existing?.status === 'archived') return fail('archived');
  const strategy: Strategy = {
    ...draft,
    id: existing?.id ?? nextId(),
    status: existing?.status ?? 'draft',
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
    targetRole: 'manager', groupKey: 'strategy_pending', message: `${s.name} awaits activation`, href: '/strategy',
  });
  return ok();
}

export function activateStrategy(user: UserSession, id: string) {
  if (!can(user.role, 'strategy.activate')) return fail('forbidden');
  const s = find(id);
  if (!s) return fail('not_found');
  if (blockers(s)) return fail('invalid');
  const r = useStrategyStore.getState().transition(id, 'active');
  if (!r.ok) return r;
  audit(user, 'strategy_activate', s);
  useNotificationStore.getState().push({
    targetRole: 'analyst', groupKey: 'strategy_activated', message: `${s.name} is now active`, href: '/strategy',
  });
  return ok();
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
    targetRole: 'analyst', groupKey: 'strategy_rejected', message: `${s.name} was returned: ${note.trim()}`, href: '/strategy',
  });
  return ok();
}

export function archiveStrategy(user: UserSession, id: string) {
  if (!can(user.role, 'strategy.activate')) return fail('forbidden');
  return useStrategyStore.getState().transition(id, 'archived');
}
