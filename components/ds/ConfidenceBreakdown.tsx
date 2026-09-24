'use client';

import { useTranslation } from '@/lib/i18n';
import { confidenceBreakdown } from '@/lib/confidence';
import type { CompetitorObservation, Product, Recommendation } from '@/lib/ontology';

/**
 * REC-003 evidence block: why the confidence score is what it is —
 * freshness, coverage, signal agreement, and provenance, each derived from stored data.
 */
export function ConfidenceBreakdown({
  rec, product, observations,
}: {
  rec: Recommendation;
  product: Product | undefined;
  observations: CompetitorObservation[];
}) {
  const { t } = useTranslation();
  const factors = confidenceBreakdown(rec, product, observations);
  return (
    <ul className="space-y-2" aria-label={t('recommendations.confidence.title')}>
      {factors.map((f) => (
        <li key={f.key}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">{t(`recommendations.confidence.${f.key}`)}</span>
            <span className="tabular text-muted">{f.score}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.score} aria-label={t(`recommendations.confidence.${f.key}`)}>
            {/* Compositor-only fill: scaleX animates without layout/paint (Lighthouse NCA). */}
            <div className="h-full w-full origin-left rounded-full bg-brand transition-transform duration-base" style={{ transform: `scaleX(${f.score / 100})` }} />
          </div>
          <p className="mt-0.5 text-xs text-faint">{f.detail}</p>
        </li>
      ))}
    </ul>
  );
}
