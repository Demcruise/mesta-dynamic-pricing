'use client';

import { ChevronDown, Percent, Scale, Tags } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarChart, ChartHeadline, ChartWithTable, LineChart } from '@/components/ds/charts';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { controlCls } from '@/components/ui/field';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { cn } from '@/lib/utils';
import { marginTrend } from './kpis';

const PERIODS = { weekly: 7, monthly: 14, quarterly: 28 } as const;
type Period = keyof typeof PERIODS;

interface Props {
  products: Product[];
  volume: { label: string; value: number }[];
  gap: { label: string; value: number }[];
}

/** Reference "Weekly ▾" control: a native select dressed as the compact header button. */
function PeriodSelect({ value, onChange, label, options }: {
  value: Period; onChange: (p: Period) => void; label: string; options: { v: Period; text: string }[];
}) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className={cn(controlCls, 'appearance-none pr-8')}
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.text}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
    </label>
  );
}

/** Lazy-loaded chart block for the Overview. Each chart has a data-table twin. */
export function OverviewCharts({ products, volume, gap }: Props) {
  const { t, locale } = useTranslation();
  const pct = (v: number) => formatPercent(v, locale);
  const pctAxis = (v: number) => formatPercent(v, locale, 1);
  const [period, setPeriod] = useState<Period>('weekly');
  const margin = useMemo(() => marginTrend(products, PERIODS[period]), [products, period]);
  const avg = margin.length ? margin.reduce((a, b) => a + b, 0) / margin.length : 0;
  const first = margin[0] ?? 0, last = margin[margin.length - 1] ?? 0;
  const change = first ? (last - first) / first : 0;
  const labels = margin.map((_, i) => t('overview.charts.period', { n: i + 1 }));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ChartWithTable
        variant="hero"
        icon={Percent}
        title={t('overview.charts.marginTrend')}
        caption={t('overview.charts.marginCaption')}
        meta={t('overview.charts.metaMargin', { days: PERIODS[period] })}
        controls={
          <PeriodSelect
            label={t('overview.charts.periodLabel')}
            value={period}
            onChange={setPeriod}
            options={(Object.keys(PERIODS) as Period[]).map((p) => ({ v: p, text: t(`overview.charts.${p}`) }))}
          />
        }
        headline={
          <>
            <ChartHeadline value={pct(avg)}>
              <span className="text-xs font-medium tracking-label text-faint">{t('overview.charts.avgMargin')}</span>
            </ChartHeadline>
            <span className="flex items-center gap-1.5 text-xs font-medium leading-none">
              <DeltaBadge value={change} variant="text" />
              <span className="tracking-label text-faint">{t('overview.charts.vsStart')}</span>
            </span>
          </>
        }
        chart={
          <LineChart
            label={t('overview.charts.marginTrend')}
            labels={labels}
            format={pct}
            axisFormat={pctAxis}
            height={300}
            series={[{ name: t('overview.charts.marginTrend'), points: margin, tone: 'brand' }]}
          />
        }
        columns={[t('overview.charts.periodCol'), t('overview.charts.value')]}
        rows={margin.map((v, i) => [labels[i], pct(v)])}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartWithTable
          icon={Tags}
          title={t('overview.charts.volume')}
          caption={t('overview.charts.volumeCaption')}
          meta={t('overview.charts.metaVolume')}
          chart={<BarChart label={t('overview.charts.volume')} items={volume} format={(v) => String(v)} />}
          columns={[t('overview.charts.category'), t('overview.charts.value')]}
          rows={volume.map((v) => [v.label, String(v.value)])}
        />
        <ChartWithTable
          icon={Scale}
          title={t('overview.charts.gap')}
          caption={t('overview.charts.gapCaption')}
          meta={t('overview.charts.metaGap')}
          chart={
            <>
              <BarChart label={t('overview.charts.gap')} items={gap} format={pct} />
              <p className="mt-4 flex justify-between text-[11px] font-medium text-faint">
                <span>◀ {t('overview.charts.cheaper')}</span>
                <span>{t('overview.charts.pricier')} ▶</span>
              </p>
            </>
          }
          columns={[t('overview.charts.category'), t('overview.charts.value')]}
          rows={gap.map((g) => [g.label, pct(g.value)])}
        />
      </div>
    </div>
  );
}
