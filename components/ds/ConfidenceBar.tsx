'use client';

import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function confidenceTier(v: number): 'high' | 'medium' | 'low' {
  return v >= 80 ? 'high' : v >= 60 ? 'medium' : 'low';
}

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const { t } = useTranslation();
  const v = Math.max(0, Math.min(100, value));
  const tier = confidenceTier(v);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="meter"
        aria-label={t('common.confidence.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-valuetext={`${v}% ${t(`common.confidence.${tier}`)}`}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-subtle"
      >
        <div
          className={cn('h-full rounded-full', tier === 'high' && 'bg-up', tier === 'medium' && 'bg-warn', tier === 'low' && 'bg-down')}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="tabular text-xs text-muted">
        {v}% · {t(`common.confidence.${tier}`)}
      </span>
    </div>
  );
}
