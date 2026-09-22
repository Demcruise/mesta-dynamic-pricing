'use client';

import { useMemo } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { ErrorState, KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { MetricDefinition } from '@/components/ds/trust';
import { formatPercent, formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { useAuditLog, useDeploymentRecords, useScopedRecommendations, useScopedSkuSet, useSkuList } from '@/lib/queries';

const DAY_MS = 86_400_000;

export function AnalyticsPage() {
  const { t, locale } = useTranslation();
  const recs = useScopedRecommendations();
  const products = useSkuList();
  const deployments = useDeploymentRecords();
  const audit = useAuditLog();
  const scoped = useScopedSkuSet();

  const stats = useMemo(() => {
    const decided = recs.data.filter((r) => r.status === 'approved' || r.status === 'rejected' || r.status === 'adjusted');
    const accepted = decided.filter((r) => r.status !== 'rejected');
    const acceptance = decided.length ? accepted.length / decided.length : null;

    const latencies = recs.data
      .filter((r) => r.decidedAt)
      .map((r) => new Date(r.decidedAt as string).getTime() - new Date(r.createdAt).getTime());
    const avgLatencyDays = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length / DAY_MS : null;

    const leakage = recs.data
      .filter((r) => r.status === 'rejected' || r.status === 'expired')
      .reduce((s, r) => s + Math.max(0, r.projectedMarginImpact), 0);

    const list = scoped ? products.data.filter((p) => scoped.has(p.sku)) : products.data;
    const indexable = list.filter((p) => p.competitorAvg > 0);
    const priceIndex = indexable.length
      ? indexable.reduce((s, p) => s + p.price / p.competitorAvg, 0) / indexable.length
      : null;

    const deployable = deployments.data.filter((d) => d.status === 'synced' || d.status === 'failed');
    const deploySuccess = deployable.length ? deployable.filter((d) => d.status === 'synced').length / deployable.length : null;
    const overrides = audit.data.filter((e) => e.type === 'manual_override').length;

    return { acceptance, avgLatencyDays, leakage, priceIndex, deploySuccess, overrides, decided: decided.length };
  }, [recs.data, products.data, deployments.data, audit.data, scoped]);

  const byCategory = useMemo(() => {
    const list = scoped ? products.data.filter((p) => scoped.has(p.sku)) : products.data;
    const map = new Map<string, { idx: number[]; leakage: number; decided: number; accepted: number }>();
    const recBySku = new Map<string, typeof recs.data>();
    for (const r of recs.data) {
      const arr = recBySku.get(r.sku) ?? [];
      arr.push(r);
      recBySku.set(r.sku, arr);
    }
    for (const p of list) {
      const row = map.get(p.category) ?? { idx: [], leakage: 0, decided: 0, accepted: 0 };
      if (p.competitorAvg > 0) row.idx.push(p.price / p.competitorAvg);
      for (const r of recBySku.get(p.sku) ?? []) {
        if (r.status === 'rejected' || r.status === 'expired') row.leakage += Math.max(0, r.projectedMarginImpact);
        if (r.status === 'approved' || r.status === 'rejected' || r.status === 'adjusted') {
          row.decided++;
          if (r.status !== 'rejected') row.accepted++;
        }
      }
      map.set(p.category, row);
    }
    return [...map.entries()]
      .map(([category, row]) => ({
        category,
        priceIndex: row.idx.length ? row.idx.reduce((a, b) => a + b, 0) / row.idx.length : null,
        leakage: row.leakage,
        acceptance: row.decided ? row.accepted / row.decided : null,
        decided: row.decided,
      }))
      .sort((a, b) => b.leakage - a.leakage);
  }, [products.data, recs.data, scoped]);

  const loading = recs.isLoading || products.isLoading || deployments.isLoading || audit.isLoading;
  const errored = recs.isError || products.isError || deployments.isError || audit.isError;

  return (
    <>
      <PageHeader title={t('analytics.page.title')} subtitle={t('analytics.page.desc')} />
      {loading ? <LoadingRows rows={4} /> : errored ? (
        <ErrorState title={t('common.state.error')} onRetry={() => { recs.refetch(); products.refetch(); deployments.refetch(); audit.refetch(); }} />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={<MetricDefinition label={t('analytics.kpi.acceptance')} definition={t('analytics.kpi.acceptanceDef')} />}
              value={stats.acceptance === null ? '—' : formatPercent(stats.acceptance, locale)}
              hint={t('analytics.kpi.acceptanceHint', { n: stats.decided })}
            />
            <KpiCard
              label={<MetricDefinition label={t('analytics.kpi.priceIndex')} definition={t('analytics.kpi.priceIndexDef')} />}
              value={stats.priceIndex === null ? '—' : `${Math.round(stats.priceIndex * 100)}`}
              hint={t('analytics.kpi.priceIndexHint')}
            />
            <KpiCard
              label={<MetricDefinition label={t('analytics.kpi.leakage')} definition={t('analytics.kpi.leakageDef')} />}
              value={formatPrice(Math.round(stats.leakage), locale)}
              hint={t('analytics.kpi.leakageHint')}
            />
            <KpiCard
              label={<MetricDefinition label={t('analytics.kpi.latency')} definition={t('analytics.kpi.latencyDef')} />}
              value={stats.avgLatencyDays === null ? '—' : t('analytics.kpi.latencyValue', { d: Math.round(stats.avgLatencyDays * 10) / 10 })}
              hint={t('analytics.kpi.latencyHint')}
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-3 shadow-e1">
              <p className="text-xs text-muted">{t('analytics.kpi.deploySuccess')}</p>
              <p className="mt-1 text-lg font-semibold tabular">
                {stats.deploySuccess === null ? '—' : formatPercent(stats.deploySuccess, locale)}
              </p>
            </div>
            <div className="rounded-card border border-line bg-surface p-3 shadow-e1">
              <p className="text-xs text-muted">{t('analytics.kpi.overrides')}</p>
              <p className="mt-1 text-lg font-semibold tabular">{stats.overrides}</p>
            </div>
          </div>

          <section aria-label={t('analytics.byCategory.title')}>
            <h2 className="mb-2 text-sm font-semibold">{t('analytics.byCategory.title')}</h2>
            <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">{t('analytics.byCategory.title')}</caption>
                <thead className="bg-subtle text-xs text-muted">
                  <tr className="h-row">
                    {(['category', 'priceIndex', 'gap', 'acceptance', 'leakage'] as const).map((c) => (
                      <th key={c} scope="col" className="px-3 py-row text-left font-medium">{t(`analytics.col.${c}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((r) => (
                    <tr key={r.category} className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                      <td className="px-3 py-row font-medium">{r.category}</td>
                      <td className="tabular px-3">{r.priceIndex === null ? '—' : Math.round(r.priceIndex * 100)}</td>
                      <td className="px-3">{r.priceIndex === null ? '—' : <DeltaBadge value={r.priceIndex - 1} />}</td>
                      <td className="tabular px-3">{r.acceptance === null ? '—' : formatPercent(r.acceptance, locale)}</td>
                      <td className="tabular px-3">{formatPrice(Math.round(r.leakage), locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
