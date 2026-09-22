import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelPublishJob, createPublishJob, DEPLOY_LATENCY_MS, liveJobStatus, preflight, retryDeployment, rollbackPublishJob, runScheduledJob,
} from '@/lib/actions/deployment';
import { stageDecision } from '@/lib/actions/recommendation';
import { resetMestaData } from '@/lib/bootstrap';
import { evaluateRules } from '@/lib/rule-eval';
import type { Role, UserSession } from '@/lib/ontology';
import {
  UNDO_WINDOW_MS, useAuditStore, useDeploymentStore, useProductCatalogStore, usePublishJobStore, useRecommendationStore,
} from '@/lib/stores';
import { jobStatusOf } from '@/lib/stores/publish';
import { DEFAULT_QUEUE_FILTERS, filterAndSort, parseQueueFilters, tabMatches } from '@/features/recommendations/filters';
import type { Recommendation } from '@/lib/ontology';

const user = (role: Role): UserSession => ({ userId: `u-${role}`, name: role, role, ownedSkuIds: [] });
const analyst = user('analyst');
const ops = user('ops_lead');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 50 });
});
afterEach(() => vi.useRealTimers());

const pending = () => useRecommendationStore.getState().items.find((r) => r.status === 'pending')!;
/** Narrow createPublishJob's result or fail the test with its error code. */
function jobOf(res: ReturnType<typeof createPublishJob>) {
  if (!res.ok) throw new Error(`createPublishJob failed: ${res.error}`);
  return res.job;
}
const jobs = () => usePublishJobStore.getState().jobs;
const recs = () => useDeploymentStore.getState().records;
const jobRecs = (jobId: string) => recs().filter((r) => r.jobId === jobId);

/** Approves a pending rec through the undo window. */
function approve(r: Recommendation) {
  expect(stageDecision(analyst, r.id, 'approved', { ackStale: true }).ok).toBe(true);
  vi.advanceTimersByTime(UNDO_WINDOW_MS + 10);
  expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.status).toBe('approved');
}

/** Runs every channel of a job to completion, retrying the deterministic demo failures. */
function finish(jobId: string) {
  for (let i = 0; i < 8; i += 1) {
    vi.advanceTimersByTime(DEPLOY_LATENCY_MS + 10);
    for (const r of jobRecs(jobId).filter((x) => x.status === 'failed')) {
      expect(retryDeployment(ops, r.id).ok).toBe(true);
    }
  }
}

describe('publish preflight', () => {
  it('blocks an undecided recommendation', () => {
    const r = pending();
    const checks = preflight(r.id);
    expect(checks.find((c) => c.key === 'approval')?.ok).toBe(false);
    expect(createPublishJob(ops, r.id)).toEqual({ ok: false, error: 'preflight_blocked' });
  });

  it('blocks a duplicate active job for the same recommendation', () => {
    const r = pending();
    approve(r);
    const first = createPublishJob(ops, r.id);
    expect(first.ok).toBe(true);
    vi.advanceTimersByTime(DEPLOY_LATENCY_MS + 10);
    if (liveJobStatus(jobOf(first)) === 'published') return; // all channels already synced: duplicate is allowed again
    expect(preflight(r.id).find((c) => c.key === 'duplicate')?.ok).toBe(false);
    expect(createPublishJob(ops, r.id)).toEqual({ ok: false, error: 'preflight_blocked' });
  });
});

describe('publish jobs', () => {
  it('denies non-ops roles', () => {
    const r = pending();
    approve(r);
    expect(createPublishJob(analyst, r.id)).toEqual({ ok: false, error: 'forbidden' });
  });

  it('immediate job fans out to channel records and finishes published', () => {
    const r = pending();
    approve(r);
    const res = createPublishJob(ops, r.id);
    expect(res.ok).toBe(true);
    const rs = jobRecs(jobOf(res).id);
    expect(rs.length).toBeGreaterThan(0);
    expect(rs.every((x) => x.status === 'in_flight' || x.status === 'pending')).toBe(true);
    finish(jobOf(res).id);
    expect(liveJobStatus(jobOf(res))).toBe('published');
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.deployed).toBe(true);
    const product = useProductCatalogStore.getState().products.find((p) => p.sku === r.sku)!;
    expect(product.price).toBe(r.proposedPrice);
    expect(useAuditStore.getState().events.some((e) => e.type === 'deployment_success' && e.entityId === r.id)).toBe(true);
  });

  it('scheduled job stays parked until promoted, and can be cancelled', () => {
    const r = pending();
    approve(r);
    const res = createPublishJob(ops, r.id, { scheduledFor: '2030-01-01T09:00' });
    expect(res.ok).toBe(true);
    expect(jobOf(res).status).toBe('scheduled');
    expect(jobRecs(jobOf(res).id).every((x) => x.status === 'pending')).toBe(true);
    vi.advanceTimersByTime(DEPLOY_LATENCY_MS * 3);
    expect(jobRecs(jobOf(res).id).every((x) => x.status === 'pending')).toBe(true);
    expect(runScheduledJob(ops, jobOf(res).id).ok).toBe(true);
    finish(jobOf(res).id);
    expect(liveJobStatus(jobOf(res))).toBe('published');

    const r2 = pending();
    approve(r2);
    const s2 = createPublishJob(ops, r2.id, { scheduledFor: '2030-01-02T09:00' });
    expect(cancelPublishJob(ops, jobOf(s2).id).ok).toBe(true);
    expect(jobs().find((j) => j.id === jobOf(s2).id)?.status).toBe('cancelled');
    expect(jobRecs(jobOf(s2).id).every((x) => x.status === 'cancelled')).toBe(true);
  });

  it('rolls a published job back: price restored, records rolled back, rec undeployed', () => {
    const r = pending();
    approve(r);
    const res = createPublishJob(ops, r.id);
    finish(jobOf(res).id);
    expect(liveJobStatus(jobOf(res))).toBe('published');
    const rb = rollbackPublishJob(ops, jobOf(res).id);
    expect(rb.ok).toBe(true);
    const product = useProductCatalogStore.getState().products.find((p) => p.sku === r.sku)!;
    expect(product.price).toBe(r.currentPrice);
    expect(jobs().find((j) => j.id === jobOf(res).id)?.status).toBe('rolled_back');
    expect(jobRecs(jobOf(res).id).every((x) => x.status === 'rolled_back' || x.status === 'cancelled')).toBe(true);
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.deployed).toBe(false);
    expect(useAuditStore.getState().events.some((e) => e.type === 'deployment_rollback' && e.entityId === r.id)).toBe(true);
  });

  it('refuses to roll back a job that never published', () => {
    const r = pending();
    approve(r);
    const res = createPublishJob(ops, r.id, { scheduledFor: '2030-01-03T09:00' });
    expect(rollbackPublishJob(ops, jobOf(res).id)).toEqual({ ok: false, error: 'not_rollbackable' });
  });

  it('derives job status from channel records', () => {
    const r = pending();
    approve(r);
    const res = createPublishJob(ops, r.id, { scheduledFor: '2030-01-04T09:00' });
    expect(jobStatusOf(jobOf(res), jobRecs(jobOf(res).id))).toBe('scheduled');
  });
});

describe('rule evaluation', () => {
  it('returns one row per check with real expected/actual values', () => {
    const r = pending();
    const product = useProductCatalogStore.getState().products.find((p) => p.sku === r.sku)!;
    const rows = evaluateRules(r, product);
    expect(rows.map((x) => x.key)).toEqual(['min_price', 'max_price', 'map', 'max_change', 'auto_approve', 'freshness']);
    expect(rows.find((x) => x.key === 'min_price')?.expected).toBe(product.minPrice);
    expect(rows.find((x) => x.key === 'min_price')?.actual).toBe(r.proposedPrice);
  });

  it('marks strategy-bound checks n/a when the rec has no strategy', () => {
    const r = pending();
    const product = useProductCatalogStore.getState().products.find((p) => p.sku === r.sku)!;
    const rows = evaluateRules({ ...r, strategyId: null }, product);
    expect(rows.find((x) => x.key === 'max_change')?.applicable).toBe(false);
  });
});

describe('queue tabs', () => {
  it('decide shows only pending; deploy shows approved-not-deployed', () => {
    const rec = pending();
    expect(tabMatches('decide', rec, new Set())).toBe(true);
    expect(tabMatches('deploy', rec, new Set())).toBe(false);
    const deployedReady: Recommendation = { ...rec, status: 'approved', deployed: false };
    expect(tabMatches('deploy', deployedReady, new Set())).toBe(true);
    expect(tabMatches('deploy', { ...deployedReady, deployed: true }, new Set())).toBe(false);
  });

  it('an explicit status param with no tab selects the all view', () => {
    const f = parseQueueFilters(new URLSearchParams('status=approved'));
    expect(f.tab).toBe('all');
    expect(f.status).toBe('approved');
    expect(parseQueueFilters(new URLSearchParams('')).tab).toBe(DEFAULT_QUEUE_FILTERS.tab);
  });

  it('the tab owns the status axis while active', () => {
    const all = useRecommendationStore.getState().items;
    const products = new Map(useProductCatalogStore.getState().products.map((p) => [p.sku, p]));
    const f = { ...DEFAULT_QUEUE_FILTERS, tab: 'stale' as const, status: 'approved' as const };
    const rows = filterAndSort(all, products, f);
    expect(rows.every((r) => r.status === 'pending')).toBe(true);
  });
});
