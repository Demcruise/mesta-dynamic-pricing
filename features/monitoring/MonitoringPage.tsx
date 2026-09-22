'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { flagForModelReview, groupAnomalies } from '@/lib/actions/monitoring';
import { useTranslation } from '@/lib/i18n';
import type { AnomalyAlert } from '@/lib/ontology';
import { useAnomalies, useOutcomes } from '@/lib/queries';
import { useMonitoringStore, useSessionStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

const ForecastCharts = dynamic(() => import('./ForecastCharts').then((m) => m.ForecastCharts), {
  loading: () => <LoadingRows rows={3} rowHeight={60} />,
});

type Metric = 'revenue' | 'margin' | 'units';
const SEV_CLS = { info: 'bg-info-soft text-info', warning: 'bg-warn-soft text-warn', critical: 'bg-down-soft text-down' } as const;

function Severity({ s }: { s: AnomalyAlert['severity'] }) {
  const { t } = useTranslation();
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEV_CLS[s])}>{t(`common.severity.${s}`)}</span>;
}

export function MonitoringPage() {
  const { t } = useTranslation();
  const outcomes = useOutcomes();
  const anomalies = useAnomalies();
  const threshold = useMonitoringStore((s) => s.threshold);
  const setThreshold = useMonitoringStore((s) => s.setThreshold);
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [metric, setMetric] = useState<Metric>('revenue');
  const [mode, setMode] = useState<'digest' | 'granular'>('digest');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => anomalies.data.filter((a) => Math.abs(a.deviationPercent) > threshold), [anomalies.data, threshold]);
  const groups = useMemo(() => groupAnomalies(visible), [visible]);
  const sorted = useMemo(() => [...outcomes.data].sort((a, b) => a.at.localeCompare(b.at)), [outcomes.data]);

  const flag = (a: AnomalyAlert) => {
    const r = flagForModelReview(user, a.id);
    toast(r.ok ? t('monitoring.toast.flagged', { sku: a.sku }) : t(`monitoring.err.${r.error}`));
  };

  const FlagCell = ({ a }: { a: AnomalyAlert }) => (
    <RoleGate action="monitoring.flag_model">
      <Button size="sm" variant="secondary" disabled={a.flaggedForReview} aria-label={t('monitoring.anomaly.flagAria', { sku: a.sku })} onClick={() => flag(a)}>
        {a.flaggedForReview ? t('monitoring.anomaly.flagged') : t('monitoring.anomaly.flag')}
      </Button>
    </RoleGate>
  );

  return (
    <>
      <PageHeader title={t('monitoring.title')} subtitle={t('monitoring.subtitle')} />
      {outcomes.isLoading || anomalies.isLoading ? <LoadingRows rows={5} /> : outcomes.isError || anomalies.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={() => { outcomes.refetch(); anomalies.refetch(); }} />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t('monitoring.forecast.title')}</h2>
            <div role="group" aria-label={t('monitoring.forecast.title')} className="flex gap-1">
              {(['revenue', 'margin', 'units'] as const).map((m) => (
                <Button key={m} size="sm" variant={metric === m ? 'primary' : 'secondary'} aria-pressed={metric === m} onClick={() => setMetric(m)}>
                  {t(`monitoring.forecast.${m}`)}
                </Button>
              ))}
            </div>
          </div>
          {sorted.length === 0 ? <EmptyState title={t('monitoring.forecast.empty')} /> : (
            <>
              <ForecastCharts outcomes={sorted} metric={metric} />
              <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">{t('monitoring.forecast.caption')}</caption>
                  <thead className="bg-subtle text-xs text-muted">
                    <tr>
                      {(['sku', 'forecastLabel', 'actualLabel', 'variance', 'trace'] as const).map((c) => (
                        <th key={c} scope="col" className={cn('px-3 py-2 font-medium', c === 'sku' || c === 'trace' ? 'text-left' : 'text-right')}>
                          {c === 'sku' ? t('monitoring.anomaly.sku') : t(`monitoring.forecast.${c}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...sorted].reverse().map((o) => {
                      const f = o.forecast[metric], a = o.actual[metric];
                      const fmt = (v: number) => (metric === 'units' ? String(Math.round(v)) : <PriceValue value={Math.round(v)} />);
                      return (
                        <tr key={o.id} className="border-t border-line">
                          <td className="px-3 py-2"><Link href={`/catalog/${o.sku}`} className="tabular text-brand hover:underline">{o.sku}</Link></td>
                          <td className="tabular px-3 text-right">{fmt(f)}</td>
                          <td className="tabular px-3 text-right">{fmt(a)}</td>
                          <td className="px-3 text-right"><DeltaBadge value={f ? (a - f) / f : 0} /></td>
                          <td className="px-3">{o.recommendationId ? <Link href={`/recommendations/${o.recommendationId}`} className="tabular text-brand underline">{o.recommendationId}</Link> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-sm font-semibold">{t('monitoring.anomaly.title')}</h2>
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t('monitoring.anomaly.threshold')}>
                  {(p) => <Input {...p} type="number" min={0} max={100} className="w-28" value={threshold} onChange={(e) => setThreshold(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />}
                </Field>
                <div role="group" aria-label={t('monitoring.anomaly.mode')} className="flex gap-1">
                  {(['digest', 'granular'] as const).map((m) => (
                    <Button key={m} variant={mode === m ? 'primary' : 'secondary'} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(`monitoring.anomaly.${m}`)}</Button>
                  ))}
                </div>
              </div>
            </div>

            {visible.length === 0 ? <EmptyState title={t('monitoring.anomaly.empty')} /> : mode === 'digest' ? (
              <ul className="flex flex-col gap-2">
                {groups.map((g) => (
                  <li key={g.category} className="rounded-card border border-line bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div aria-label={t('monitoring.anomaly.digestAria', { category: g.category, n: g.items.length, pct: g.maxDeviation })}>
                        <p className="text-sm font-semibold">{g.category} <Severity s={g.severity} /></p>
                        <p className="text-xs text-muted">{t('monitoring.anomaly.count', { n: g.items.length })} · {t('monitoring.anomaly.worst', { pct: g.maxDeviation })}</p>
                      </div>
                      <Button size="sm" variant="secondary" aria-expanded={expanded === g.category} onClick={() => setExpanded(expanded === g.category ? null : g.category)}>
                        {t('monitoring.anomaly.expand')}
                      </Button>
                    </div>
                    {expanded === g.category && (
                      <ul className="mt-2 divide-y divide-line text-sm">
                        {g.items.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                            <span><Link href={`/catalog/${a.sku}`} className="tabular text-brand hover:underline">{a.sku}</Link> · <span className="tabular">{a.deviationPercent}%</span> · {t(`common.channel.${a.channel}`)}</span>
                            <FlagCell a={a} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">{t('monitoring.anomaly.caption')}</caption>
                  <thead className="bg-subtle text-xs text-muted">
                    <tr>{(['sku', 'category', 'deviation', 'channel', 'severity', 'actions'] as const).map((c) => <th key={c} scope="col" className="px-3 py-2 text-left font-medium">{t(`monitoring.anomaly.${c}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {[...visible].sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent)).map((a) => (
                      <tr key={a.id} className="border-t border-line">
                        <td className="px-3 py-2"><Link href={`/catalog/${a.sku}`} className="tabular text-brand hover:underline">{a.sku}</Link></td>
                        <td className="px-3">{a.category}</td>
                        <td className="tabular px-3">{a.deviationPercent}%</td>
                        <td className="px-3">{t(`common.channel.${a.channel}`)}</td>
                        <td className="px-3"><Severity s={a.severity} /></td>
                        <td className="px-3"><FlagCell a={a} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
