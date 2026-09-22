import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelExperiment, concludeExperiment, experimentResults, saveExperiment, startExperiment } from '@/lib/actions/experiment';
import { delegateApproval, revokeDelegation } from '@/lib/actions/ops';
import { HIGH_IMPACT_IDR, requiresManager, stageDecision } from '@/lib/actions/recommendation';
import { saveRule } from '@/lib/actions/rule';
import { saveStrategy } from '@/lib/actions/strategy';
import { resetMestaData } from '@/lib/bootstrap';
import type { Recommendation, Role, UserSession } from '@/lib/ontology';
import { activeGrantFor } from '@/lib/stores/ops';
import {
  useAuditStore, useExperimentStore, useMonitoringStore, useProductCatalogStore, useRecommendationStore,
  useRuleStore, useStrategyStore,
} from '@/lib/stores';

const user = (role: Role, userId = `u-${role}`): UserSession => ({ userId, name: role, role, ownedSkuIds: [] });
const analyst = user('analyst', 'u-analyst-1');
const manager = user('manager', 'u-manager-1');
const ops = user('ops_lead');
const compliance = user('compliance');

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 40 });
});
afterEach(() => vi.useRealTimers());

const products = () => useProductCatalogStore.getState().products;
const experiments = () => useExperimentStore.getState().items;
const outcomes = () => useMonitoringStore.getState().outcomes;

describe('experiments (E.0/E.1)', () => {
  it('seeds one concluded experiment with real outcomes + price events, one draft', () => {
    const exp = experiments().find((e) => e.id === 'EXP-001')!;
    expect(exp.status).toBe('concluded');
    expect(exp.startedAt).not.toBeNull();
    expect(exp.endedAt).not.toBeNull();
    const outs = outcomes().filter((o) => o.experimentId === 'EXP-001');
    expect(outs.length).toBeGreaterThan(0);
    for (const o of outs) {
      expect(o.forecast.revenue).toBeGreaterThan(0);
      expect(o.actual.revenue).not.toBe(o.forecast.revenue);
      const p = products().find((x) => x.sku === o.sku)!;
      expect(p.price).not.toBe(0);
    }
    expect(experiments().some((e) => e.status === 'draft')).toBe(true);
  });

  it('saveExperiment validates input and enforces experiment.manage', () => {
    const base = { name: 'Test', hypothesis: 'Hypothesis', skuIds: ['SKU-1001'], deltaPct: -5 };
    expect(saveExperiment(compliance, base, null)).toEqual({ ok: false, error: 'forbidden' });
    expect(saveExperiment(analyst, { ...base, name: ' ' }, null)).toEqual({ ok: false, error: 'invalid' });
    expect(saveExperiment(analyst, { ...base, skuIds: [] }, null)).toEqual({ ok: false, error: 'invalid' });
    expect(saveExperiment(analyst, { ...base, deltaPct: 0 }, null)).toEqual({ ok: false, error: 'invalid' });
    const r = saveExperiment(analyst, base, null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(useExperimentStore.getState().items.find((e) => e.id === r.experiment.id)?.status).toBe('draft');
    expect(useAuditStore.getState().events.some((e) => e.type === 'experiment_save')).toBe(true);
  });

  it('startExperiment applies treatment prices and emits real outcomes', () => {
    const skuIds = products().slice(0, 3).map((p) => p.sku);
    const before = Object.fromEntries(products().slice(0, 3).map((p) => [p.sku, p.price]));
    const r = saveExperiment(analyst, { name: 'Dip', hypothesis: 'lower price lifts units', skuIds, deltaPct: -5 }, null);
    if (!r.ok) throw new Error('save failed');
    const res = startExperiment(manager, r.experiment.id);
    expect(res.ok).toBe(true);
    const exp = experiments().find((e) => e.id === r.experiment.id)!;
    expect(exp.status).toBe('running');
    expect(exp.startedAt).not.toBeNull();
    for (const sku of skuIds) {
      const p = products().find((x) => x.sku === sku)!;
      expect(p.price).toBe(Math.round((before[sku]! * 0.95) / 100) * 100);
    }
    const outs = outcomes().filter((o) => o.experimentId === exp.id);
    expect(outs).toHaveLength(skuIds.length);
    for (const o of outs) expect(o.actual.revenue).toBeGreaterThan(0);
    // Noise is deterministic and may hit 1.00 for a single SKU+id — assert on the aggregate.
    expect(outs.reduce((s, o) => s + o.actual.units, 0)).not.toBe(outs.reduce((s, o) => s + o.forecast.units, 0));
    // A second start on a running experiment is rejected.
    expect(startExperiment(manager, exp.id)).toEqual({ ok: false, error: 'invalid' });
  });

  it('startExperiment fails closed when the treatment breaches a bound', () => {
    const p = products()[0]!;
    const r = saveExperiment(manager, { name: 'X', hypothesis: 'h', skuIds: [p.sku], deltaPct: -80 }, null);
    if (!r.ok) throw new Error('save failed');
    expect(startExperiment(manager, r.experiment.id)).toEqual({ ok: false, error: 'guardrail' });
    expect(products()[0]!.price).toBe(p.price); // nothing mutated
    expect(experiments().find((e) => e.id === r.experiment.id)?.status).toBe('draft');
  });

  it('conclude/cancel transition the lifecycle and audit', () => {
    const r = saveExperiment(manager, { name: 'Y', hypothesis: 'h', skuIds: [products()[0]!.sku], deltaPct: 3 }, null);
    if (!r.ok) throw new Error('save failed');
    expect(concludeExperiment(manager, r.experiment.id)).toEqual({ ok: false, error: 'invalid' });
    expect(startExperiment(manager, r.experiment.id).ok).toBe(true);
    expect(concludeExperiment(manager, r.experiment.id).ok).toBe(true);
    const exp = experiments().find((e) => e.id === r.experiment.id)!;
    expect(exp.status).toBe('concluded');
    expect(exp.endedAt).not.toBeNull();
    expect(cancelExperiment(manager, exp.id)).toEqual({ ok: false, error: 'invalid' });
    expect(useAuditStore.getState().events.some((e) => e.type === 'experiment_conclude' && e.entityId === exp.id)).toBe(true);
  });

  it('experimentResults derives expected-vs-observed from emitted outcomes', () => {
    const exp = experiments().find((e) => e.id === 'EXP-001')!;
    const res = experimentResults(exp);
    expect(res.n).toBeGreaterThan(0);
    expect(res.expectedRevenue).toBeGreaterThan(0);
    expect(res.observedRevenue).toBeGreaterThan(0);
    expect(res.daysRunning).toBeGreaterThan(0);
    // Observed ≠ expected — noise is real but deterministic.
    expect(res.observedRevenue).not.toBe(res.expectedRevenue);
  });
});

describe('multi-level approval + delegation (E.3)', () => {
  const highImpactRec = (): Recommendation => {
    const p = products()[0]!;
    return {
      id: 'REC-HI', sku: p.sku, currentPrice: p.price, proposedPrice: p.price + 500,
      confidence: 80, source: 'agent', status: 'pending',
      rationale: [{ key: 'rule', weight: 1, detail: 'test' }],
      projectedMarginImpact: HIGH_IMPACT_IDR + 50_000,
      strategyId: null, scenarioId: null, ruleId: null,
      // Postdates all seeded competitor observations so the rec reads as fresh, not stale.
      createdAt: '2026-10-01T00:00:00.000Z', ownerId: 'u-analyst-1',
      decidedAt: null, decisionNote: null, deployed: false,
    };
  };
  const hydrateRec = (rec: Recommendation) => useRecommendationStore.getState().hydrate([rec]);

  it('requiresManager flags only high-impact recs', () => {
    expect(requiresManager({ projectedMarginImpact: HIGH_IMPACT_IDR })).toBe(true);
    expect(requiresManager({ projectedMarginImpact: -HIGH_IMPACT_IDR - 1 })).toBe(true);
    expect(requiresManager({ projectedMarginImpact: HIGH_IMPACT_IDR - 1 })).toBe(false);
  });

  it('analyst approval of a high-impact rec fails closed; manager succeeds', () => {
    hydrateRec(highImpactRec());
    expect(stageDecision(analyst, 'REC-HI', 'approved')).toEqual({ ok: false, error: 'requires_manager' });
    expect(stageDecision(manager, 'REC-HI', 'approved').ok).toBe(true);
  });

  it('a live delegation lets a named analyst approve; expiry closes it again', () => {
    hydrateRec(highImpactRec());
    const grant = delegateApproval(manager, 'u-analyst-1', 24);
    expect(grant.ok).toBe(true);
    expect(activeGrantFor('u-analyst-1')).not.toBeNull();
    expect(stageDecision(analyst, 'REC-HI', 'approved').ok).toBe(true);

    // Expired grant no longer covers the decision.
    hydrateRec({ ...highImpactRec(), id: 'REC-HI2' });
    const t0 = Date.now();
    vi.setSystemTime(t0 + 25 * 3_600_000);
    expect(activeGrantFor('u-analyst-1')).toBeNull();
    expect(stageDecision(analyst, 'REC-HI2', 'approved')).toEqual({ ok: false, error: 'requires_manager' });
    vi.setSystemTime(t0);
  });

  it('delegation is manager-only, audited, and revocable', () => {
    expect(delegateApproval(analyst, 'u-manager-1', 8)).toEqual({ ok: false, error: 'forbidden' });
    expect(delegateApproval(manager, 'u-manager-1', 8)).toEqual({ ok: false, error: 'invalid' });
    const r = delegateApproval(manager, 'u-analyst-1', 8);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(useAuditStore.getState().events.some((e) => e.type === 'delegation_grant' && e.entityId === r.grant.id)).toBe(true);
      expect(revokeDelegation(manager, r.grant.id).ok).toBe(true);
      expect(activeGrantFor('u-analyst-1')).toBeNull();
      expect(useAuditStore.getState().events.some((e) => e.type === 'delegation_revoke')).toBe(true);
    }
  });
});

describe('concurrent-edit detection (E.4)', () => {
  it('saveRule fails with conflict when the stored rule moved', () => {
    const rule = useRuleStore.getState().items[0]!;
    const draft = { ...rule, name: `${rule.name} v2` };
    // Another session edits first.
    expect(saveRule(manager, { ...rule, name: `${rule.name} other` }).ok).toBe(true);
    const latest = useRuleStore.getState().items.find((r) => r.id === rule.id)!;
    // Stale snapshot → conflict; forced overwrite → ok.
    expect(saveRule(manager, draft, { expectedUpdatedAt: rule.updatedAt })).toEqual({ ok: false, error: 'conflict' });
    expect(saveRule(manager, draft, { expectedUpdatedAt: latest.updatedAt }).ok).toBe(true);
    expect(saveRule(manager, { ...rule, name: `${rule.name} forced` }).ok).toBe(true);
  });

  it('saveStrategy fails with conflict when the stored strategy moved', () => {
    const s = useStrategyStore.getState().items[0]!;
    const mkDraft = (name: string) => ({
      name, objective: s.objective, skuIds: s.skuIds, categories: s.categories, guardrail: s.guardrail,
      ruleIds: s.ruleIds, signals: s.signals,
    });
    expect(saveStrategy(manager, mkDraft(`${s.name} A`), s.id).ok).toBe(true);
    const moved = useStrategyStore.getState().items.find((x) => x.id === s.id)!;
    // The snapshot captured before the save above is stale.
    expect(saveStrategy(manager, mkDraft(`${s.name} B`), s.id, { expectedUpdatedAt: s.updatedAt }))
      .toEqual({ ok: false, error: 'conflict' });
    expect(saveStrategy(manager, mkDraft(`${s.name} C`), s.id, { expectedUpdatedAt: moved.updatedAt }).ok).toBe(true);
  });
});
