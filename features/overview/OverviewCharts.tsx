'use client';

import { useMemo, useState } from 'react';
import { BarChart, ChartWithTable, LineChart } from '@/components/ds/charts';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { marginTrend } from './kpis';

const PERIODS = { weekly: 7, monthly: 14, quarterly: 28 } as const;
type Period = keyof typeof PERIODS;
const selectCls = 'h-8 rounded-input border border-line bg-surface px-2 text-xs text-fg transition-colors duration-fast ease-standard';

interface Props {
  products: Product[];
  volume: { label: string; value: number }[];
  gap: { label: string; value: number }[];
}

/** Lazy-loaded chart block for the Overview. Each chart has a data-table twin. */
export function OverviewCharts({ products, volume, gap }: Props) {
  const { t, locale } = useTranslation();
  const pct = (v: number) => formatPercent(v, locale);
  const [period, setPeriod] = useState<Period>('weekly');
  const margin = useMemo(() => marginTrend(products, PERIODS[period]), [products, period]);
  const avg = margin.length ? margin.reduce((a, b) => a + b, 0) / margin.length : 0;

  return (
    <div className="grid min-w-0 grid-cols-1 content-start gap-4">
      <ChartWithTable
        title={t('overview.charts.marginTrend')}
        caption={t('overview.charts.marginCaption')}
        controls={
          <select
            aria-label={t('overview.charts.periodLabel')}
            className={selectCls}
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            {(Object.keys(PERIODS) as Period[]).map((p) => (
              <option key={p} value={p}>{t(`overview.charts.${p}`)}</option>
            ))}
          </select>
        }
        headline={
          <p className="mb-2 flex items-baseline gap-2">
            <span className="tabular text-2xl font-semibold">{pct(avg)}</span>
            <span className="text-xs text-muted">{t('overview.charts.avgMargin')}</span>
          </p>
        }
        chart={<LineChart label={t('overview.charts.marginTrend')} labels={margin.map((_, i) => String(i))} format={pct} series={[{ name: t('overview.charts.marginTrend'), points: margin, cls: 'stroke-brand' }]} />}
        columns={[t('overview.charts.category'), t('overview.charts.value')]}
        rows={margin.map((v, i) => [t('overview.charts.period', { n: i + 1 }), pct(v)])}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartWithTable
          title={t('overview.charts.volume')}
          caption={t('overview.charts.volumeCaption')}
          chart={<BarChart label={t('overview.charts.volume')} items={volume} format={(v) => String(v)} />}
          columns={[t('overview.charts.category'), t('overview.charts.value')]}
          rows={volume.map((v) => [v.label, String(v.value)])}
        />
        <ChartWithTable
          title={t('overview.charts.gap')}
          caption={t('overview.charts.gapCaption')}
          chart={
            <>
              <BarChart label={t('overview.charts.gap')} items={gap} format={pct} />
              <p className="mt-2 text-xs text-faint">◀ {t('overview.charts.cheaper')} · {t('overview.charts.pricier')} ▶</p>
            </>
          }
          columns={[t('overview.charts.category'), t('overview.charts.value')]}
          rows={gap.map((g) => [g.label, pct(g.value)])}
        />
      </div>
    </div>
  );
}
