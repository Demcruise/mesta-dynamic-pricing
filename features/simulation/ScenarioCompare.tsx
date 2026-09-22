'use client';

import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { project } from '@/lib/projection';
import { cn } from '@/lib/utils';

type Projection = ReturnType<typeof project>;
export interface CompareColumn { label: string; p: Projection }

const COL_CLS = ['bg-hold', 'bg-brand', 'bg-agent', 'bg-info'] as const;

interface Metric {
  key: 'revenue' | 'marginPct' | 'units';
  get: (p: Projection) => number;
  fmt: (v: number, locale: 'id' | 'en') => React.ReactNode;
}

const METRICS: Metric[] = [
  { key: 'revenue', get: (p) => p.revenue, fmt: (v) => <PriceValue value={Math.round(v)} /> },
  { key: 'marginPct', get: (p) => p.marginPct * 100, fmt: (v, l) => <span className="tabular">{formatPercent(v / 100, l)}</span> },
  { key: 'units', get: (p) => p.units, fmt: (v) => <span className="tabular">{Math.round(v)}</span> },
];

/** Baseline + up to 3 scenarios as grouped bars per headline metric — readable in one glance. */
export function ScenarioCompare({ columns }: { columns: CompareColumn[] }) {
  const { t, locale } = useTranslation();
  if (columns.length < 2) return null;
  return (
    <section className="mb-4 rounded-card border border-line bg-surface p-card shadow-e1" aria-label={t('simulation.compare.title')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('simulation.compare.title')}</h2>
        <ul className="flex flex-wrap gap-3 text-xs text-muted">
          {columns.map((c, i) => (
            <li key={c.label} className="flex items-center gap-1.5">
              <i className={cn('inline-block size-2.5 rounded-sm', COL_CLS[i % COL_CLS.length])} aria-hidden />
              {c.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {METRICS.map((m) => {
          const max = Math.max(...columns.map((c) => Math.abs(m.get(c.p))), 1e-9);
          const base = m.get(columns[0]!.p);
          return (
            <div key={m.key}>
              <p className="mb-1.5 text-xs font-medium text-muted">{t(`simulation.metric.${m.key}`)}</p>
              <ul className="flex flex-col gap-1">
                {columns.map((c, i) => {
                  const v = m.get(c.p);
                  return (
                    <li key={c.label} className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-2 text-xs">
                      <span className="truncate text-muted">{c.label}</span>
                      <span className="h-2.5 overflow-hidden rounded bg-subtle">
                        <span
                          className={cn('block h-full rounded', COL_CLS[i % COL_CLS.length])}
                          style={{ width: `${Math.max(2, (Math.abs(v) / max) * 100)}%` }}
                        />
                      </span>
                      <span className="flex items-center justify-end gap-1 text-right">
                        {m.fmt(v, locale)}
                        {i > 0 && m.key !== 'marginPct' && base !== 0 && <DeltaBadge value={(v - base) / Math.abs(base)} className="px-1 text-[10px]" />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
