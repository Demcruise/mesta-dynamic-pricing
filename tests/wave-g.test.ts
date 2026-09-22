import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateStrategy, promoteScheduledStrategies, saveStrategy, unscheduleStrategy,
} from '@/lib/actions/strategy';
import { runRules } from '@/lib/actions/rule';
import { checkPrice, governingStrategy } from '@/lib/guardrails';
import { resetMestaData } from '@/lib/bootstrap';
import type { Role, Rule, Strategy, UserSession } from '@/lib/ontology';
import { applyFormula, evaluateProduct } from '@/lib/rules';
import { toDraft } from '@/lib/strategy-rules';
import {
  useAuditStore, useProductCatalogStore, useRecommendationStore, useRuleStore, useStrategyStore,
} from '@/lib/stores';

const user = (role: Role): UserSession => ({ userId: `u-${role}`, name: role, role, ownedSkuIds: [] });
const analyst = user('analyst');
const manager = user('manager');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 40 });
});
afterEach(() => vi.useRealTimers());

const products = () => useProductCatalogStore.getState().products;
const strat = (id: string) => useStrategyStore.getState().items.find((s) => s.id === id)!;
const pending = () => useStrategyStore.getState().items.find((s) => s.status === 'pending_manager_approval')!;

const makeStrategy = (patch: Partial<Strategy> = {}): Strategy => ({
  id: 'STR-X', name: 'X', objective: 'maximize_margin', skuIds: [], categories: [],
  guardrail: { minPrice: null, maxPrice: null, mapEnforced: false, maxChangePercent: 10, autoApproveThreshold: 90 },
  status: 'active', activateAt: null, ruleIds: [], signals: [], ownerId: 'u-test', updatedAt: '',
  ...patch,
});

const makeRule = (patch: Partial<Rule> = {}): Rule => ({
  id: 'RULE-T', name: 'test', status: 'active', priority: 10, ownerId: 'u-test', updatedAt: '',
  scope: { categories: [], regions: [], skus: [] },
  when: [{ field: 'margin_pct', op: 'lt', value: 90 }],
  then: { kind: 'delta_percent', value: 5 },
  ...patch,
});

describe('strategy scheduling', () => {
  it('parks approval as scheduled when `at` is in the future, promotes when the time passes', () => {
    const s = pending();
    const at = new Date(Date.now() + 3_600_000).toISOString();
    expect(activateStrategy(manager, s.id, { at }).ok).toBe(true);
    expect(strat(s.id).status).toBe('scheduled');
    expect(strat(s.id).activateAt).toBe(at);
    expect(useAuditStore.getState().events.some((e) => e.type === 'strategy_schedule' && e.entityId === s.id)).toBe(true);

    expect(promoteScheduledStrategies(Date.now() + 1_800_000)).toBe(0);
    expect(strat(s.id).status).toBe('scheduled');
    expect(promoteScheduledStrategies(Date.now() + 3_600_000)).toBe(1);
    expect(strat(s.id).status).toBe('active');
    expect(strat(s.id).activateAt).toBeNull();
    expect(useAuditStore.getState().events.some((e) => e.type === 'strategy_activate' && e.actorId === 'system')).toBe(true);
  });

  it('unschedule returns the strategy to pending_manager_approval', () => {
    const s = pending();
    activateStrategy(manager, s.id, { at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(unscheduleStrategy(manager, s.id).ok).toBe(true);
    expect(strat(s.id).status).toBe('pending_manager_approval');
    expect(strat(s.id).activateAt).toBeNull();
    expect(useAuditStore.getState().events.some((e) => e.type === 'strategy_unschedule')).toBe(true);
  });

  it('activate-now on a scheduled strategy promotes it immediately', () => {
    const s = pending();
    activateStrategy(manager, s.id, { at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(activateStrategy(manager, s.id).ok).toBe(true);
    expect(strat(s.id).status).toBe('active');
    expect(strat(s.id).activateAt).toBeNull();
  });

  it('enforces strategy.activate — analysts cannot schedule or unschedule', () => {
    const s = pending();
    const at = new Date(Date.now() + 3_600_000).toISOString();
    expect(activateStrategy(analyst, s.id, { at })).toEqual({ ok: false, error: 'forbidden' });
    activateStrategy(manager, s.id, { at });
    expect(unscheduleStrategy(analyst, s.id)).toEqual({ ok: false, error: 'forbidden' });
    expect(strat(s.id).status).toBe('scheduled');
  });
});

describe('rule binding to strategies', () => {
  it('an unbound rule applies anywhere its own scope covers', () => {
    const p = products()[0]!;
    const r = makeRule();
    expect(evaluateProduct(p, [r], [], products(), Date.now()).winner?.id).toBe('RULE-T');
    // A strategy that does NOT bind this rule changes nothing.
    expect(evaluateProduct(p, [r], [makeStrategy({ skuIds: [p.sku] })], products(), Date.now()).winner?.id).toBe('RULE-T');
  });

  it('a bound rule applies only on SKUs the active binding strategy governs', () => {
    const p = products()[0]!;
    const other = products()[1]!;
    const r = makeRule();
    const s = makeStrategy({ skuIds: [p.sku], ruleIds: [r.id] });
    expect(evaluateProduct(p, [r], [s], products(), Date.now()).winner?.id).toBe('RULE-T');
    expect(evaluateProduct(other, [r], [s], products(), Date.now()).winner).toBeNull();
  });

  it('a bound rule never fires while the binding strategy is not active', () => {
    const p = products()[0]!;
    const r = makeRule();
    const s = makeStrategy({ skuIds: [p.sku], ruleIds: [r.id], status: 'pending_manager_approval' });
    expect(evaluateProduct(p, [r], [s], products(), Date.now()).winner).toBeNull();
  });

  it('strategy.signals restrict which condition fields bound rules may read', () => {
    const p = products()[0]!;
    const r = makeRule({ when: [{ field: 'competitor_gap_pct', op: 'gt', value: -100 }] }); // always true
    const gated = makeStrategy({ skuIds: [p.sku], ruleIds: [r.id], signals: ['margin_pct'] });
    expect(evaluateProduct(p, [r], [gated], products(), Date.now()).winner).toBeNull();
    const open = makeStrategy({ skuIds: [p.sku], ruleIds: [r.id], signals: ['competitor_gap_pct'] });
    expect(evaluateProduct(p, [r], [open], products(), Date.now()).winner?.id).toBe('RULE-T');
    // Empty signals = all allowed.
    const all = makeStrategy({ skuIds: [p.sku], ruleIds: [r.id], signals: [] });
    expect(evaluateProduct(p, [r], [all], products(), Date.now()).winner?.id).toBe('RULE-T');
  });

  it('runRules skips SKUs outside a bound rule\'s strategy scope', () => {
    const rule = makeRule({ id: 'RULE-BOUND', priority: 1, when: [{ field: 'margin_pct', op: 'lt', value: 100 }] });
    useRuleStore.getState().upsert(rule);
    const pendingSkus = new Set(
      useRecommendationStore.getState().items
        .filter((x) => x.status === 'pending' || x.status === 'escalated' || x.status === 'changes_requested')
        .map((x) => x.sku),
    );
    // A SKU where this rule is the winner, the price actually moves, bounds pass, and nothing is pending.
    const target = products().find((p) => {
      const { winner, price } = evaluateProduct(p, [rule], [], products(), Date.now());
      return winner?.id === rule.id && price !== null && price !== p.price
        && checkPrice(p, governingStrategy(p, useStrategyStore.getState().items), price) === 'ok'
        && !pendingSkus.has(p.sku);
    });
    expect(target).toBeDefined();
    // Bind the rule to a strategy covering exactly that SKU — only it can produce a rec.
    useStrategyStore.getState().upsert(makeStrategy({ id: 'STR-B', skuIds: [target!.sku], ruleIds: [rule.id] }));
    const r = runRules(manager);
    expect(r.ok).toBe(true);
    const boundRecs = useRecommendationStore.getState().items.filter((x) => x.ruleId === 'RULE-BOUND');
    expect(boundRecs.length).toBeGreaterThan(0);
    expect(boundRecs.every((x) => x.sku === target!.sku)).toBe(true);
  });
});

describe('strategy draft round-trip', () => {
  it('toDraft carries ruleIds and signals so the wizard edits them', () => {
    const s = makeStrategy({ ruleIds: ['RULE-001'], signals: ['margin_pct'] });
    const d = toDraft(s);
    expect(d.ruleIds).toEqual(['RULE-001']);
    expect(d.signals).toEqual(['margin_pct']);
  });

  it('saveStrategy persists ruleIds/signals from the draft', () => {
    const s = pending();
    const d = { ...toDraft(s), ruleIds: ['RULE-001'], signals: ['margin_pct' as const] };
    expect(saveStrategy(manager, d, s.id).ok).toBe(true);
    expect(strat(s.id).ruleIds).toEqual(['RULE-001']);
    expect(strat(s.id).signals).toEqual(['margin_pct']);
  });
});
