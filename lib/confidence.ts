import type { CompetitorObservation, Product, Recommendation } from './ontology';

export interface ConfidenceFactor {
  key: 'freshness' | 'coverage' | 'agreement' | 'rule';
  /** 0–100 contribution score for this factor. */
  score: number;
  /** Human-readable evidence, e.g. '3 competitor observations, newest 12h ago'. */
  detail: string;
}

const DAY_MS = 86_400_000;

/**
 * REC-003 evidence: decomposes a recommendation's confidence into the factors behind it.
 * Every factor is derived from stored data — the breakdown explains the score rather
 * than recomputing it (rec.confidence stays the headline number).
 */
export function confidenceBreakdown(
  rec: Recommendation,
  product: Product | undefined,
  observations: CompetitorObservation[],
  now = Date.now(),
): ConfidenceFactor[] {
  const obs = observations.filter((o) => o.sku === rec.sku).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latestAge = obs[0] ? now - new Date(obs[0].observedAt).getTime() : Number.POSITIVE_INFINITY;
  // Freshness: full marks under 24h, decaying linearly to 0 at 7 days.
  const freshness = !Number.isFinite(latestAge) ? 0 : Math.max(0, Math.round(100 - (Math.max(0, latestAge - DAY_MS) / (6 * DAY_MS)) * 100));
  // Coverage: how many competitor feeds saw this SKU at all.
  const coverage = obs.length === 0 ? 0 : obs.length === 1 ? 55 : obs.length === 2 ? 80 : 100;
  // Agreement: dispersion of rationale weights — concentrated rationale = signals point one way.
  const weights = rec.rationale.map((f) => f.weight);
  const mean = weights.reduce((s, w) => s + w, 0) / Math.max(1, weights.length);
  const dispersion = weights.reduce((s, w) => s + Math.abs(w - mean), 0) / Math.max(1, weights.length);
  const agreement = Math.max(0, Math.min(100, Math.round(100 - dispersion * 150)));
  // Rule completeness: rule- and scenario-linked recs carry a provenance trail; pure agent output is softer.
  const traceability = rec.ruleId ? 100 : rec.scenarioId ? 80 : 55;
  const hours = Number.isFinite(latestAge) ? Math.max(1, Math.round(latestAge / 3_600_000)) : null;
  return [
    { key: 'freshness', score: freshness, detail: hours === null ? 'no competitor observations' : `newest observation ${hours}h ago` },
    { key: 'coverage', score: coverage, detail: `${obs.length} competitor observation${obs.length === 1 ? '' : 's'}` },
    { key: 'agreement', score: agreement, detail: weights.length <= 1 ? 'single driving factor' : `${weights.length} rationale factors` },
    { key: 'rule', score: traceability, detail: rec.ruleId ? `produced by ${rec.ruleId}` : rec.scenarioId ? `linked to ${rec.scenarioId}` : 'agent-generated' },
  ];
}
