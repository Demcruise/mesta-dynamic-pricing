import { project } from '../projection';
import type { Experiment, UserSession } from '../ontology';
import { can } from '../rbac';
import { useAuditStore, useExperimentStore, useMonitoringStore, useProductCatalogStore } from '../stores';
import { track } from '../telemetry';
import { fail, ok, type Fail, type Ok } from './result';

const find = (id: string) => useExperimentStore.getState().items.find((x) => x.id === id);

/** Deterministic noise per SKU — tests and demos see stable outcomes, not Math.random. */
function noise(sku: string, id: string): number {
  let h = 0;
  for (const c of sku + id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 0.85 + (h % 30) / 100; // 0.85–1.14 of forecast
}

export function saveExperiment(user: UserSession, draft: Pick<Experiment, 'name' | 'hypothesis' | 'skuIds' | 'deltaPct'>, id: string | null): (Ok & { experiment: Experiment }) | Fail {
  if (!can(user.role, 'experiment.manage')) return fail('forbidden');
  if (!draft.name.trim() || !draft.hypothesis.trim()) return fail('invalid');
  if (draft.skuIds.length === 0 || !Number.isFinite(draft.deltaPct) || draft.deltaPct === 0) return fail('invalid');
  const existing = id ? find(id) : undefined;
  if (id && !existing) return fail('not_found');
  if (existing && existing.status !== 'draft') return fail('invalid');
  const experiment: Experiment = {
    ...draft, name: draft.name.trim(), hypothesis: draft.hypothesis.trim(),
    id: existing?.id ?? `EXP-${Date.now().toString(36)}`,
    status: 'draft', ownerId: existing?.ownerId ?? user.userId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    startedAt: null, endedAt: null,
  };
  useExperimentStore.getState().upsert(experiment);
  useAuditStore.getState().record({
    type: 'experiment_save', actorId: user.userId, actorRole: user.role, entityType: 'experiment',
    entityId: experiment.id, sku: null, source: 'ui', note: experiment.name,
  });
  track('experiment_saved', { id: experiment.id });
  return { ok: true, experiment };
}

/**
 * Starts a draft: applies the treatment price to every in-scope SKU (fails closed on
 * any bound breach) and emits a forecast+actual Outcome per SKU from the demand model.
 */
export function startExperiment(user: UserSession, id: string): (Ok & { applied: number }) | Fail {
  if (!can(user.role, 'experiment.manage')) return fail('forbidden');
  const e = find(id);
  if (!e) return fail('not_found');
  if (e.status !== 'draft') return fail('invalid');
  const cat = useProductCatalogStore.getState();
  const targets = e.skuIds.map((sku) => cat.products.find((p) => p.sku === sku));
  if (targets.some((p) => !p)) return fail('not_found');
  // Pre-validate every price before mutating anything — a single breach aborts the run.
  const prices = targets.map((p) => Math.round((p!.price * (1 + e.deltaPct / 100)) / 100) * 100);
  for (const [i, p] of targets.entries()) {
    const np = prices[i]!;
    if (np < p!.minPrice || np > p!.maxPrice) return fail('guardrail');
  }
  if (!useExperimentStore.getState().transition(id, 'running')) return fail('invalid');
  const at = new Date().toISOString();
  const outcomes = targets.map((p, i) => {
    const np = prices[i]!;
    cat.applyPrice(p!.sku, np, 'experiment');
    const f = project(p!, np);
    const k = noise(p!.sku, e.id);
    return {
      id: `OUT-${e.id}-${p!.sku}`, sku: p!.sku, category: p!.category, recommendationId: null,
      priceEventId: null, experimentId: e.id,
      forecast: { units: f.units, revenue: f.revenue, margin: f.grossMargin },
      actual: { units: f.units * k, revenue: f.revenue * k, margin: f.grossMargin * (k * 0.97) },
      at,
    };
  });
  outcomes.forEach((o) => useMonitoringStore.getState().addOutcome(o));
  useAuditStore.getState().record({
    type: 'experiment_start', actorId: user.userId, actorRole: user.role, entityType: 'experiment',
    entityId: id, sku: null, source: 'ui', note: `${e.skuIds.length} SKUs · ${e.deltaPct}%`,
  });
  track('experiment_started', { id });
  return { ok: true, applied: outcomes.length };
}

export function concludeExperiment(user: UserSession, id: string) {
  if (!can(user.role, 'experiment.manage')) return fail('forbidden');
  const e = find(id);
  if (!e) return fail('not_found');
  if (!useExperimentStore.getState().transition(id, 'concluded')) return fail('invalid');
  useAuditStore.getState().record({
    type: 'experiment_conclude', actorId: user.userId, actorRole: user.role, entityType: 'experiment',
    entityId: id, sku: null, source: 'ui', note: e.name,
  });
  return ok();
}

export function cancelExperiment(user: UserSession, id: string) {
  if (!can(user.role, 'experiment.manage')) return fail('forbidden');
  const e = find(id);
  if (!e) return fail('not_found');
  if (!useExperimentStore.getState().transition(id, 'cancelled')) return fail('invalid');
  useAuditStore.getState().record({
    type: 'experiment_cancel', actorId: user.userId, actorRole: user.role, entityType: 'experiment',
    entityId: id, sku: null, source: 'ui', note: e.name,
  });
  return ok();
}

export interface ExperimentResult {
  n: number;
  expectedRevenue: number;
  observedRevenue: number;
  expectedMargin: number;
  observedMargin: number;
  daysRunning: number;
}

/** Expected vs observed for an experiment — derived from its emitted outcomes. */
export function experimentResults(e: Experiment, now = Date.now()): ExperimentResult {
  const outs = useMonitoringStore.getState().outcomes.filter((o) => o.experimentId === e.id);
  const start = e.startedAt ? new Date(e.startedAt).getTime() : now;
  const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
  return {
    n: outs.length,
    expectedRevenue: outs.reduce((s, o) => s + o.forecast.revenue, 0),
    observedRevenue: outs.reduce((s, o) => s + o.actual.revenue, 0),
    expectedMargin: outs.reduce((s, o) => s + o.forecast.margin, 0),
    observedMargin: outs.reduce((s, o) => s + o.actual.margin, 0),
    daysRunning: Math.max(0, (end - start) / 86_400_000),
  };
}
