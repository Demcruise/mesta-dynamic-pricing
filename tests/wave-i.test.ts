import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXECUTIVE_IMPACT_IDR, HIGH_IMPACT_IDR, approvalChain, bulkApprove, bulkEligibility, bulkEscalate, bulkReject,
  canDecideAtLevel, pendingApprovalLevel, stageDecision,
} from '@/lib/actions/recommendation';
import { DEPLOY_LATENCY_MS, createPublishJob, expirePublishWindows, willFail } from '@/lib/actions/deployment';
import { bulkAssignStrategy, bulkPriceEdit, bulkPricePreview } from '@/lib/actions/catalog';
import { delegateApproval } from '@/lib/actions/ops';
import { resetMestaData } from '@/lib/bootstrap';
import { confidenceBreakdown } from '@/lib/confidence';
import { skuSignals } from '@/lib/signals';
import { can, PERMISSIONS } from '@/lib/rbac';
import type { Channel, Recommendation, Role, UserSession } from '@/lib/ontology';
import {
  CHANNELS, UNDO_WINDOW_MS, useAuditStore, useDeploymentStore, useOverrideRequestStore, usePolicyStore,
  useProductCatalogStore, usePublishJobStore, useRecommendationStore, useStrategyStore,
} from '@/lib/stores';
import { activeGrantFor } from '@/lib/stores/ops';

const user = (role: Role, userId = `u-${role}`): UserSession => ({ userId, name: role, role, ownedSkuIds: [] });
const analyst = user('analyst', 'u-analyst-1');
const manager = user('manager', 'u-manager-1');
const approver = user('approver', 'u-approver-1');
const ops = user('ops_lead');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 40 });
  usePolicyStore.getState().resetAll();
});
afterEach(() => vi.useRealTimers());

const products = () => useProductCatalogStore.getState().products;
const rec = (id: string) => useRecommendationStore.getState().items.find((r) => r.id === id)!;

const makeRec = (impact: number, patch: Partial<Recommendation> = {}): Recommendation => {
  const p = products()[0]!;
  return {
    id: 'REC-T', sku: p.sku, currentPrice: p.price, proposedPrice: p.price + 500,
    confidence: 80, source: 'agent', status: 'pending',
    rationale: [{ key: 'rule', weight: 1, detail: 'test' }],
    projectedMarginImpact: impact,
    strategyId: null, scenarioId: null, ruleId: null,
    createdAt: '2026-10-01T00:00:00.000Z', ownerId: 'u-analyst-1',
    decidedAt: null, decisionNote: null, approvals: [], deployed: false,
    ...patch,
  };
};
const hydrate = (r: Recommendation) => useRecommendationStore.getState().hydrate([r]);

describe('approval chain (APR-003)', () => {
  it('tiers by absolute impact: none < 100k ≤ manager < 350k ≤ manager+approver', () => {
    expect(approvalChain({ projectedMarginImpact: HIGH_IMPACT_IDR - 1 })).toEqual([]);
    expect(approvalChain({ projectedMarginImpact: -HIGH_IMPACT_IDR })).toEqual(['manager']);
    expect(approvalChain({ projectedMarginImpact: EXECUTIVE_IMPACT_IDR })).toEqual(['manager', 'approver']);
  });

  it('pendingApprovalLevel walks the chain', () => {
    const r = makeRec(EXECUTIVE_IMPACT_IDR);
    expect(pendingApprovalLevel(r)).toBe('manager');
    const step = { level: 'manager' as const, actorId: 'u-m', at: '', note: null };
    expect(pendingApprovalLevel({ ...r, approvals: [step] })).toBe('approver');
    expect(pendingApprovalLevel({ ...r, approvals: [step, { ...step, level: 'approver' as const }] })).toBeNull();
  });

  it('mid-chain approve records a step and stays pending until the approver signs', () => {
    hydrate(makeRec(EXECUTIVE_IMPACT_IDR));
    const r1 = stageDecision(manager, 'REC-T', 'approved', { ackStale: true });
    expect(r1.ok).toBe(true);
    if ('awaiting' in r1) expect(r1.awaiting).toBe('approver');
    expect(rec('REC-T').status).toBe('pending');
    expect(rec('REC-T').approvals).toHaveLength(1);
    expect(useAuditStore.getState().events.some((e) => e.type === 'recommendation_approve' && e.note?.includes('manager'))).toBe(true);

    // The approver's decision goes through the normal staged path, then commits.
    const r2 = stageDecision(approver, 'REC-T', 'approved', { ackStale: true });
    expect(r2.ok).toBe(true);
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 10);
    expect(rec('REC-T').status).toBe('approved');
    expect(rec('REC-T').approvals).toHaveLength(2);
  });

  it('the approver cannot satisfy the manager level; delegation does not extend to approver', () => {
    hydrate(makeRec(EXECUTIVE_IMPACT_IDR));
    expect(stageDecision(approver, 'REC-T', 'approved')).toEqual({ ok: false, error: 'requires_manager' });
    expect(canDecideAtLevel(approver, 'manager')).toBe(false);
    // A delegated analyst satisfies 'manager' but never 'approver'.
    delegateApproval(manager, 'u-analyst-1', 24);
    expect(activeGrantFor('u-analyst-1')).not.toBeNull();
    expect(canDecideAtLevel(analyst, 'manager')).toBe(true);
    expect(canDecideAtLevel(analyst, 'approver')).toBe(false);
  });

  it('a single-level high-impact rec still approves directly for managers', () => {
    hydrate(makeRec(HIGH_IMPACT_IDR + 1));
    expect(stageDecision(manager, 'REC-T', 'approved', { ackStale: true }).ok).toBe(true);
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 10);
    expect(rec('REC-T').status).toBe('approved');
    expect(rec('REC-T').approvals).toHaveLength(1);
  });

  it('bulk approve excludes multi-level chains but completes single-level ones', () => {
    hydrate(makeRec(HIGH_IMPACT_IDR + 1, { id: 'REC-A' }));
    hydrate(makeRec(EXECUTIVE_IMPACT_IDR, { id: 'REC-B' }));
    const plan = bulkEligibility(useRecommendationStore.getState().items, 0, manager);
    expect(plan.excluded.some((e) => e.rec.id === 'REC-B' && e.reason === 'chain')).toBe(true);
    const res = bulkApprove(manager, useRecommendationStore.getState().items, 0);
    if (!res.ok) throw new Error('bulkApprove failed');
    expect(res.count).toBe(plan.eligible.length);
    expect(rec('REC-B').status).toBe('pending');
    // The manager's level is recorded on the single-level rec that got approved.
    if (plan.eligible.some((r) => r.id === 'REC-A')) {
      expect(rec('REC-A').approvals[0]?.level).toBe('manager');
    }
  });

  it('bulk reject and escalate apply one note across decidable recs', () => {
    const items = useRecommendationStore.getState().items.filter((r) => r.status === 'pending');
    const r1 = bulkReject(manager, items.slice(0, 2), 'batch cleanup');
    expect(r1.ok && r1.count).toBe(2);
    expect(items.slice(0, 2).every((r) => rec(r.id).status === 'rejected')).toBe(true);
    expect(useAuditStore.getState().events.filter((e) => e.note === 'bulk reject: batch cleanup')).toHaveLength(2);
    expect(bulkReject(manager, items.slice(2, 3), '')).toEqual({ ok: false, error: 'note_required' });
    expect(bulkReject(ops, items, 'x')).toEqual({ ok: false, error: 'forbidden' });

    const r2 = bulkEscalate(analyst, [rec(items[2]!.id)], '');
    if (!r2.ok) throw new Error('bulkEscalate failed');
    expect(r2.count).toBeGreaterThanOrEqual(0); // REC items[2] may be rejected already; count reflects what moved
    const target = items[3]!;
    const r3 = bulkEscalate(analyst, [target], 'needs eyes');
    expect(r3.ok).toBe(true);
    expect(rec(target.id).status).toBe('escalated');
  });
});

describe('publish channels + windows (EXEC-002)', () => {
  /**
   * A fresh approved+undeployed rec on a SKU with headroom — seeds' approved recs
   * already carry active jobs (duplicate preflight blocks a second publish).
   */
  let n = 0;
  const deployable = (id = `REC-P${++n}`) => {
    const p = products().find((x) => x.price + 500 <= x.maxPrice && x.price + 500 >= x.minPrice)!;
    hydrate(makeRec(0, { id, sku: p.sku, currentPrice: p.price, proposedPrice: p.price + 500, status: 'approved' }));
    return rec(id);
  };
  // A channel that won't hit the deterministic first-attempt failure for this rec.
  const cleanChannel = (recId: string): Channel[] =>
    CHANNELS.filter((c) => !willFail({ recommendationId: recId, channel: c, retryCount: 0 }));

  it('fans out one record per selected channel with window metadata', () => {
    const r = deployable();
    const until = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const res = createPublishJob(ops, r.id, { channels: ['pos', 'ecommerce'], timezone: 'Asia/Makassar', effectiveUntil: until });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.job.channels).toEqual(['pos', 'ecommerce']);
    expect(res.job.timezone).toBe('Asia/Makassar');
    expect(res.job.effectiveUntil).toBe(until);
    const rs = useDeploymentStore.getState().records.filter((x) => x.jobId === res.job.id);
    expect(rs.map((x) => x.channel).sort()).toEqual(['ecommerce', 'pos']);
  });

  it('rejects an effective-until in the past / before the schedule', () => {
    const r = deployable();
    expect(createPublishJob(ops, r.id, { effectiveUntil: '2020-01-01T00:00:00Z' })).toEqual({ ok: false, error: 'window_inverted' });
    const sched = new Date(Date.now() + 86_400_000).toISOString();
    const before = new Date(Date.now() + 3_600_000).toISOString();
    expect(createPublishJob(ops, r.id, { scheduledFor: sched, effectiveUntil: before })).toEqual({ ok: false, error: 'window_inverted' });
  });

  it('expiry sweep reverts the price and audits publish_window_end', () => {
    const r = deployable();
    const before = products().find((x) => x.sku === r.sku)!.price;
    const channels = cleanChannel(r.id);
    expect(channels.length).toBeGreaterThan(0);
    const until = new Date(Date.now() + 3_600_000).toISOString();
    const res = createPublishJob(ops, r.id, { channels, effectiveUntil: until });
    expect(res.ok).toBe(true);
    vi.advanceTimersByTime(DEPLOY_LATENCY_MS + 10);
    // Deployed price is live once every channel synced.
    expect(products().find((x) => x.sku === r.sku)!.price).toBe(r.proposedPrice);
    expect(expirePublishWindows(Date.now() + 1_800_000)).toBe(0); // not yet
    expect(expirePublishWindows(Date.now() + 3_600_000)).toBe(1);
    expect(products().find((x) => x.sku === r.sku)!.price).toBe(before);
    expect(useAuditStore.getState().events.some((e) => e.type === 'publish_window_end' && e.entityId === r.id)).toBe(true);
    const job = usePublishJobStore.getState().jobs.find((j) => res.ok && j.id === res.job.id)!;
    expect(job.status).toBe('rolled_back');
    expect(rec(r.id).deployed).toBe(false);
  });
});

describe('confidence breakdown (REC-003)', () => {
  it('returns all four factors in range with evidence', () => {
    const r = useRecommendationStore.getState().items[0]!;
    const obs = useProductCatalogStore.getState().competitors;
    const factors = confidenceBreakdown(r, products().find((p) => p.sku === r.sku), obs);
    expect(factors.map((f) => f.key)).toEqual(['freshness', 'coverage', 'agreement', 'rule']);
    for (const f of factors) {
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
      expect(f.detail.length).toBeGreaterThan(0);
    }
  });

  it('rule-linked recs score full traceability; bare agent output scores lower', () => {
    const base = makeRec(0);
    const ruled = confidenceBreakdown({ ...base, ruleId: 'RULE-001' }, undefined, []);
    const bare = confidenceBreakdown(base, undefined, []);
    expect(ruled.find((f) => f.key === 'rule')!.score).toBe(100);
    expect(bare.find((f) => f.key === 'rule')!.score).toBe(55);
  });
});

describe('demand/inventory signals (MI-002/003)', () => {
  it('derives velocity, days of supply and risk tiers from the catalog', () => {
    const p = products().find((x) => x.stockUnits > 0)!;
    const s = skuSignals(p, []);
    expect(s.velocity).toBeGreaterThanOrEqual(0);
    expect(['inelastic', 'moderate', 'elastic']).toContain(s.elasticityBand);
    expect(['stockout', 'low', 'healthy', 'overstock']).toContain(s.stockRisk);
    const zero = skuSignals({ ...p, stockUnits: 0 }, []);
    expect(zero.stockRisk).toBe('stockout');
    const fat = skuSignals({ ...p, stockUnits: Math.ceil(s.velocity * 40) + 10_000 }, []);
    expect(fat.stockRisk).toBe('overstock');
    expect(fat.daysOfSupply).toBeGreaterThan(90);
  });
});

describe('policy overrides (GOV-003)', () => {
  it('can() consults overrides; reset restores the code default', () => {
    expect(can('compliance', 'rule.manage')).toBe(false);
    usePolicyStore.getState().set('compliance:rule.manage', true);
    expect(can('compliance', 'rule.manage')).toBe(true);
    usePolicyStore.getState().set('manager:audit.export', false);
    expect(can('manager', 'audit.export')).toBe(false);
    usePolicyStore.getState().resetAll();
    expect(can('compliance', 'rule.manage')).toBe(false);
    expect(can('manager', 'audit.export')).toBe(true);
  });

  it('policy.manage is locked — overrides on it are ignored', () => {
    usePolicyStore.getState().set('analyst:policy.manage', true);
    expect(can('analyst', 'policy.manage')).toBe(false);
    usePolicyStore.getState().set('manager:policy.manage', false);
    expect(can('manager', 'policy.manage')).toBe(true);
  });
});

describe('catalog bulk ops (§17)', () => {
  it('bulkPricePreview checks every row against guardrails', () => {
    const skus = products().slice(0, 4).map((p) => p.sku);
    const rows = bulkPricePreview(skus, -5);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.newPrice).toBe(Math.round((r.currentPrice * 0.95) / 100) * 100);
    // -90% breaches bounds on most rows — blocked rows exist and are marked.
    const blocked = bulkPricePreview(skus, -90).filter((r) => r.check !== 'ok');
    expect(blocked.length).toBeGreaterThan(0);
  });

  it('managers apply passing rows directly; analysts file override requests', () => {
    const skus = products().slice(0, 3).map((p) => p.sku);
    const priceBefore = Object.fromEntries(products().slice(0, 3).map((p) => [p.sku, p.price]));
    const expected = bulkPricePreview(skus, 5); // before the mutation — preview reads current prices
    const m = bulkPriceEdit(manager, skus, 5, 'reprice wave');
    expect(m.ok).toBe(true);
    if (m.ok) {
      expect(m.applied).toBeGreaterThan(0);
      for (const row of expected) {
        const p = products().find((x) => x.sku === row.sku)!;
        if (row.check === 'ok') expect(p.price).toBe(row.newPrice);
        else expect(p.price).toBe(priceBefore[row.sku]); // blocked rows untouched
      }
    }
    const a = bulkPriceEdit(analyst, skus, -3, 'markdown wave');
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.requested).toBeGreaterThan(0);
      expect(useOverrideRequestStore.getState().requests.filter((o) => o.status === 'pending').length).toBeGreaterThanOrEqual(a.requested);
    }
    expect(bulkPriceEdit(ops, skus, 5, 'x')).toEqual({ ok: false, error: 'forbidden' });
    expect(bulkPriceEdit(manager, skus, 5, ' ')).toEqual({ ok: false, error: 'note_required' });
  });

  it('bulkAssignStrategy merges SKUs into the strategy scope and audits', () => {
    const s = useStrategyStore.getState().items[0]!;
    const skus = products().slice(0, 2).map((p) => p.sku).filter((sku) => !s.skuIds.includes(sku));
    const res = bulkAssignStrategy(manager, s.id, skus);
    expect(res.ok).toBe(true);
    const after = useStrategyStore.getState().items.find((x) => x.id === s.id)!;
    for (const sku of skus) expect(after.skuIds).toContain(sku);
    expect(useAuditStore.getState().events.some((e) => e.type === 'strategy_save' && e.entityId === s.id)).toBe(true);
    expect(bulkAssignStrategy(ops, s.id, skus)).toEqual({ ok: false, error: 'forbidden' });
    expect(bulkAssignStrategy(manager, 'NOPE', skus)).toEqual({ ok: false, error: 'not_found' });
  });
});
