import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPLOY_LATENCY_MS, retryDeployment, triggerDeployment, willFail } from '@/lib/actions/deployment';
import { flagForModelReview, groupAnomalies } from '@/lib/actions/monitoring';
import { resetMestaData } from '@/lib/bootstrap';
import { selectAuditForUser } from '@/lib/audit-scope';
import type { AuditEvent, Role, UserSession } from '@/lib/ontology';
import {
  useAuditStore, useDeploymentStore, useMonitoringStore, useNotificationStore, useProductCatalogStore, useRecommendationStore,
} from '@/lib/stores';
import { eventLinks, filterAudit, toCsv, EMPTY_AUDIT_FILTERS } from '@/features/audit/audit-utils';
import { decisionsByCategory, gapByCategory, marginTrend, roleKpis } from '@/features/overview/kpis';
import { applyFilters, EMPTY_FILTERS, sortProducts } from '@/features/catalog/filters';
import { generateProducts } from '@/lib/mock-data';

const user = (role: Role, id = `u-${role}`): UserSession => ({ userId: id, name: role, role, ownedSkuIds: [] });
const ops = user('ops_lead');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 300 });
});
afterEach(() => vi.useRealTimers());

const deployable = () =>
  useRecommendationStore.getState().items.find(
    (r) => r.status === 'approved' && !r.deployed && !useDeploymentStore.getState().records.some((d) => d.recommendationId === r.id),
  )!;

describe('deployment', () => {
  it('is ops-lead only', () => {
    const r = deployable();
    expect(triggerDeployment(user('manager'), r.id)).toEqual({ ok: false, error: 'forbidden' });
    expect(triggerDeployment(user('analyst'), r.id)).toEqual({ ok: false, error: 'forbidden' });
  });

  it('seeds a failed record and approved recs appear as awaiting', () => {
    expect(useDeploymentStore.getState().records.some((d) => d.status === 'failed')).toBe(true);
    expect(deployable()).toBeDefined();
  });

  it('fans out to 4 channels, retries failures, then applies the price once with audit and outcome', () => {
    const r = deployable();
    const before = useProductCatalogStore.getState().products.find((p) => p.sku === r.sku)!;
    expect(triggerDeployment(ops, r.id).ok).toBe(true);
    const recs = () => useDeploymentStore.getState().records.filter((d) => d.recommendationId === r.id);
    expect(recs()).toHaveLength(4);
    expect(recs().every((d) => d.status === 'in_flight')).toBe(true);
    // in-flight rows are locked
    const inflight = recs()[0]!;
    expect(retryDeployment(ops, inflight.id)).toEqual({ ok: false, error: 'locked' });

    vi.advanceTimersByTime(DEPLOY_LATENCY_MS + 10);
    // retry every failed row until all synced
    for (let i = 0; i < 3 && recs().some((d) => d.status === 'failed'); i++) {
      recs().filter((d) => d.status === 'failed').forEach((d) => retryDeployment(ops, d.id));
      vi.advanceTimersByTime(DEPLOY_LATENCY_MS + 10);
    }
    expect(recs().every((d) => d.status === 'synced')).toBe(true);

    const after = useProductCatalogStore.getState().products.find((p) => p.sku === r.sku)!;
    expect(after.price).toBe(r.proposedPrice);
    expect(after.price).not.toBe(before.price);
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.deployed).toBe(true);
    const audits = useAuditStore.getState().events.filter((e) => e.type === 'deployment_success' && e.entityId === r.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.snapshot).toEqual({ oldPrice: before.price, newPrice: r.proposedPrice });
    expect(useMonitoringStore.getState().outcomes.some((o) => o.recommendationId === r.id && o.priceEventId)).toBe(true);
    expect(triggerDeployment(ops, r.id)).toEqual({ ok: false, error: 'not_deployable' });
  });

  it('willFail is deterministic and never fails a retry', () => {
    const a = { recommendationId: 'REC-1', channel: 'pos' as const, retryCount: 0 };
    expect(willFail(a)).toBe(willFail(a));
    expect(willFail({ ...a, retryCount: 1 })).toBe(false);
  });

  it('records failure audit and ops notification', () => {
    const recs = useRecommendationStore.getState().items.filter((r) => r.status === 'approved' && !r.deployed);
    for (const r of recs) triggerDeployment(ops, r.id);
    vi.advanceTimersByTime(DEPLOY_LATENCY_MS + 10);
    const failures = useAuditStore.getState().events.filter((e) => e.type === 'deployment_failure');
    if (failures.length) {
      expect(useNotificationStore.getState().items.some((n) => n.groupKey === 'deployment_failed')).toBe(true);
    }
    expect(failures.every((e) => e.entityType === 'deployment')).toBe(true);
  });
});

describe('monitoring', () => {
  it('12 same-category anomalies collapse into one digest group', () => {
    const bev = useMonitoringStore.getState().anomalies.filter((a) => a.category === 'Beverages' && Math.abs(a.deviationPercent) > 15);
    expect(bev.length).toBeGreaterThanOrEqual(10);
    const groups = groupAnomalies(bev);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(bev.length);
  });

  it('flag for model review updates state, audits, notifies and cannot repeat', () => {
    const a = useMonitoringStore.getState().anomalies[0]!;
    expect(flagForModelReview(user('ops_lead'), a.id)).toEqual({ ok: false, error: 'forbidden' });
    expect(flagForModelReview(user('analyst'), a.id).ok).toBe(true);
    expect(useMonitoringStore.getState().anomalies[0]!.flaggedForReview).toBe(true);
    expect(useAuditStore.getState().events.some((e) => e.type === 'model_review_feedback' && e.entityId === a.id)).toBe(true);
    expect(useNotificationStore.getState().items.some((n) => n.groupKey === 'model_review')).toBe(true);
    expect(flagForModelReview(user('analyst'), a.id)).toEqual({ ok: false, error: 'already_flagged' });
  });

  it('every outcome traces to a recommendation', () => {
    const recs = new Set(useRecommendationStore.getState().items.map((r) => r.id));
    for (const o of useMonitoringStore.getState().outcomes) expect(o.recommendationId && recs.has(o.recommendationId)).toBe(true);
  });
});

describe('audit scope and utilities', () => {
  const ev = (over: Partial<AuditEvent>): AuditEvent => ({
    id: 'A', type: 'manual_override', actorId: 'u-a1', actorRole: 'analyst', entityType: 'product', entityId: 'SKU-1', sku: 'SKU-1',
    source: 'ui', note: null, timestamp: '2026-09-20T10:00:00.000Z', ...over,
  });
  const events = [
    ev({ id: '1', actorId: 'u-a1' }),
    ev({ id: '2', actorId: 'u-a2' }),
    ev({ id: '3', actorId: 'u-ops', actorRole: 'ops_lead', entityType: 'deployment', type: 'deployment_success' }),
  ];

  it('two analysts never see each other via the selector', () => {
    const a1 = selectAuditForUser(events, user('analyst', 'u-a1')).map((e) => e.id);
    const a2 = selectAuditForUser(events, user('analyst', 'u-a2')).map((e) => e.id);
    expect(a1).toEqual(['1']);
    expect(a2).toEqual(['2']);
  });
  it('analyst also sees owned SKUs; ops sees only deployment; manager/compliance see all', () => {
    expect(selectAuditForUser(events, { ...user('analyst', 'u-a1'), ownedSkuIds: ['SKU-1'] }).map((e) => e.id)).toEqual(['1', '2', '3']);
    expect(selectAuditForUser(events, user('ops_lead')).map((e) => e.id)).toEqual(['3']);
    expect(selectAuditForUser(events, user('manager'))).toHaveLength(3);
    expect(selectAuditForUser(events, user('compliance'))).toHaveLength(3);
  });
  it('filters by date, actor, type, sku', () => {
    expect(filterAudit(events, { ...EMPTY_AUDIT_FILTERS, actor: 'u-a2' })).toHaveLength(1);
    expect(filterAudit(events, { ...EMPTY_AUDIT_FILTERS, from: '2026-09-21' })).toHaveLength(0);
    expect(filterAudit(events, { ...EMPTY_AUDIT_FILTERS, type: 'deployment_success' })).toHaveLength(1);
  });
  it('csv escapes quotes and commas; links follow entity type', () => {
    const csv = toCsv([ev({ note: 'said "hi", ok' })]);
    expect(csv.split('\n')[1]).toContain('"said ""hi"", ok"');
    expect(eventLinks(ev({ entityType: 'recommendation', entityId: 'REC-1' })).map((l) => l.href)).toContain('/recommendations/REC-1');
    expect(eventLinks(ev({ entityType: 'scenario', entityId: 'SCN-1' })).map((l) => l.href)).toContain('/simulation/SCN-1');
  });
});

describe('overview kpis', () => {
  const base = () => ({
    recs: useRecommendationStore.getState().items,
    audit: useAuditStore.getState().events,
    anomalies: useMonitoringStore.getState().anomalies,
    threshold: 15,
    strategies: [],
    deployments: useDeploymentStore.getState().records,
    breachCount: 2,
    lastDeploymentAt: null,
  });

  it('each role gets its own KPI set from the same stores', () => {
    const keys = (r: Role) => roleKpis({ ...base(), user: user(r) }).map((k) => k.key);
    expect(keys('analyst')).toContain('pendingApprovals');
    expect(keys('manager')).toContain('marginImpact');
    expect(keys('ops_lead')).toContain('channelFailures');
    expect(keys('compliance')).toContain('guardrailExceptions');
    expect(new Set([...keys('analyst'), ...keys('manager'), ...keys('ops_lead'), ...keys('compliance')]).size).toBeGreaterThanOrEqual(11);
  });

  it('values derive from data, not constants', () => {
    const failed = useDeploymentStore.getState().records.filter((d) => d.status === 'failed').length;
    const k = roleKpis({ ...base(), user: ops }).find((x) => x.key === 'channelFailures');
    expect(k?.value).toBe(failed);
    const pending = useRecommendationStore.getState().items.filter((r) => r.status === 'pending').length;
    expect(roleKpis({ ...base(), user: user('analyst') })[0]?.value).toBe(pending);
  });

  it('chart series come from stores', () => {
    const products = useProductCatalogStore.getState().products;
    expect(marginTrend(products)).toHaveLength(8);
    expect(gapByCategory(products).length).toBeGreaterThan(3);
    expect(decisionsByCategory(useRecommendationStore.getState().items, products).reduce((s, x) => s + x.value, 0))
      .toBe(useRecommendationStore.getState().items.filter((r) => r.status !== 'pending').length);
  });
});

describe('performance', () => {
  it('filters and sorts 5,000 SKUs well under a frame budget multiple', () => {
    const products = generateProducts(5000);
    const t0 = performance.now();
    const out = sortProducts(applyFilters(products, { ...EMPTY_FILTERS, category: ['Beverages', 'Dairy'], margin: ['thin', 'healthy'] }), 'price', 'desc');
    const ms = performance.now() - t0;
    expect(out.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(150);
  });
});
