'use client';

import { ChartWithTable, LineChart } from '@/components/ds/charts';
import { formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Outcome } from '@/lib/ontology';

/** Aggregate forecast vs actual, cumulative over deployed changes. Lazy-loaded (chart-heavy). */
export function ForecastCharts({ outcomes, metric }: { outcomes: Outcome[]; metric: 'revenue' | 'margin' | 'units' }) {
  const { t, locale } = useTranslation();
  let f = 0, a = 0;
  const cumulative = outcomes.map((o) => {
    f += o.forecast[metric];
    a += o.actual[metric];
    return { id: o.id, f, a };
  });
  const fmt = (v: number) => (metric === 'units' ? String(Math.round(v)) : formatPrice(Math.round(v), locale));
  return (
    <ChartWithTable
      title={`${t('monitoring.forecast.aggregate')} · ${t(`monitoring.forecast.${metric}`)}`}
      caption={t('monitoring.forecast.caption')}
      chart={
        <LineChart
          label={t('monitoring.forecast.aggregate')}
          labels={cumulative.map((c) => c.id)}
          format={(v) => (metric === 'units' ? String(Math.round(v)) : `${Math.round(v / 1_000_000)}M`)}
          series={[
            { name: t('monitoring.forecast.forecastLabel'), points: cumulative.map((c) => c.f), cls: 'stroke-hold', dash: true },
            { name: t('monitoring.forecast.actualLabel'), points: cumulative.map((c) => c.a), cls: 'stroke-brand' },
          ]}
        />
      }
      columns={[t('monitoring.forecast.trace'), t('monitoring.forecast.forecastLabel'), t('monitoring.forecast.actualLabel')]}
      rows={cumulative.map((c) => [c.id, fmt(c.f), fmt(c.a)])}
    />
  );
}
