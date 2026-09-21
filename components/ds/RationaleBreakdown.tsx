'use client';

import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { RationaleFactor } from '@/lib/ontology';

export function RationaleBreakdown({ factors }: { factors: RationaleFactor[] }) {
  const { t, locale } = useTranslation();
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted">{t('recommendations.factor.title')}</h3>
      <ul className="flex flex-col gap-2">
        {factors.map((f) => (
          <li key={f.key} className="text-xs">
            <div className="flex justify-between">
              <span className="font-medium">{t(`recommendations.factor.${f.key}`)}</span>
              <span className="tabular text-muted">{formatPercent(f.weight, locale, 0)}</span>
            </div>
            <div
              role="meter"
              aria-label={t(`recommendations.factor.${f.key}`)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(f.weight * 100)}
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle"
            >
              <div className="h-full rounded-full bg-agent" style={{ width: `${f.weight * 100}%` }} />
            </div>
            <p className="mt-0.5 text-faint">{f.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
