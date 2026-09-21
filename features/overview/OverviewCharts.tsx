'use client';

import { BarChart, ChartWithTable, LineChart } from '@/components/ds/charts';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';

interface Props {
  margin: number[];
  volume: { label: string; value: number }[];
  gap: { label: string; value: number }[];
}

/** Lazy-loaded chart block for the Overview. Each chart has a data-table twin. */
export function OverviewCharts({ margin, volume, gap }: Props) {
  const { t, locale } = useTranslation();
  const pct = (v: number) => formatPercent(v, locale);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartWithTable
        title={t('overview.charts.marginTrend')}
        caption={t('overview.charts.marginCaption')}
        chart={<LineChart label={t('overview.charts.marginTrend')} labels={margin.map((_, i) => String(i))} format={pct} series={[{ name: t('overview.charts.marginTrend'), points: margin, cls: 'stroke-brand' }]} />}
        columns={[t('overview.charts.category'), t('overview.charts.value')]}
        rows={margin.map((v, i) => [t('overview.charts.period', { n: i + 1 }), pct(v)])}
      />
      <ChartWithTable
        title={t('overview.charts.volume')}
        caption={t('overview.charts.volumeCaption')}
        chart={<BarChart label={t('overview.charts.volume')} items={volume} format={(v) => String(v)} />}
        columns={[t('overview.charts.category'), t('overview.charts.value')]}
        rows={volume.map((v) => [v.label, String(v.value)])}
      />
      <div className="lg:col-span-2">
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
