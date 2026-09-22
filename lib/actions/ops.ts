import { validatePrice } from '../domain';
import type { OverrideRequestStatus, UserSession } from '../ontology';
import { can } from '../rbac';
import { useAuditStore, useDataSourceStore, useDelegationStore, useNotificationStore, useOverrideRequestStore, useProductCatalogStore } from '../stores';
import { track } from '../telemetry';
import { fail, ok } from './result';

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DURATION_MS = 2_000;

export function cancelAllSyncTimers() {
  syncTimers.forEach((t) => clearTimeout(t));
  syncTimers.clear();
}

/**
 * Submits a manual price override for manager approval. Validates against product
 * bounds up front so a request can never carry a price applyPrice would refuse.
 */
export function requestOverride(user: UserSession, sku: string, requestedPrice: number, reason: string) {
  if (!can(user.role, 'override.request')) return fail('forbidden');
  const p = useProductCatalogStore.getState().products.find((x) => x.sku === sku);
  if (!p) return fail('not_found');
  const v = validatePrice(p, requestedPrice);
  if (v !== 'ok') return fail(v);
  const trimmed = reason.trim();
  if (!trimmed) return fail('reason_required');
  const id = `OVR-${Date.now().toString(36)}`;
  useOverrideRequestStore.getState().add({
    id, sku, requestedPrice, reason: trimmed, status: 'pending', requestedBy: user.userId,
    createdAt: new Date().toISOString(), decidedBy: null, decidedAt: null, decisionNote: null,
  });
  useAuditStore.getState().record({
    type: 'override_request', actorId: user.userId, actorRole: user.role, entityType: 'override',
    entityId: id, sku, source: 'ui', note: trimmed, snapshot: { oldPrice: p.price, newPrice: requestedPrice },
  });
  useNotificationStore.getState().push({
    targetRole: 'manager', groupKey: `override_req:${id}`, messageKey: 'common.notify.overrideRequested',
    params: { sku }, href: '/exceptions',
  });
  track('override_requested', { id });
  return { ok: true as const, id };
}

/** Manager decision on an override request. Approving applies the price immediately. */
export function decideOverride(user: UserSession, id: string, status: Exclude<OverrideRequestStatus, 'pending'>, note = '') {
  if (!can(user.role, 'override.decide')) return fail('forbidden');
  const req = useOverrideRequestStore.getState().requests.find((r) => r.id === id);
  if (!req) return fail('not_found');
  if (status === 'approved') {
    const p = useProductCatalogStore.getState().products.find((x) => x.sku === req.sku);
    // Re-validate at decision time — bounds may have moved since the request was filed.
    if (!p || validatePrice(p, req.requestedPrice) !== 'ok') return fail('stale');
    if (!useProductCatalogStore.getState().applyPrice(req.sku, req.requestedPrice, 'manual_override')) return fail('stale');
  }
  if (!useOverrideRequestStore.getState().decide(id, status, user.userId, note || null)) return fail('invalid_transition');
  useAuditStore.getState().record({
    type: status === 'approved' ? 'override_approve' : 'override_reject', actorId: user.userId, actorRole: user.role,
    entityType: 'override', entityId: id, sku: req.sku, source: 'ui', note: note || null,
    snapshot: { newPrice: req.requestedPrice },
  });
  useNotificationStore.getState().push({
    targetRole: 'analyst', groupKey: `override_dec:${id}`, messageKey: 'common.notify.overrideDecided',
    params: { sku: req.sku }, href: '/exceptions',
  });
  track(`override_${status}`, { id });
  return ok();
}

/**
 * Triggers a re-sync of a data source. The job completes after SYNC_DURATION_MS —
 * a frontend-only stand-in for a backend runner, same convention as runScheduledJob.
 */
export function triggerSourceSync(user: UserSession, sourceId: string) {
  if (!can(user.role, 'data.sync')) return fail('forbidden');
  const src = useDataSourceStore.getState().sources.find((s) => s.id === sourceId);
  if (!src) return fail('not_found');
  if (src.status === 'syncing' || syncTimers.has(sourceId)) return fail('already_syncing');
  useDataSourceStore.getState().patch(sourceId, { status: 'syncing' });
  syncTimers.set(sourceId, setTimeout(() => {
    syncTimers.delete(sourceId);
    useDataSourceStore.getState().patch(sourceId, {
      status: 'healthy', lastSyncAt: new Date().toISOString(), rejectedRecords: 0, coveragePct: 100,
    });
  }, SYNC_DURATION_MS));
  useAuditStore.getState().record({
    type: 'datasource_sync', actorId: user.userId, actorRole: user.role, entityType: 'datasource',
    entityId: sourceId, sku: null, source: 'ui', note: src.name,
  });
  track('datasource_sync', { sourceId });
  return ok();
}

/**
 * Grants a named user temporary authority to approve high-impact recommendations.
 * Manager-only; the grant is stored, audited, and expires at `until`.
 */
export function delegateApproval(user: UserSession, toUserId: string, hours: number) {
  if (!can(user.role, 'approval.delegate')) return fail('forbidden');
  if (!toUserId.trim() || toUserId === user.userId) return fail('invalid');
  const grant = {
    id: `DLG-${Date.now().toString(36)}`, toUserId: toUserId.trim(), grantedBy: user.userId,
    createdAt: new Date().toISOString(), until: new Date(Date.now() + hours * 3_600_000).toISOString(),
  };
  useDelegationStore.getState().add(grant);
  useAuditStore.getState().record({
    type: 'delegation_grant', actorId: user.userId, actorRole: user.role, entityType: 'delegation',
    entityId: grant.id, sku: null, source: 'ui', note: `${toUserId} · ${hours}h`,
  });
  track('delegation_granted', { id: grant.id });
  return { ok: true as const, grant };
}

export function revokeDelegation(user: UserSession, grantId: string) {
  if (!can(user.role, 'approval.delegate')) return fail('forbidden');
  if (!useDelegationStore.getState().revoke(grantId)) return fail('not_found');
  useAuditStore.getState().record({
    type: 'delegation_revoke', actorId: user.userId, actorRole: user.role, entityType: 'delegation',
    entityId: grantId, sku: null, source: 'ui', note: null,
  });
  return ok();
}
