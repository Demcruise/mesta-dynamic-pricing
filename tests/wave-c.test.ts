import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  escalateRecommendation, expireStaleRecommendations, REC_TTL_MS, recommendationHealth, requestChanges, resubmitRecommendation, stageDecision,
} from '@/lib/actions/recommendation';
import { runRules, saveRule, setRuleStatus } from '@/lib/actions/rule';
import { resetMestaData } from '@/lib/bootstrap';
import type { Product, Role, Rule, UserSession } from '@/lib/ontology';
import { applyFormula, conditionValue, evalCondition, evaluateProduct, findConflicts, inRuleScope } from '@/lib/rules';
import { buOf, inScope, inScopeSkus, regionOfStore, REGIONS, STORES_BY_REGION } from '@/lib/scope';
import { useAuditStore, useNotificationStore, useProductCatalogStore, useRecommendationStore, useRuleStore } from '@/lib/stores';

const user = (role: Role): UserSession => ({ userId: `u-${role}`, name: role, role, ownedSkuIds: [] });
const analyst = user('analyst');
const manager = user('manager');
const compliance = user('compliance');
const ops = user('ops_lead');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 40 });
});
afterEach(() => vi.useRealTimers());

const products = () => useProductCatalogStore.getState().products;
const rules = () => useRuleStore.getState().items;

const makeRule = (patch: Partial<Rule> = {}): Rule => ({
  id: 'RULE-T', name: 'test', status: 'active', priority: 10, ownerId: 'u-test', updatedAt: '',
  scope: { categories: [], regions: [], skus: [] },
  when: [{ field: 'margin_pct', op: 'lt', value: 30 }],
  then: { kind: 'delta_percent', value: 5 },
  ...patch,
});

describe('scope hierarchy', () => {
  it('every seeded product carries a valid region and store inside it', () => {
    for (const p of products()) {
      expect(REGIONS).toContain(p.region);
      expect(STORES_BY_REGION[p.region as keyof typeof STORES_BY_REGION]).toContain(p.store);
      expect(buOf(p.region)).not.toBe('—');
      expect(regionOfStore(p.store)).toBe(p.region);
    }
  });

  it('inScope narrows org → region → store; store wins over region', () => {
    const p = products()[0]!;
    expect(inScope(p, { region: null, store: null })).toBe(true);
    expect(inScope(p, { region: p.region as never, store: null })).toBe(true);
    expect(inScope(p, { region: REGIONS.find((r) => r !== p.region) as never, store: null })).toBe(false);
    expect(inScope(p, { region: null, store: p.store })).toBe(true);
    const otherStore = REGIONS.flatMap((r) => STORES_BY_REGION[r]).find((s) => s !== p.store)!;
    expect(inScope(p, { region: p.region as never, store: otherStore })).toBe(false);
  });

  it('inScopeSkus filters linked records by product scope', () => {
    const region = REGIONS[0]!;
    const items = products().map((p) => ({ sku: p.sku }));
    const map = new Map(products().map((p) => [p.sku, p]));
    const scoped = inScopeSkus(items, map, { region, store: null });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(items.length);
    expect(scoped.every((i) => map.get(i.sku)?.region === region)).toBe(true);
  });
});

describe('rule engine', () => {
  // Re-resolved per test: the catalog is empty until beforeEach reseeds it.
  let p: Product;
  beforeEach(() => { p = products()[0]!; });

  it('derives condition values from product fields only', () => {
    expect(conditionValue(p, 'stock_units', Date.now())).toBe(p.stockUnits);
    expect(conditionValue(p, 'margin_pct', Date.now())).toBeCloseTo(((p.price - p.cost) / p.price) * 100, 5);
    expect(conditionValue(p, 'competitor_gap_pct', Date.now())).toBeCloseTo((p.price / p.competitorAvg - 1) * 100, 5);
  });

  it('evaluates every operator', () => {
    const c = { field: 'stock_units' as const, value: p.stockUnits };
    expect(evalCondition({ ...c, op: 'eq' }, p, 0)).toBe(true);
    expect(evalCondition({ ...c, op: 'gte' }, p, 0)).toBe(true);
    expect(evalCondition({ ...c, op: 'lte' }, p, 0)).toBe(true);
    expect(evalCondition({ ...c, op: 'gt' }, p, 0)).toBe(false);
    expect(evalCondition({ ...c, op: 'lt' }, p, 0)).toBe(false);
    expect(evalCondition({ ...c, op: 'gt', value: p.stockUnits + 1 }, p, 0)).toBe(false);
  });

  it('ANDs all conditions — one failing condition kills the match', () => {
    const r = makeRule({
      when: [
        { field: 'stock_units', op: 'gte', value: 0 },          // always true
        { field: 'stock_units', op: 'gt', value: p.stockUnits }, // false at the boundary
      ],
    });
    expect(evaluateProduct(p, [r], Date.now()).winner).toBeNull();
  });

  it('scopes by category, region, and explicit SKU list', () => {
    const cat = makeRule({ scope: { categories: [p.category], regions: [], skus: [] } });
    expect(inRuleScope(cat, p)).toBe(true);
    expect(inRuleScope(makeRule({ scope: { categories: ['Nope'], regions: [], skus: [] } }), p)).toBe(false);
    expect(inRuleScope(makeRule({ scope: { categories: [], regions: [p.region], skus: [] } }), p)).toBe(true);
    expect(inRuleScope(makeRule({ scope: { categories: [], regions: ['Nope'], skus: [] } }), p)).toBe(false);
    expect(inRuleScope(makeRule({ scope: { categories: [], regions: [], skus: [p.sku] } }), p)).toBe(true);
    expect(inRuleScope(makeRule({ scope: { categories: [], regions: [], skus: ['SKU-X'] } }), p)).toBe(false);
  });

  it('produces a price from each formula kind', () => {
    expect(applyFormula({ kind: 'match_competitor', value: 0 }, p)).toBe(Math.round(p.competitorAvg / 100) * 100);
    expect(applyFormula({ kind: 'delta_percent', value: -10 }, p)).toBe(Math.round(p.price * 0.9 / 100) * 100);
    const floor = applyFormula({ kind: 'min_margin_pct', value: 15 }, p);
    expect(((floor - p.cost) / floor) * 100).toBeGreaterThanOrEqual(14.9);
  });

  it('lower priority number wins; equal priorities surface as conflicts', () => {
    const a = makeRule({ id: 'RULE-A', priority: 5, when: [] });
    const b = makeRule({ id: 'RULE-B', priority: 20, when: [] });
    expect(evaluateProduct(p, [b, a], Date.now()).winner?.id).toBe('RULE-A');
    const c = makeRule({ id: 'RULE-C', priority: 5, when: [] });
    const res = evaluateProduct(p, [a, c], Date.now());
    expect(res.conflicts.map((x) => x.id)).toContain('RULE-C');
    expect(findConflicts([a, c], [p], Date.now())).toEqual([{ sku: p.sku, ruleIds: expect.arrayContaining(['RULE-A', 'RULE-C']) }]);
  });
});

describe('rule actions', () => {
  it('denies save/status/run to roles without the permission', () => {
    expect(saveRule(ops, makeRule()).ok).toBe(false);
    expect(saveRule(compliance, makeRule()).ok).toBe(false);
    expect(setRuleStatus(compliance, rules()[0]!.id, 'paused').ok).toBe(false);
    expect(runRules(ops)).toEqual({ ok: false, error: 'forbidden' });
    expect(runRules(compliance)).toEqual({ ok: false, error: 'forbidden' });
  });

  it('saves and audits a rule', () => {
    expect(saveRule(analyst, makeRule()).ok).toBe(true);
    expect(rules().some((r) => r.id === 'RULE-T')).toBe(true);
    expect(setRuleStatus(analyst, 'RULE-T', 'paused').ok).toBe(true);
    expect(rules().find((r) => r.id === 'RULE-T')?.status).toBe('paused');
    expect(useAuditStore.getState().events.filter((e) => e.type === 'rule_save').length).toBe(2);
    expect(setRuleStatus(analyst, 'RULE-NOPE', 'active')).toEqual({ ok: false, error: 'not_found' });
  });

  it('runs active rules and links created recs back to the winning rule', () => {
    // A rule that definitely fires: everything above a 0% margin floor gets +1%.
    expect(saveRule(analyst, makeRule({
      id: 'RULE-RUN', status: 'active', priority: 1,
      when: [{ field: 'margin_pct', op: 'gte', value: 0 }],
      then: { kind: 'delta_percent', value: 1 },
    })).ok).toBe(true);

    const res = runRules(analyst);
    if (!('summary' in res)) throw new Error('runRules denied');
    const s = res.summary;
    expect(s.evaluated).toBe(products().length);

    const created = useRecommendationStore.getState().items.filter((r) => r.ruleId === 'RULE-RUN');
    expect(created.length).toBe(s.created);
    for (const r of created) {
      const prod = products().find((p) => p.sku === r.sku)!;
      expect(r.status).toBe('pending');
      expect(r.proposedPrice).toBe(applyFormula({ kind: 'delta_percent', value: 1 }, prod));
      expect(r.ownerId).toBe('u-test');
      expect(r.rationale.every((f) => f.detail.startsWith('RULE-RUN'))).toBe(true);
    }
    // SKUs with an existing pending rec were skipped, not duplicated.
    const pendingSkus = new Set(created.map((r) => r.sku));
    expect(pendingSkus.size).toBe(created.length);
    expect(useAuditStore.getState().events.some((e) => e.type === 'rule_run')).toBe(true);
    if (s.created > 0) {
      expect(useNotificationStore.getState().items.some((n) => n.messageKey === 'common.notify.ruleRun')).toBe(true);
    }
  });

  it('skips proposals that would breach price bounds', () => {
    expect(saveRule(analyst, makeRule({
      id: 'RULE-BAD', status: 'active', priority: 1,
      when: [{ field: 'margin_pct', op: 'gte', value: 0 }],
      then: { kind: 'delta_percent', value: -60 }, // below min price on every product
    })).ok).toBe(true);
    const res = runRules(analyst);
    if (!('summary' in res)) throw new Error('runRules denied');
    expect(res.summary.created).toBe(0);
    expect(res.summary.skipped.guardrail + res.summary.skipped.unchanged + res.summary.skipped.pending).toBeGreaterThan(0);
    expect(useRecommendationStore.getState().items.some((r) => r.ruleId === 'RULE-BAD')).toBe(false);
  });
});

describe('approval inbox workflow', () => {
  const recs = () => useRecommendationStore.getState().items;
  const pendingRec = () => recs().find((r) => r.status === 'pending')!;
  const stalePending = () => recs().find((r) => r.status === 'pending' && recommendationHealth(r).stale);

  it('requestChanges needs a note, moves pending → changes_requested, notifies the analyst', () => {
    const r = pendingRec();
    expect(requestChanges(analyst, r.id, '')).toEqual({ ok: false, error: 'note_required' });
    expect(requestChanges(ops, r.id, 'fix it').ok).toBe(false); // ops cannot decide
    expect(requestChanges(analyst, r.id, 'recheck competitor feed').ok).toBe(true);
    const after = recs().find((x) => x.id === r.id)!;
    expect(after.status).toBe('changes_requested');
    expect(after.decisionNote).toBe('recheck competitor feed');
    expect(useAuditStore.getState().events.some((e) => e.type === 'recommendation_request_changes' && e.entityId === r.id)).toBe(true);
    expect(useNotificationStore.getState().items.some((n) => n.messageKey === 'common.notify.recChanges')).toBe(true);
  });

  it('escalate keeps the rec decidable and pings the manager', () => {
    const r = pendingRec();
    expect(escalateRecommendation(analyst, r.id, '').ok).toBe(true);
    expect(recs().find((x) => x.id === r.id)?.status).toBe('escalated');
    // Still decidable — an escalated rec can be approved.
    expect(stageDecision(analyst, r.id, 'approved', { ackStale: true }).ok).toBe(true);
    expect(useNotificationStore.getState().items.some((n) => n.messageKey === 'common.notify.recEscalated' && n.targetRole === 'manager')).toBe(true);
  });

  it('staleness gate: approving a stale rec without ack fails; with ack it stages', () => {
    const stale = stalePending();
    expect(stale, 'seed should contain a stale pending rec').toBeDefined();
    // Manager here — a stale rec may also be high-impact, and this test exercises the stale gate alone.
    expect(stageDecision(manager, stale!.id, 'approved')).toEqual({ ok: false, error: 'stale' });
    expect(stageDecision(manager, stale!.id, 'approved', { ackStale: true }).ok).toBe(true);
  });

  it('resubmit returns changes_requested and expired recs to pending', () => {
    const r = pendingRec();
    expect(requestChanges(analyst, r.id, 'rework').ok).toBe(true);
    expect(resubmitRecommendation(analyst, r.id).ok).toBe(true);
    expect(recs().find((x) => x.id === r.id)?.status).toBe('pending');

    // The seeded 8-day-old rec is already expired — bootstrap runs the sweep.
    const expired = recs().find((x) => x.status === 'expired');
    expect(expired).toBeDefined();
    expect(resubmitRecommendation(analyst, expired!.id, 'still relevant').ok).toBe(true);
    expect(recs().find((x) => x.id === expired!.id)?.status).toBe('pending');
    expect(useAuditStore.getState().events.some((e) => e.type === 'recommendation_expire' && e.entityId === expired!.id)).toBe(true);
    expect(useAuditStore.getState().events.some((e) => e.type === 'recommendation_resubmit' && e.entityId === expired!.id)).toBe(true);
  });

  it('expiry sweep only lapses recs older than the TTL', () => {
    const cutoff = Date.now() - REC_TTL_MS;
    const old = pendingRec();
    const fresh = recs().find((x) => x.status === 'pending' && x.id !== old.id)!;
    // Age this rec past the TTL by rewriting createdAt via a direct store patch.
    useRecommendationStore.setState((s) => ({
      items: s.items.map((x) => (x.id === old.id ? { ...x, createdAt: new Date(cutoff - 1000).toISOString() } : x)),
    }));
    expect(expireStaleRecommendations()).toBeGreaterThanOrEqual(1);
    expect(recs().find((x) => x.id === old.id)?.status).toBe('expired');
    expect(recs().find((x) => x.id === fresh.id)?.status).toBe('pending');
    // A second sweep is a no-op.
    expect(expireStaleRecommendations()).toBe(0);
  });
});

describe('rule seeds', () => {
  it('ships deterministic seed rules after bootstrap', () => {
    const ids = rules().map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['RULE-001', 'RULE-002', 'RULE-003']));
    expect(rules().every((r) => r.when.length > 0 && r.scope)).toBe(true);
  });

  it('seed recommendations that cite RULE-001 match its formula', () => {
    // Larger catalogue → enough spread for the deterministic rule-link subset to appear.
    resetMestaData({ productCount: 200 });
    const linked = useRecommendationStore.getState().items.filter((r) => r.ruleId === 'RULE-001');
    expect(linked.length).toBeGreaterThan(0);
    for (const r of linked) {
      const p = products().find((x) => x.sku === r.sku)!;
      expect(r.proposedPrice).toBe(Math.round(p.competitorAvg / 100) * 100);
    }
  });
});
