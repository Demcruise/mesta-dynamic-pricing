'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { RationaleFactor } from '@/lib/ontology';
import { cn } from '@/lib/utils';

export function RationaleBreakdown({ factors, defaultOpen = true }: { factors: RationaleFactor[]; defaultOpen?: boolean }) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen(!open)}
        className="mb-1 flex items-center gap-1 text-xs font-medium text-muted transition-colors duration-fast hover:text-fg"
      >
        <ChevronDown className={cn('size-3.5 transition-transform duration-base', !open && '-rotate-90')} aria-hidden />
        {t('recommendations.factor.title')}
      </button>
      <div
        id={regionId}
        className={cn(
          'grid transition-[grid-template-rows] duration-base ease-decelerate motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden" aria-hidden={!open}>
          <ul className="flex flex-col gap-2 pt-1">
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
      </div>
    </div>
  );
}
