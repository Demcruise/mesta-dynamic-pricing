'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { recommendationHealth } from '@/lib/actions/recommendation';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import {
  useAnomalies, useAuditLog, useDeploymentRecords, usePriceEvents, useRecommendations, useSkuList, useStrategies,
} from '@/lib/queries';
import { useMonitoringStore, useSessionStore } from '@/lib/stores';
import { track } from '@/lib/telemetry';
import { decisionsByCategory, gapByCategory, marginTrend, roleKpis } from './kpis';

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
  const deployments = useDeploymentRecords();
  const events = usePriceEvents();

  useEffect(() => { track('page_viewed', { page: 'overview', role: user.role }); }, [user.role]);

  const loading = [skus, recs, audit, anomalies, strategies, deployments, events].some((q) => q.isLoading);

  const view = useMemo(() => {
    const breachCount = recs.data.filter((r) => r.status === 'pending' && recommendationHealth(r).breach).length;
    const lastDeploymentAt = events.data.filter((e) => e.source === 'deployment').map((e) => e.at).sort().at(-1) ?? null;
    return {
      kpis: roleKpis({
        user, recs: recs.data, audit: audit.data, anomalies: anomalies.data, threshold, strategies: strategies.data,
        deployments: deployments.data, breachCount, lastDeploymentAt,
      }),
      margin: marginTrend(skus.data),
      volume: decisionsByCategory(recs.data, skus.data),
      gap: gapByCategory(skus.data),
      breachCount,
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
          <section aria-label={t('common.a11y.kpi')} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {view.kpis.map((k) => (
              <Link key={k.key} href={k.href ?? '/overview'} onClick={() => quick(k.href ?? '/overview')} className="block rounded-card hover:opacity-90">
                <KpiCard label={t(`overview.kpi.${k.key}`)} value={fmt(k)} />
              </Link>
            ))}
          </section>

          <nav aria-label={t('overview.title')} className="mb-6 flex flex-wrap gap-2">
            {links.map((l) => (
              <Link key={l.key} href={l.href} onClick={() => quick(l.href)} className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:bg-subtle">
                {t(`overview.links.${l.key}`)}
              </Link>
            ))}
          </nav>

          <OverviewCharts margin={view.margin} volume={view.volume} gap={view.gap} />

          <section className="mt-6 rounded-card border border-line bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold">{t('overview.activity.title')}</h2>
            {audit.data.length === 0 ? <p className="text-sm text-muted">{t('overview.activity.empty')}</p> : (
              <ul className="divide-y divide-line text-sm">
                {audit.data.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span>{t(`common.event.${e.type}`)} · <span className="tabular">{e.sku ?? e.entityId}</span></span>
                    <span className="text-muted">{formatDate(e.timestamp, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
