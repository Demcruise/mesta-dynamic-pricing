'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { OnboardingChecklist } from '@/components/ds/OnboardingChecklist';
import { TopMoversPanel } from '@/components/ds/TopMoversPanel';
import { KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { MetricDefinition } from '@/components/ds/trust';
import { recommendationHealth } from '@/lib/actions/recommendation';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import {
  useAnomalies, useAuditLog, useDeploymentRecords, usePriceEvents, useRecommendations, useScenarios, useSkuList, useStrategies,
} from '@/lib/queries';
import { can } from '@/lib/rbac';
import { useMonitoringStore, useSessionStore } from '@/lib/stores';
import { track } from '@/lib/telemetry';
import { decisionsByCategory, gapByCategory, roleKpis } from './kpis';

const OverviewCharts = dynamic(() => import('./OverviewCharts').then((m) => m.OverviewCharts), {
  loading: () => <LoadingRows rows={4} rowHeight={60} />,
});

export function OverviewPage() {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const threshold = useMonitoringStore((s) => s.threshold);
  const skus = useSkuList();
  const recs = useRecommendations();
  const audit = useAuditLog();
  const anomalies = useAnomalies();
  const strategies = useStrategies();
  const scenarios = useScenarios();
  const deployments = useDeploymentRecords();
  const events = usePriceEvents();

  useEffect(() => { track('page_viewed', { page: 'overview', role: user.role }); }, [user.role]);

  const loading = [skus, recs, audit, anomalies, strategies, scenarios, deployments, events].some((q) => q.isLoading);

  const view = useMemo(() => {
    const breachRecs = recs.data.filter((r) => r.status === 'pending' && recommendationHealth(r).breach);
    const lastDeploymentAt = events.data.filter((e) => e.source === 'deployment').map((e) => e.at).sort().at(-1) ?? null;
    return {
      kpis: roleKpis({
        user, recs: recs.data, audit: audit.data, anomalies: anomalies.data, threshold, strategies: strategies.data,
        deployments: deployments.data, breachRecs, lastDeploymentAt,
      }),
      volume: decisionsByCategory(recs.data, skus.data),
      gap: gapByCategory(skus.data),
      breachCount: breachRecs.length,
    };
  }, [user, recs.data, audit.data, anomalies.data, threshold, strategies.data, deployments.data, events.data, skus.data]);

  const fmt = (k: (typeof view.kpis)[number]) => {
    if (k.value === null) return t('overview.kpi.none');
    if (k.kind === 'money') return formatPrice(Number(k.value), locale);
    if (k.kind === 'percent') return formatPercent(Number(k.value), locale);
    if (k.kind === 'date') return formatDate(String(k.value), locale);
    return String(k.value);
  };
  const quick = (href: string) => track('quick_link_clicked', { href });

  const links: { key: string; href: string }[] = [
    ...(user.role === 'analyst' || user.role === 'manager' ? [{ key: 'pending', href: '/recommendations?status=pending' }] : []),
    ...(view.breachCount > 0 ? [{ key: 'breach', href: '/catalog?mh=critical' }] : []),
    ...(user.role === 'ops_lead' || user.role === 'manager' ? [{ key: 'failures', href: '/deployment?status=failed' }] : []),
    ...(user.role === 'manager' ? [{ key: 'strategies', href: '/strategy' }] : []),
    ...(user.role === 'compliance' ? [{ key: 'audit', href: '/audit' }] : []),
    { key: 'monitoring', href: '/monitoring' },
  ];

  return (
    <>
      <PageHeader title={t('overview.title')} subtitle={t('overview.greeting', { name: user.name, role: t(`common.role.${user.role}`) })} />
      {loading ? <LoadingRows rows={4} rowHeight={72} /> : (
        <>
          {can(user.role, 'strategy.create') && !(strategies.data.length && scenarios.data.length && recs.data.length) && (
            <OnboardingChecklist
              title={t('overview.onboarding.title')}
              subtitle={t('overview.onboarding.subtitle')}
              doneLabel={(n, total) => t('overview.onboarding.progress', { n, total })}
              steps={[
                {
                  id: 'strategy', href: '/strategy/new', done: strategies.data.length > 0,
                  title: t('overview.onboarding.step.strategy'), description: t('overview.onboarding.step.strategyHint'),
                },
                {
                  id: 'simulation', href: '/simulation', done: scenarios.data.length > 0,
                  title: t('overview.onboarding.step.simulation'), description: t('overview.onboarding.step.simulationHint'),
                },
                {
                  id: 'review', href: '/recommendations', done: recs.data.length > 0,
                  title: t('overview.onboarding.step.review'), description: t('overview.onboarding.step.reviewHint'),
                },
              ]}
            />
          )}
          <section aria-label={t('common.a11y.kpi')} className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {view.kpis.map((k) => (
              <KpiCard
                key={k.key}
                label={
                  <Link href={k.href ?? '/overview'} onClick={() => quick(k.href ?? '/overview')} className="rounded transition-colors duration-fast hover:text-fg hover:underline">
                    {t(`overview.kpi.${k.key}`)}
                  </Link>
                }
                value={typeof k.value === 'number' ? k.value : fmt(k)}
                format={k.kind === 'money' ? (n) => formatPrice(n, locale) : k.kind === 'percent' ? (n) => formatPercent(n, locale) : undefined}
                spark={k.spark} delta={k.delta}
                hint={
                  <MetricDefinition
                    label={t('overview.def.about', { name: t(`overview.kpi.${k.key}`) })}
                    definition={t(`overview.kpiDef.${k.key}`)}
                    rows={[
                      { label: t('overview.def.scope'), value: t('overview.def.scopeValue') },
                      { label: t('overview.def.source'), value: t('overview.def.sourceValue') },
                      { label: t('overview.def.updated'), value: t('overview.def.updatedValue') },
                    ]}
                  />
                }
              />
            ))}
          </section>

          <nav aria-label={t('overview.title')} className="mb-6 flex flex-wrap gap-2">
            {links.map((l) => (
              <Link key={l.key} href={l.href} onClick={() => quick(l.href)} className="rounded-full border border-line bg-surface px-3 py-1 text-sm transition-colors duration-fast hover:bg-subtle">
                {t(`overview.links.${l.key}`)}
              </Link>
            ))}
          </nav>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <OverviewCharts products={skus.data} volume={view.volume} gap={view.gap} />
            <div className="flex min-w-0 flex-col gap-4">
              <TopMoversPanel products={skus.data} />
              <section className="rounded-card border border-line bg-surface p-card shadow-e1">
                <h2 className="mb-2 text-sm font-semibold">{t('overview.activity.title')}</h2>
                {audit.data.length === 0 ? <p className="text-sm text-muted">{t('overview.activity.empty')}</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {audit.data.slice(0, 8).map((e) => (
                      <li key={e.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                        <span>{t(`common.event.${e.type}`)} · <span className="tabular">{e.sku ?? e.entityId}</span></span>
                        <span className="tabular text-muted">{formatDate(e.timestamp, locale)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
