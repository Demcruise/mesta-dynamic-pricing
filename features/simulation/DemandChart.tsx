'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { curve, project } from '@/lib/projection';
import { PriceValue } from '@/components/ds/PriceValue';

export interface Marker { label: string; price: number }

const W = 640, H = 260, PAD = { l: 56, r: 16, t: 16, b: 36 };

export function DemandChart({ product, markers }: { product: Product; markers: Marker[] }) {
  const { t, locale } = useTranslation();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const min = product.minPrice;
  const max = product.maxPrice;
  const pts = curve(product, min, max, 24);
  const yMax = Math.max(...pts.map((p) => p.unitsHigh));
  const yMin = Math.min(...pts.map((p) => p.unitsLow));
  const x = (price: number) => PAD.l + ((price - min) / (max - min || 1)) * (W - PAD.l - PAD.r);
  const y = (u: number) => H - PAD.b - ((u - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.price)},${y(p.units)}`).join(' ');
  const band =
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.price)},${y(p.unitsHigh)}`).join(' ') +
    [...pts].reverse().map((p) => `L${x(p.price)},${y(p.unitsLow)}`).join(' ') + 'Z';

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('simulation.chart.title')}</h2>
        <div role="group" className="flex gap-1">
          {(['chart', 'table'] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} aria-pressed={view === v} onClick={() => setView(v)}>
              {t(v === 'chart' ? 'simulation.chart.toggleChart' : 'simulation.chart.toggleTable')}
            </Button>
          ))}
        </div>
      </div>
      {view === 'chart' ? (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('simulation.chart.title')} className="w-full">
          <path d={band} className="fill-brand-soft" />
          <path d={line} fill="none" strokeWidth="2" className="stroke-brand" />
          <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="stroke-line-strong" />
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} className="stroke-line-strong" />
          <text x={PAD.l} y={H - 8} className="fill-muted text-[10px]">{formatPrice(min, locale)}</text>
          <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-muted text-[10px]">{formatPrice(max, locale)}</text>
          <text x={W / 2} y={H - 8} textAnchor="middle" className="fill-muted text-[10px]">{t('simulation.chart.x')}</text>
          <text x={4} y={PAD.t + 8} className="fill-muted text-[10px]">{Math.round(yMax)}</text>
          <text x={4} y={H - PAD.b} className="fill-muted text-[10px]">{Math.round(yMin)}</text>
          {markers.map((m) => {
            const px = Math.min(Math.max(x(m.price), PAD.l), W - PAD.r);
            const py = y(project(product, m.price).units);
            return (
              <g key={m.label}>
                <circle cx={px} cy={py} r="7" className="fill-brand stroke-surface" strokeWidth="2" />
                <text x={px} y={py + 3.5} textAnchor="middle" className="fill-brand-fg text-[9px] font-semibold">{m.label}</text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('simulation.chart.tableCaption')}</caption>
            <thead className="sticky top-0 bg-surface text-xs text-muted">
              <tr>
                <th scope="col" className="py-1 text-left font-medium">{t('simulation.chart.x')}</th>
                <th scope="col" className="py-1 text-right font-medium">{t('simulation.chart.y')}</th>
                <th scope="col" className="py-1 text-right font-medium">{t('simulation.chart.ci')}</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.price} className="border-t border-line">
                  <td className="py-1"><PriceValue value={Math.round(p.price)} /></td>
                  <td className="tabular py-1 text-right">{Math.round(p.units)}</td>
                  <td className="tabular py-1 text-right text-muted">{Math.round(p.unitsLow)} – {Math.round(p.unitsHigh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
