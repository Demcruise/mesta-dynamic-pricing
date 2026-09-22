import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bulkApprove, bulkEligibility, stageDecision, undoDecision,
} from '@/lib/actions/recommendation';
import { saveScenario, sendScenario } from '@/lib/actions/scenario';
import { activateStrategy, rejectStrategy, saveStrategy, submitStrategy } from '@/lib/actions/strategy';
import { resetMestaData } from '@/lib/bootstrap';
import { checkPrice, priceBounds } from '@/lib/guardrails';
import type { Role, UserSession } from '@/lib/ontology';
import { project } from '@/lib/projection';
import { emptyDraft, overlapSkus, validateDraft } from '@/lib/strategy-rules';
import {
  UNDO_WINDOW_MS, useAuditStore, useNotificationStore, useProductCatalogStore, useRecommendationStore,
  useScenarioStore, useStrategyStore, useUndoStore,
} from '@/lib/stores';
import { filterAndSort, DEFAULT_QUEUE_FILTERS, magnitudeOf } from '@/features/recommendations/filters';

const user = (role: Role): UserSession => ({ userId: `u-${role}`, name: role, role, ownedSkuIds: [] });
const analyst = user('analyst');
const manager = user('manager');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 200 });
});
afterEach(() => vi.useRealTimers());

const pending = () => useRecommendationStore.getState().items.find((r) => r.status === 'pending')!;
const auditFor = (id: string) => useAuditStore.getState().events.filter((e) => e.entityId === id && e.actorId.startsWith('u-'));

describe('recommendation decisions with undo', () => {
  it('commits status and audit only after the undo window', () => {
    const r = pending();
    expect(stageDecision(analyst, r.id, 'approved').ok).toBe(true);
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.status).toBe('pending');
    expect(auditFor(r.id)).toHaveLength(0);
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 10);
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.status).toBe('approved');
    expect(auditFor(r.id)).toHaveLength(1);
  });

  it('undo cancels the decision and creates no audit event', () => {
    const r = pending();
    stageDecision(analyst, r.id, 'rejected', { note: 'stale data' });
    expect(undoDecision(r.id).ok).toBe(true);
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 2);
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.status).toBe('pending');
    expect(auditFor(r.id)).toHaveLength(0);
    expect(useUndoStore.getState().staged[r.id]).toBeUndefined();
  });

  it('blocks overlapping actions while a decision is pending undo', () => {
    const r = pending();
    stageDecision(analyst, r.id, 'approved');
    expect(stageDecision(analyst, r.id, 'rejected', { note: 'x' })).toEqual({ ok: false, error: 'already_staged' });
  });

  it('requires a note for reject and adjust, and a valid price for adjust', () => {
    const r = pending();
    expect(stageDecision(analyst, r.id, 'rejected')).toEqual({ ok: false, error: 'note_required' });
    expect(stageDecision(analyst, r.id, 'adjusted', { proposedPrice: r.proposedPrice })).toEqual({ ok: false, error: 'note_required' });
    expect(stageDecision(analyst, r.id, 'adjusted', { note: 'n', proposedPrice: 1 }).ok).toBe(false);
  });

  it('adjust applies the adjusted price on commit', () => {
    const r = pending();
    const p = useProductCatalogStore.getState().products.find((x) => x.sku === r.sku)!;
    const price = Math.min(p.maxPrice, Math.max(p.minPrice, p.mapPrice, r.proposedPrice)) ;
    const res = stageDecision(analyst, r.id, 'adjusted', { note: 'tweak', proposedPrice: price });
    expect(res.ok).toBe(true);
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 10);
    const after = useRecommendationStore.getState().items.find((x) => x.id === r.id)!;
    expect(after.status).toBe('adjusted');
    expect(after.proposedPrice).toBe(price);
  });

  it('forbids roles without recommendation.decide', () => {
    expect(stageDecision(user('ops_lead'), pending().id, 'approved')).toEqual({ ok: false, error: 'forbidden' });
    expect(stageDecision(user('compliance'), pending().id, 'approved')).toEqual({ ok: false, error: 'forbidden' });
  });
});

describe('bulk approval', () => {
  it('is manager only', () => {
    expect(bulkApprove(analyst, useRecommendationStore.getState().items, 0)).toEqual({ ok: false, error: 'forbidden' });
  });

  it('excludes stale recommendations and approves the rest with audit', () => {
    const items = useRecommendationStore.getState().items.filter((r) => r.status === 'pending');
    const stale = items[0]!;
    useProductCatalogStore.getState().applyPrice(stale.sku, stale.currentPrice + 100, 'manual_override');
    const plan = bulkEligibility(items, 0);
    expect(plan.excluded.some((e) => e.rec.id === stale.id && e.reason === 'stale')).toBe(true);
    expect(plan.eligible.some((r) => r.id === stale.id)).toBe(false);
    const res = bulkApprove(manager, items, 0);
    expect(res.ok && res.count).toBe(plan.eligible.length);
    expect(useRecommendationStore.getState().items.find((r) => r.id === stale.id)?.status).toBe('pending');
  });

  it('approves only explicitly selected ids (per-item uncheck)', () => {
    const items = useRecommendationStore.getState().items.filter((r) => r.status === 'pending');
    const plan = bulkEligibility(items, 0);
    expect(plan.eligible.length).toBeGreaterThanOrEqual(2);
    const [keep, ...rest] = plan.eligible;
    const res = bulkApprove(manager, items, 0, new Set([keep!.id]));
    expect(res).toEqual({ ok: true, count: 1 });
    const after = useRecommendationStore.getState().items;
    expect(after.find((r) => r.id === keep!.id)?.status).toBe('approved');
    for (const r of rest) expect(after.find((x) => x.id === r.id)?.status).toBe('pending');
    expect(auditFor(keep!.id).some((e) => e.note === 'bulk approval')).toBe(true);
  });

  it('cannot smuggle an ineligible id through the selected set', () => {
    const items = useRecommendationStore.getState().items.filter((r) => r.status === 'pending');
    const stale = items[0]!;
    useProductCatalogStore.getState().applyPrice(stale.sku, stale.currentPrice + 100, 'manual_override');
    const res = bulkApprove(manager, items, 0, new Set([stale.id]));
    expect(res).toEqual({ ok: true, count: 0 });
    expect(useRecommendationStore.getState().items.find((r) => r.id === stale.id)?.status).toBe('pending');
  });
});

describe('guardrails and projection', () => {
  const p = () => useProductCatalogStore.getState().products[0]!;

  it('intersects product and strategy bounds', () => {
    const prod = p();
    const b = priceBounds(prod, { guardrail: { minPrice: null, maxPrice: null, mapEnforced: true, maxChangePercent: 5, autoApproveThreshold: 90 } });
    expect(b.min).toBeGreaterThanOrEqual(Math.ceil(prod.price * 0.95));
    expect(b.max).toBeLessThanOrEqual(Math.floor(prod.price * 1.05));
  });

  it('flags out-of-range prices', () => {
    const prod = p();
    expect(checkPrice(prod, null, 0)).toBe('invalid');
    expect(checkPrice(prod, null, prod.maxPrice + 1)).toBe('above_max');
    expect(checkPrice(prod, null, prod.price)).toBe('ok');
  });

  it('projects demand falling when price rises for elastic goods', () => {
    const prod = p();
    const up = project(prod, prod.price * 1.1);
    expect(up.demandChange).toBeLessThan(0);
    expect(project(prod, prod.price).demandChange).toBeCloseTo(0);
  });
});

describe('scenario lifecycle', () => {
  it('sends exactly once and creates a single simulation recommendation', () => {
    const prod = useProductCatalogStore.getState().products[0]!;
    const saved = saveScenario(analyst, { sku: prod.sku, strategyId: null, proposedPrice: prod.price });
    expect(saved.ok).toBe(true);
    const id = (saved as { scenario: { id: string } }).scenario.id;
    const before = useRecommendationStore.getState().items.length;
    const first = sendScenario(analyst, id);
    expect(first.ok).toBe(true);
    expect(sendScenario(analyst, id)).toEqual({ ok: false, error: 'already_sent' });
    const items = useRecommendationStore.getState().items;
    expect(items).toHaveLength(before + 1);
    const rec = items.find((r) => r.scenarioId === id)!;
    expect(rec.source).toBe('simulation');
    expect(rec.status).toBe('pending');
    expect(rec.currentPrice).toBe(prod.price);
    expect(useScenarioStore.getState().items[0]?.recommendationId).toBe(rec.id);
    expect(useAuditStore.getState().events.some((e) => e.type === 'scenario_sent' && e.entityId === id)).toBe(true);
  });

  it('rejects invalid price and unauthorized roles', () => {
    const prod = useProductCatalogStore.getState().products[0]!;
    expect(saveScenario(analyst, { sku: prod.sku, strategyId: null, proposedPrice: prod.maxPrice * 2 }).ok).toBe(false);
    expect(saveScenario(user('compliance'), { sku: prod.sku, strategyId: null, proposedPrice: prod.price }).ok).toBe(false);
  });
});

describe('strategy approval flow', () => {
  const draft = () => ({ ...emptyDraft(), name: 'Test', categories: ['Dairy'] });

  it('analyst submits, cannot activate; manager activates', () => {
    const saved = saveStrategy(analyst, draft(), null);
    expect(saved.ok).toBe(true);
    const id = (saved as { strategy: { id: string } }).strategy.id;
    expect(submitStrategy(analyst, id).ok).toBe(true);
    expect(activateStrategy(analyst, id)).toEqual({ ok: false, error: 'forbidden' });
    expect(useStrategyStore.getState().items.find((s) => s.id === id)?.status).toBe('pending_manager_approval');
    expect(useNotificationStore.getState().items.some((n) => n.targetRole === 'manager')).toBe(true);
    expect(activateStrategy(manager, id).ok).toBe(true);
    expect(useStrategyStore.getState().items.find((s) => s.id === id)?.status).toBe('active');
    const types = useAuditStore.getState().events.filter((e) => e.entityId === id).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['strategy_submit', 'strategy_activate']));
  });

  it('refuses to submit invalid bounds', () => {
    const bad = { ...draft(), guardrail: { ...draft().guardrail, minPrice: 100, maxPrice: 50 } };
    const saved = saveStrategy(analyst, bad, null) as { strategy: { id: string } };
    expect(submitStrategy(analyst, saved.strategy.id)).toEqual({ ok: false, error: 'invalid' });
  });

  it('manager rejection needs a note and returns the strategy to draft', () => {
    const id = (saveStrategy(analyst, draft(), null) as { strategy: { id: string } }).strategy.id;
    submitStrategy(analyst, id);
    expect(rejectStrategy(manager, id, '')).toEqual({ ok: false, error: 'note_required' });
    expect(rejectStrategy(manager, id, 'scope too wide').ok).toBe(true);
    expect(useStrategyStore.getState().items.find((s) => s.id === id)?.status).toBe('draft');
  });

  it('validation: blockers and overlap warning', () => {
    const products = useProductCatalogStore.getState().products;
    const strategies = useStrategyStore.getState().items;
    const codes = (d: ReturnType<typeof draft>) => validateDraft(d, strategies, products, null).map((i) => i.code);
    expect(codes({ ...draft(), name: '' })).toContain('name_required');
    expect(codes({ ...draft(), categories: [] })).toContain('scope_required');
    expect(codes({ ...draft(), guardrail: { ...draft().guardrail, maxChangePercent: 0 } })).toContain('change_range');
    expect(codes({ ...draft(), guardrail: { ...draft().guardrail, autoApproveThreshold: 120 } })).toContain('threshold_range');
    // seeded active strategy covers Beverages
    const overlap = validateDraft({ ...draft(), categories: ['Beverages'] }, strategies, products, null);
    expect(overlap.find((i) => i.code === 'overlap')?.severity).toBe('warning');
  });

  it('overlapSkus returns the specific SKUs shared with each active strategy', () => {
    const products = useProductCatalogStore.getState().products;
    const strategies = useStrategyStore.getState().items;
    const overlaps = overlapSkus({ ...draft(), categories: ['Beverages'] }, strategies, products, null);
    expect(overlaps.length).toBeGreaterThan(0);
    for (const o of overlaps) {
      expect(o.strategy.status).toBe('active');
      expect(o.skus.length).toBeGreaterThan(0);
    }
    // drafts do not overlap themselves
    expect(overlapSkus({ ...draft(), categories: [] }, strategies, products, null)).toEqual([]);
  });
});

describe('queue filters', () => {
  it('filter/sort never mutates the source list', () => {
    const items = useRecommendationStore.getState().items;
    const snapshot = JSON.stringify(items);
    const map = new Map(useProductCatalogStore.getState().products.map((p) => [p.sku, p]));
    const out = filterAndSort(items, map, { ...DEFAULT_QUEUE_FILTERS, tab: 'all', status: 'all', sort: 'impact' });
    expect(out).toHaveLength(items.length);
    expect(JSON.stringify(items)).toBe(snapshot);
    expect(filterAndSort(items, map, DEFAULT_QUEUE_FILTERS).every((r) => r.status === 'pending')).toBe(true);
    expect(['small', 'medium', 'large']).toContain(magnitudeOf(items[0]!));
  });
});

describe('cross-role handoff notifications', () => {
  const notices = (role: Role) => useNotificationStore.getState().items.filter((n) => n.targetRole === role || n.targetRole === 'all');

  it('analyst send → manager gets a pending-decision notification with a deep link', () => {
    const prod = useProductCatalogStore.getState().products[0]!;
    const saved = saveScenario(analyst, { sku: prod.sku, strategyId: null, proposedPrice: prod.price });
    const id = (saved as { scenario: { id: string } }).scenario.id;
    const sent = sendScenario(analyst, id);
    expect(sent.ok).toBe(true);
    const rec = (sent as { recommendation: { id: string; sku: string } }).recommendation;
    const n = notices('manager').find((x) => x.messageKey === 'common.notify.recPending');
    expect(n).toBeDefined();
    expect(n!.params?.sku).toBe(rec.sku);
    expect(n!.href).toBe(`/recommendations/${rec.id}`);
  });

  it('approve commit → ops_lead gets a ready-to-deploy notification', () => {
    const rec = pending();
    stageDecision(manager, rec.id, 'approved');
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 100);
    const n = notices('ops_lead').find((x) => x.messageKey === 'common.notify.recReadyDeploy');
    expect(n).toBeDefined();
    expect(n!.params?.sku).toBe(rec.sku);
    expect(n!.href).toBe('/deployment');
  });

  it('reject commit does not notify ops_lead', () => {
    const rec = pending();
    stageDecision(manager, rec.id, 'rejected', { note: 'stale data' });
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 100);
    expect(notices('ops_lead').some((x) => x.messageKey === 'common.notify.recReadyDeploy')).toBe(false);
  });

  it('bulk approve → one grouped ready-to-deploy notification to ops_lead', () => {
    const items = useRecommendationStore.getState().items;
    const res = bulkApprove(manager, items, 0);
    if (!res.ok) throw new Error('bulkApprove failed');
    expect(res.count).toBeGreaterThan(0);
    const n = notices('ops_lead').find((x) => x.messageKey === 'common.notify.recBulkReady');
    expect(n).toBeDefined();
    expect(n!.params?.n).toBe(res.count);
  });
});
