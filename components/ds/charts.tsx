'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

const W = 560, H = 200, P = { l: 44, r: 12, t: 12, b: 24 };

export interface Series { name: string; points: number[]; cls: string; dash?: boolean }

/** Multi-series line chart. Colours come from Tailwind stroke classes (tokens), never hex. */
export function LineChart({ series, labels, format = (v) => String(Math.round(v)), label }: {
  series: Series[]; labels: string[]; format?: (v: number) => string; label: string;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const n = Math.max(labels.length - 1, 1);
  const x = (i: number) => P.l + (i / n) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - ((v - min) / span) * (H - P.t - P.b);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} className="stroke-line-strong" />
        <text x={4} y={P.t + 8} className="fill-muted text-[10px]">{format(max)}</text>
        <text x={4} y={H - P.b} className="fill-muted text-[10px]">{format(min)}</text>
        {series.map((s) => (
          <path
            key={s.name}
            d={s.points.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}
            fill="none" strokeWidth="2" strokeDasharray={s.dash ? '5 4' : undefined} className={s.cls}
          />
        ))}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" strokeDasharray={s.dash ? '4 3' : undefined} className={s.cls} /></svg>
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars; values may be negative (bars grow from the centre line). */
export function BarChart({ items, format, label }: { items: { label: string; value: number }[]; format: (v: number) => string; label: string }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  const hasNeg = items.some((i) => i.value < 0);
  return (
    <ul aria-label={label} className="flex flex-col gap-1.5">
      {items.map((i) => {
        const w = (Math.abs(i.value) / maxAbs) * (hasNeg ? 50 : 100);
        return (
          <li key={i.label} className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-2 text-xs">
            <span className="truncate text-muted">{i.label}</span>
            <div className="relative h-3 rounded bg-subtle">
              <div
                className={`absolute top-0 h-full rounded ${i.value < 0 ? 'bg-down' : 'bg-brand'}`}
                style={{ width: `${w}%`, ...(hasNeg ? (i.value < 0 ? { right: '50%' } : { left: '50%' }) : { left: 0 }) }}
              />
            </div>
            <span className="tabular text-right">{format(i.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Every chart ships with the same data as an accessible table (screen readers, print, precision). */
export function ChartWithTable({ title, caption, chart, columns, rows }: {
  title: string; caption: string; chart: ReactNode; columns: string[]; rows: ReactNode[][];
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div role="group" aria-label={title} className="flex gap-1">
          {(['chart', 'table'] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} aria-pressed={view === v} onClick={() => setView(v)}>
              {t(v === 'chart' ? 'overview.charts.chart' : 'overview.charts.table')}
            </Button>
          ))}
        </div>
      </div>
      {view === 'chart' ? chart : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-surface text-xs text-muted">
              <tr>{columns.map((c, i) => <th key={c} scope="col" className={`py-1 font-medium ${i ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-line">
                  {r.map((c, ci) => (ci === 0 ? <th key={ci} scope="row" className="py-1 text-left font-normal">{c}</th> : <td key={ci} className="tabular py-1 text-right">{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
