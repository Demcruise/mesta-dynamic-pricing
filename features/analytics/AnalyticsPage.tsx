'use client';

import { useMemo } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { ErrorState, KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { MetricDefinition } from '@/components/ds/trust';
import { formatPercent, formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { StrategyObjective } from '@/lib/ontology';
import { project } from '@/lib/projection';
import { useAuditLog, useDeploymentRecords, useScopedRecommendations, useScopedSkuSet, useSkuList, useStrategies } from '@/lib/queries';

const DAY_MS = 86_400_000;
const OBJECTIVES: (StrategyObjective | 'none')[] = ['maximize_margin', 'maximize_revenue', 'match_competitor', 'clear_inventory', 'none'];

export function AnalyticsPage() {
  const { t, locale } = useTranslation();
  const recs = useScopedRecommendations();
  const products = useSkuList();
  const strategies = useStrategies();
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

    // AN-001 additions — all demand figures are demand-model estimates.
    const unitsSold = list.length ? list.reduce((s, p) => s + project(p, p.price).units, 0) : null;
    const asp = list.length ? list.reduce((s, p) => s + p.price, 0) / list.length : null;
    const markdowned = list.filter((p) => p.priceHistory.length > 0 && p.price < p.priceHistory[0]!.price);
    const markdownShare = list.length ? markdowned.length / list.length : null;
    // Price-change success: approved recs whose deployments all synced (no failure/rollback).
    const recIds = new Set(recs.data.filter((r) => r.status === 'approved' || r.status === 'adjusted').map((r) => r.id));
    const deployedRecs = new Map<string, { ok: number; bad: number }>();
    for (const d of deployments.data) {
      if (!recIds.has(d.recommendationId)) continue;
      const row = deployedRecs.get(d.recommendationId) ?? { ok: 0, bad: 0 };
      if (d.status === 'synced') row.ok++;
      else if (d.status === 'failed' || d.status === 'rolled_back') row.bad++;
      deployedRecs.set(d.recommendationId, row);
    }
    const settled = [...deployedRecs.values()].filter((r) => r.ok + r.bad > 0);
    const changeSuccess = settled.length ? settled.filter((r) => r.bad === 0 && r.ok > 0).length / settled.length : null;

    return { acceptance, avgLatencyDays, leakage, priceIndex, deploySuccess, overrides, decided: decided.length, unitsSold, asp, markdownShare, changeSuccess };
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

  // AN-003: performance grouped by the owning strategy's objective (unlinked recs → 'none').
  const byObjective = useMemo(() => {
    const objByStrategy = new Map(strategies.data.map((s) => [s.id, s.objective] as const));
    const activeByObjective = new Map<StrategyObjective, number>();
    for (const s of strategies.data) {
      if (s.status === 'active') activeByObjective.set(s.objective, (activeByObjective.get(s.objective) ?? 0) + 1);
    }
    const rows = new Map<StrategyObjective | 'none', { recs: number; decided: number; accepted: number; margin: number }>();
    for (const o of OBJECTIVES) rows.set(o, { recs: 0, decided: 0, accepted: 0, margin: 0 });
    for (const r of recs.data) {
      const obj = (r.strategyId && objByStrategy.get(r.strategyId)) || 'none';
      const row = rows.get(obj)!;
      row.recs++;
      row.margin += r.projectedMarginImpact;
      if (r.status === 'approved' || r.status === 'rejected' || r.status === 'adjusted') {
        row.decided++;
        if (r.status !== 'rejected') row.accepted++;
      }
    }
    return OBJECTIVES.map((objective) => ({
      objective,
      activeStrategies: objective === 'none' ? null : (activeByObjective.get(objective as StrategyObjective) ?? 0),
      ...rows.get(objective)!,
      acceptance: rows.get(objective)!.decided ? rows.get(objective)!.accepted / rows.get(objective)!.decided : null,
    }));
  }, [strategies.data, recs.data]);

  const loading = recs.isLoading || products.isLoading || strategies.isLoading || deployments.isLoading || audit.isLoading;
  const errored = recs.isError || products.isError || deployments.isError || audit.isError;

  return (
    <>
      <PageHeader title={t('analytics.page.title')} subtitle={t('analytics.page.desc')} />
      {loading ? <LoadingRows rows={4} /> : errored ? (
        <ErrorState title={t('common.state.error')} onRetry={() => { recs.refetch(); products.refetch(); deployments.refetch(); audit.refetch(); }} />
      ) : (
        <>
          {/* T-01: KPIs are grouped — pricing outcomes first, operational health second. */}
          <section aria-label={t('analytics.group.outcomes')}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{t('analytics.group.outcomes')}</h2>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={t('analytics.kpi.acceptance')}
              value={stats.acceptance === null ? '—' : formatPercent(stats.acceptance, locale)}
              comparison={t('analytics.kpi.acceptanceHint', { n: stats.decided })}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.acceptance') })} definition={t('analytics.kpi.acceptanceDef')} />}
            />
            <KpiCard
              label={t('analytics.kpi.priceIndex')}
              value={stats.priceIndex === null ? '—' : `${Math.round(stats.priceIndex * 100)}`}
              comparison={t('analytics.kpi.priceIndexHint')}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.priceIndex') })} definition={t('analytics.kpi.priceIndexDef')} />}
            />
            <KpiCard
              label={t('analytics.kpi.leakage')}
              value={formatPrice(Math.round(stats.leakage), locale)}
              comparison={t('analytics.kpi.leakageHint')}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.leakage') })} definition={t('analytics.kpi.leakageDef')} />}
            />
            <KpiCard
              label={t('analytics.kpi.latency')}
              value={stats.avgLatencyDays === null ? '—' : t('analytics.kpi.latencyValue', { d: Math.round(stats.avgLatencyDays * 10) / 10 })}
              comparison={t('analytics.kpi.latencyHint')}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.latency') })} definition={t('analytics.kpi.latencyDef')} />}
            />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label={t('analytics.group.outcomesSecondary')}>
            <KpiCard
              label={t('analytics.kpi.unitsSold')}
              value={stats.unitsSold === null ? '—' : Math.round(stats.unitsSold).toLocaleString(locale)}
              comparison={t('analytics.kpi.unitsSoldHint')}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.unitsSold') })} definition={t('analytics.kpi.unitsSoldDef')} />}
            />
            <KpiCard
              label={t('analytics.kpi.asp')}
              value={stats.asp === null ? '—' : formatPrice(Math.round(stats.asp), locale)}
              comparison={t('analytics.kpi.aspHint')}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.asp') })} definition={t('analytics.kpi.aspDef')} />}
            />
            <KpiCard
              label={t('analytics.kpi.markdown')}
              value={stats.markdownShare === null ? '—' : formatPercent(stats.markdownShare, locale)}
              comparison={t('analytics.kpi.markdownHint')}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.markdown') })} definition={t('analytics.kpi.markdownDef')} />}
            />
            <KpiCard
              label={t('analytics.kpi.changeSuccess')}
              value={stats.changeSuccess === null ? '—' : formatPercent(stats.changeSuccess, locale)}
              comparison={t('analytics.kpi.deploySuccess')}
              hint={<MetricDefinition label={t('overview.def.about', { name: t('analytics.kpi.changeSuccess') })} definition={t('analytics.kpi.changeSuccessDef')} />}
            />
          </div>

          </section>
          <section aria-label={t('analytics.group.operations')}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{t('analytics.group.operations')}</h2>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </section>

          <section aria-label={t('analytics.byObjective.title')} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold">{t('analytics.byObjective.title')}</h2>
            <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
              <table className="mesta-table w-full min-w-[560px] text-sm">
                <caption className="sr-only">{t('analytics.byObjective.title')}</caption>
                <thead className="bg-subtle text-xs text-muted">
                  <tr className="h-row">
                    {(['objective', 'strategies', 'recs', 'acceptance', 'margin'] as const).map((c) => (
                      <th key={c} scope="col" className="px-3 py-row text-left font-medium">{t(`analytics.objCol.${c}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byObjective.map((r) => (
                    <tr key={r.objective} className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                      <td className="px-3 py-row font-medium">
                        {r.objective === 'none' ? t('analytics.byObjective.none') : t(`strategy.objective.${r.objective}`)}
                      </td>
                      <td className="tabular px-3">{r.activeStrategies === null ? '—' : r.activeStrategies}</td>
                      <td className="tabular px-3">{r.recs}</td>
                      <td className="tabular px-3">{r.acceptance === null ? '—' : formatPercent(r.acceptance, locale)}</td>
                      <td className="tabular px-3">{formatPrice(Math.round(r.margin), locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label={t('analytics.byCategory.title')}>
            <h2 className="mb-2 text-sm font-semibold">{t('analytics.byCategory.title')}</h2>
            <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
              <table className="mesta-table w-full min-w-[560px] text-sm">
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
