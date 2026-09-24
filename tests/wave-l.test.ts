import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveExperiment, cancelExperiment, completeExperiment, concludeExperiment, readyExperiment,
  saveExperiment, startExperiment,
} from '@/lib/actions/experiment';
import { resetMestaData } from '@/lib/bootstrap';
import type { Role, UserSession } from '@/lib/ontology';
import { useAuditStore, useExperimentStore, useNotificationStore, useProductCatalogStore } from '@/lib/stores';

/**
 * Wave L — master-backlog deltas: the MESTA-EXP-004 experiment lifecycle,
 * MESTA-AL-004 notification actions, and the MESTA-COMP-003 status vocabulary.
 */

const user = (role: Role, userId = `u-${role}`): UserSession => ({ userId, name: role, role, ownedSkuIds: [] });
const manager = user('manager', 'u-manager-1');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 40 });
});
afterEach(() => vi.useRealTimers());

const experiments = () => useExperimentStore.getState().items;
const products = () => useProductCatalogStore.getState().products;

function makeDraft() {
  const p = products()[0]!;
  const r = saveExperiment(manager, { name: 'L draft', hypothesis: 'h', skuIds: [p.sku], deltaPct: 5 }, null);
  if (!r.ok) throw new Error('draft not saved');
  return r.experiment.id;
}

describe('experiment lifecycle (MESTA-EXP-004)', () => {
  it('walks draft → ready → running → completed → concluded → archived', () => {
    const id = makeDraft();
    const status = () => experiments().find((e) => e.id === id)!.status;

    expect(readyExperiment(manager, id).ok).toBe(true);
    expect(status()).toBe('ready');
    expect(startExperiment(manager, id).ok).toBe(true);
    expect(status()).toBe('running');
    expect(completeExperiment(manager, id).ok).toBe(true);
    expect(status()).toBe('completed');
    expect(concludeExperiment(manager, id).ok).toBe(true);
    expect(status()).toBe('concluded');
    expect(archiveExperiment(manager, id).ok).toBe(true);
    expect(status()).toBe('archived');
  });

  it('rejects out-of-order transitions', () => {
    const id = makeDraft();
    // draft cannot jump straight to completed or archived
    expect(completeExperiment(manager, id)).toEqual({ ok: false, error: 'invalid' });
    expect(archiveExperiment(manager, id)).toEqual({ ok: false, error: 'invalid' });
    // archived is terminal
    expect(readyExperiment(manager, id).ok).toBe(true);
    expect(startExperiment(manager, id).ok).toBe(true);
    expect(completeExperiment(manager, id).ok).toBe(true);
    expect(concludeExperiment(manager, id).ok).toBe(true);
    expect(archiveExperiment(manager, id).ok).toBe(true);
    expect(cancelExperiment(manager, id)).toEqual({ ok: false, error: 'invalid' });
  });

  it('records an audit event for every lifecycle step', () => {
    const id = makeDraft();
    readyExperiment(manager, id);
    startExperiment(manager, id);
    completeExperiment(manager, id);
    concludeExperiment(manager, id);
    archiveExperiment(manager, id);
    const types = useAuditStore.getState().events.filter((e) => e.entityId === id).map((e) => e.type);
    expect(types).toContain('experiment_ready');
    expect(types).toContain('experiment_complete');
    expect(types).toContain('experiment_archive');
  });

  it('stamps endedAt when the run window closes', () => {
    const id = makeDraft();
    startExperiment(manager, id);
    completeExperiment(manager, id);
    expect(experiments().find((e) => e.id === id)!.endedAt).not.toBeNull();
  });
});

describe('notification actions (MESTA-AL-004)', () => {
  const seed = () => {
    useNotificationStore.getState().push({ targetRole: 'manager', groupKey: 'g1', messageKey: 'common.notify.recPending', params: { sku: 'SKU-1' } });
    return useNotificationStore.getState().items[0]!;
  };

  it('acknowledges without losing the unread→read transition', () => {
    const n = seed();
    useNotificationStore.getState().acknowledge(n.id);
    const after = useNotificationStore.getState().items.find((i) => i.id === n.id)!;
    expect(after.acknowledged).toBe(true);
    expect(after.read).toBe(true);
  });

  it('snoozes until the given time', () => {
    const n = seed();
    const until = new Date(Date.now() + 3_600_000).toISOString();
    useNotificationStore.getState().snooze(n.id, until);
    expect(useNotificationStore.getState().items.find((i) => i.id === n.id)!.snoozedUntil).toBe(until);
  });

  it('escalates to the next role and records an audit event', () => {
    const n = seed();
    useNotificationStore.getState().escalate(n.id, manager);
    const items = useNotificationStore.getState().items;
    expect(items.find((i) => i.id === n.id)!.escalated).toBe(true);
    // A fresh copy is targeted at the escalation role (manager → approver).
    expect(items.some((i) => i.escalated && i.targetRole === 'approver')).toBe(true);
    expect(useAuditStore.getState().events.some((e) => e.type === 'notification_escalate')).toBe(true);
  });
});
