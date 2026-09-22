'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SeverityChip } from '@/components/ds/SeverityChip';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { FreshnessBadge } from '@/components/ds/system-status';
import { Button } from '@/components/ui/button';
import { deriveAlerts, type AlertItem, type Severity } from '@/lib/exceptions';
import { formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { useAnomalies, useDataSources, useDeploymentRecords, useScopedSkuSet } from '@/lib/queries';

const ORDER: Severity[] = ['critical', 'warning', 'info'];

export function AlertsPage() {
  const { t, locale } = useTranslation();
  const anomalies = useAnomalies();
  const deployments = useDeploymentRecords();
  const sources = useDataSources();
  const scoped = useScopedSkuSet();
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const items = deriveAlerts({
      anomalies: scoped ? anomalies.data.filter((a) => scoped.has(a.sku)) : anomalies.data,
      deployments: scoped ? deployments.data.filter((d) => scoped.has(d.sku)) : deployments.data,
      sources: sources.data,
    });
    const m = new Map<Severity, AlertItem[]>();
    for (const sev of ORDER) m.set(sev, []);
    for (const x of items) m.get(x.severity)?.push(x);
    return m;
  }, [anomalies.data, deployments.data, sources.data, scoped]);

  const loading = anomalies.isLoading || deployments.isLoading || sources.isLoading;
  const errored = anomalies.isError || deployments.isError || sources.isError;
  const total = [...groups.values()].reduce((n, g) => n + g.length, 0);

  return (
    <>
      <PageHeader title={t('alerts.page.title')} subtitle={t('alerts.page.desc')} />
      {loading ? <LoadingRows rows={5} /> : errored ? (
        <ErrorState title={t('common.state.error')} onRetry={() => { anomalies.refetch(); deployments.refetch(); sources.refetch(); }} />
      ) : total === 0 ? (
        <EmptyState variant="caughtUp" title={t('alerts.empty')} />
      ) : (
        <div className="flex max-w-4xl flex-col gap-6">
          {ORDER.map((sev) => {
            const items = groups.get(sev) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={sev} aria-label={t(`alerts.sev.${sev}`)}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <SeverityChip s={sev} /> <span className="tabular text-muted">({items.length})</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {items.map((x) => (
                    <li key={x.id} className="rounded-card border border-line bg-surface p-3 shadow-e1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-sm font-medium">{t(`alerts.kind.${x.kind}`)}</span>
                        {x.sku && <span className="tabular text-sm text-muted">{x.sku}</span>}
                        <span className="text-sm text-muted">{x.observed}</span>
                        <FreshnessBadge at={x.at} label={formatRelativeTime(x.at, locale)} />
                        <Button size="sm" variant="secondary" className="ms-auto"
                          aria-expanded={expanded === x.id} onClick={() => setExpanded(expanded === x.id ? null : x.id)}>
                          {t('alerts.action.anatomy')}
                        </Button>
                      </div>
                      {expanded === x.id && (
                        <dl className="mt-2 grid gap-1.5 border-t border-line pt-2 text-xs sm:grid-cols-3">
                          <div><dt className="text-faint">{t('alerts.anatomy.changed')}</dt><dd className="mt-0.5">{t(`alerts.kind.${x.kind}`)}</dd></div>
                          <div><dt className="text-faint">{t('alerts.anatomy.expected')}</dt><dd className="tabular mt-0.5">{x.expected}</dd></div>
                          <div><dt className="text-faint">{t('alerts.anatomy.observed')}</dt><dd className="tabular mt-0.5">{x.observed}</dd></div>
                          <div className="sm:col-span-3">
                            <Link href={x.href} className="text-brand hover:underline">{t('alerts.action.investigate')} →</Link>
                          </div>
                        </dl>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
