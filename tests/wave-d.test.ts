import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decideOverride, requestOverride, triggerSourceSync } from '@/lib/actions/ops';
import { resetMestaData } from '@/lib/bootstrap';
import { deriveAlerts, deriveExceptions } from '@/lib/exceptions';
import type { Role, UserSession } from '@/lib/ontology';
import {
  useAuditStore, useDataSourceStore, useMonitoringStore, useNotificationStore, useOverrideRequestStore,
  useProductCatalogStore, useRecommendationStore, useDeploymentStore,
} from '@/lib/stores';

const user = (role: Role): UserSession => ({ userId: `u-${role}`, name: role, role, ownedSkuIds: [] });
const analyst = user('analyst');
const manager = user('manager');
const ops = user('ops_lead');
const compliance = user('compliance');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 40 });
});
afterEach(() => vi.useRealTimers());

const products = () => useProductCatalogStore.getState().products;
const overrides = () => useOverrideRequestStore.getState().requests;
const sources = () => useDataSourceStore.getState().sources;

describe('data sources', () => {
  it('seeds a deterministic source catalog with real signal', () => {
    const ids = sources().map((s) => s.id);
    expect(ids).toEqual(['DS-POS', 'DS-ECOM', 'DS-MKT', 'DS-COMP', 'DS-ERP']);
    expect(sources().some((s) => s.status === 'failed')).toBe(true);
    expect(sources().some((s) => s.rejectedRecords > 0)).toBe(true);
  });

  it('triggerSourceSync is ops-only, flips status, and completes after the sync window', () => {
    expect(triggerSourceSync(analyst, 'DS-POS')).toEqual({ ok: false, error: 'forbidden' });
    expect(triggerSourceSync(ops, 'DS-POS').ok).toBe(true);
    expect(sources().find((s) => s.id === 'DS-POS')?.status).toBe('syncing');
    expect(triggerSourceSync(ops, 'DS-POS')).toEqual({ ok: false, error: 'already_syncing' });
    vi.advanceTimersByTime(2_500);
    const s = sources().find((x) => x.id === 'DS-POS')!;
    expect(s.status).toBe('healthy');
    expect(s.rejectedRecords).toBe(0);
    expect(useAuditStore.getState().events.some((e) => e.type === 'datasource_sync' && e.entityId === 'DS-POS')).toBe(true);
    expect(triggerSourceSync(ops, 'DS-NOPE')).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('override request workflow', () => {
  const validPrice = () => {
    const p = products()[0]!;
    return { p, price: Math.min(Math.max(p.minPrice, Math.round(p.price * 0.97 / 100) * 100), p.maxPrice) };
  };

  it('files a request with audit + manager notification', () => {
    const { p, price } = validPrice();
    const r = requestOverride(analyst, p.sku, price, 'weekend promo match');
    expect(r.ok).toBe(true);
    const req = overrides().find((x) => x.sku === p.sku && x.status === 'pending')!;
    expect(req.requestedBy).toBe('u-analyst');
    expect(useAuditStore.getState().events.some((e) => e.type === 'override_request' && e.entityId === req.id)).toBe(true);
    expect(useNotificationStore.getState().items.some((n) => n.messageKey === 'common.notify.overrideRequested' && n.targetRole === 'manager')).toBe(true);
  });

  it('rejects invalid prices and empty reasons at the action layer', () => {
    const { p, price } = validPrice();
    expect(requestOverride(ops, p.sku, price, 'x')).toEqual({ ok: false, error: 'forbidden' });
    expect(requestOverride(analyst, p.sku, price, '  ')).toEqual({ ok: false, error: 'reason_required' });
    expect(requestOverride(analyst, p.sku, p.minPrice - 100, 'x')).toEqual({ ok: false, error: 'below_min' });
    expect(requestOverride(analyst, 'SKU-NOPE', price, 'x')).toEqual({ ok: false, error: 'not_found' });
  });

  it('manager approval applies the price and closes the request', () => {
    const { p, price } = validPrice();
    const r = requestOverride(analyst, p.sku, price, 'promo');
    if (!r.ok) throw new Error('request failed');
    expect(decideOverride(analyst, r.id, 'approved')).toEqual({ ok: false, error: 'forbidden' });
    expect(decideOverride(manager, r.id, 'approved', 'go ahead').ok).toBe(true);
    const req = overrides().find((x) => x.id === r.id)!;
    expect(req.status).toBe('approved');
    expect(req.decidedBy).toBe('u-manager');
    expect(products().find((x) => x.sku === p.sku)?.price).toBe(price);
    expect(useAuditStore.getState().events.some((e) => e.type === 'override_approve' && e.entityId === r.id)).toBe(true);
    // Decided requests are terminal.
    expect(decideOverride(manager, r.id, 'rejected')).toEqual({ ok: false, error: 'invalid_transition' });
  });

  it('rejection records the decision without touching the price', () => {
    const { p, price } = validPrice();
    const r = requestOverride(analyst, p.sku, price, 'promo');
    if (!r.ok) throw new Error('request failed');
    expect(decideOverride(manager, r.id, 'rejected', 'wait for ERP').ok).toBe(true);
    expect(products().find((x) => x.sku === p.sku)?.price).toBe(p.price);
    expect(useAuditStore.getState().events.some((e) => e.type === 'override_reject' && e.entityId === r.id)).toBe(true);
  });
});

describe('exceptions derivation', () => {
  const input = () => ({
    products: products(), competitors: useProductCatalogStore.getState().competitors,
    recs: useRecommendationStore.getState().items, overrides: overrides(),
  });

  it('unifies pending override requests into the exception feed', () => {
    const items = deriveExceptions(input());
    expect(items.some((x) => x.kind === 'override_request' && x.sku === products()[0]!.sku)).toBe(true);
  });

  it('aggregates missing competitor input per category', () => {
    // The 40-product seed is fully observed — remove one SKU's coverage to open the gap.
    const sku = products()[0]!.sku;
    const inp = { ...input(), competitors: input().competitors.filter((c) => c.sku !== sku) };
    const missing = deriveExceptions(inp).filter((x) => x.kind === 'missing_input');
    expect(missing).toHaveLength(1);
    expect(missing[0]!.category).toBe(products()[0]!.category);
    expect(missing[0]!.sku).toBeNull();
    expect(missing[0]!.count).toBe(1);
  });

  it('decided overrides leave the queue', () => {
    const req = overrides().find((x) => x.status === 'pending')!;
    expect(decideOverride(manager, req.id, 'rejected', 'no').ok).toBe(true);
    expect(deriveExceptions(input()).some((x) => x.id === `exc-ovr-${req.id}`)).toBe(false);
  });

  it('surfaces stale pending recommendations', () => {
    const items = deriveExceptions(input());
    // Seed data guarantees stale pending recs (13/15 were stale in earlier waves).
    expect(items.some((x) => x.kind === 'stale' || x.kind === 'breach')).toBe(true);
  });
});

describe('alert center derivation', () => {
  it('groups anomalies, deploy failures and data-quality issues by severity', () => {
    const items = deriveAlerts({
      anomalies: useMonitoringStore.getState().anomalies,
      deployments: useDeploymentStore.getState().records,
      sources: sources(),
    });
    expect(items.some((x) => x.kind === 'anomaly')).toBe(true);
    // Seeded deployment job has one failed channel record.
    expect(items.some((x) => x.kind === 'deploy_failure' && x.severity === 'critical')).toBe(true);
    // DS-COMP is failed, DS-MKT is delayed.
    expect(items.some((x) => x.kind === 'data_quality' && x.severity === 'critical')).toBe(true);
    // Sorted critical first.
    const sevRank = { critical: 0, warning: 1, info: 2 } as const;
    const ranks = items.map((x) => sevRank[x.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('clears data-quality alerts once a failed source re-syncs', () => {
    const before = deriveAlerts({ anomalies: [], deployments: [], sources: sources() });
    expect(before.some((x) => x.id === 'alert-ds-DS-COMP')).toBe(true);
    triggerSourceSync(ops, 'DS-COMP');
    vi.advanceTimersByTime(2_500);
    const after = deriveAlerts({ anomalies: [], deployments: [], sources: sources() });
    expect(after.some((x) => x.id === 'alert-ds-DS-COMP')).toBe(false);
  });
});
