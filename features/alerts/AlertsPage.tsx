'use client';

import { ChevronDown, CircleX, Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SeverityChip } from '@/components/ds/SeverityChip';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { useScopePath } from '@/components/shell/ScopeSelector';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { deriveAlerts, type Severity } from '@/lib/exceptions';
import { formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { useAnomalies, useDataSources, useDeploymentRecords, useScopedSkuSet } from '@/lib/queries';
import { useQueryState } from '@/lib/use-query-state';
import { cn } from '@/lib/utils';

const ORDER: Severity[] = ['critical', 'warning', 'info'];
const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
/** ALERT-022: severity = icon + label + count + colour; the icon survives grayscale. */
const SEV_ICON = { critical: CircleX, warning: TriangleAlert, info: Info } as const;
const SEV_ICON_CLS = { critical: 'text-critical', warning: 'text-warn', info: 'text-info' } as const;

/** ALERT-013…016: one row grid for every alert kind — Severity · Type · Entity · Detail · Age · Action. */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-1.5 xl:grid-cols-[112px_176px_128px_minmax(0,1fr)_120px_104px] xl:items-center';

export function AlertsPage() {
  const { t, locale } = useTranslation();
  const anomalies = useAnomalies();
  const deployments = useDeploymentRecords();
  const sources = useDataSources();
  const scoped = useScopedSkuSet();
  const scopePath = useScopePath();
  const [q, setQ] = useQueryState({ severity: 'all', sort: 'severity' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Counts and list come from the same scoped feed (ALERT-004/005).
  const all = useMemo(() => deriveAlerts({
    anomalies: scoped ? anomalies.data.filter((a) => scoped.has(a.sku)) : anomalies.data,
    deployments: scoped ? deployments.data.filter((d) => scoped.has(d.sku)) : deployments.data,
    sources: sources.data,
  }), [anomalies.data, deployments.data, sources.data, scoped]);

  const counts = useMemo(() => Object.fromEntries(ORDER.map((s) => [s, all.filter((x) => x.severity === s).length])) as Record<Severity, number>, [all]);
  const severity = q.severity as 'all' | Severity;
  // ALERT-009/010: render only the selected severity, keeping the chosen sort.
  const visible = useMemo(() => {
    const list = severity === 'all' ? all : all.filter((x) => x.severity === severity);
    const byTime = (a: typeof list[number], b: typeof list[number]) => (q.sort === 'oldest' ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at));
    return [...list].sort((a, b) => (q.sort === 'severity' ? RANK[a.severity] - RANK[b.severity] || byTime(a, b) : byTime(a, b)));
  }, [all, severity, q.sort]);

  // ALERT-011: a new result set starts at its top, never at a stale pixel offset.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const el = listRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
    setExpanded(null);
  }, [severity]);

  const loading = anomalies.isLoading || deployments.isLoading || sources.isLoading;
  const errored = anomalies.isError || deployments.isError || sources.isError;

  return (
    <>
      <PageHeader title={t('alerts.page.title')} subtitle={t('alerts.page.desc')} />
      {loading ? <LoadingRows rows={5} /> : errored ? (
        <ErrorState title={t('common.state.error')} onRetry={() => { anomalies.refetch(); deployments.refetch(); sources.refetch(); }} />
      ) : all.length === 0 ? (
        <EmptyState variant="caughtUp" title={t('alerts.empty')} />
      ) : (
        <>
          {/* ALERT-001/007/008/020 — severity filter under the description; global scope stays separate. */}
          <div className="mb-6 flex flex-col gap-2">
            <p className="truncate text-caption text-faint">
              <span className="font-semibold uppercase tracking-wide">{t('common.scope.dataScope')}</span> · {scopePath}
            </p>
            <span className="text-label text-muted">{t('alerts.filter.severity')}</span>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterTabs
                label={t('alerts.filter.severity')}
                controls="alert-list"
                value={severity}
                onChange={(v) => setQ({ severity: v })}
                tabs={[
                  { value: 'all', label: t('alerts.filter.all'), count: all.length },
                  ...ORDER.map((s) => ({ value: s, label: t(`alerts.sev.${s}`), count: counts[s], icon: SEV_ICON[s], iconCls: SEV_ICON_CLS[s] })),
                ]}
              />
              <select aria-label={t('alerts.sort.label')} className={cn(inputCls, 'w-auto min-w-40')} value={q.sort} onChange={(e) => setQ({ sort: e.target.value })}>
                {(['severity', 'newest', 'oldest'] as const).map((s) => <option key={s} value={s}>{`${t('alerts.sort.label')}: ${t(`alerts.sort.${s}`)}`}</option>)}
              </select>
            </div>
          </div>

          <div id="alert-list" ref={listRef} className="scroll-mt-20">
            {visible.length === 0 ? (
              // ALERT-017/018: explicit, recoverable filtered-empty state.
              <EmptyState
                variant="filter"
                title={t('alerts.filtered', { sev: t(`alerts.sev.${severity}`) })}
                action={{ label: t('alerts.action.showAll'), onClick: () => setQ({ severity: 'all' }) }}
              />
            ) : (
              <div className="rounded-card border border-line bg-surface">
                <div aria-hidden className={cn(ROW_GRID, 'hidden h-12 rounded-t-card border-b border-divider bg-head px-5 text-caption font-semibold text-muted xl:grid')}>
                  <span>{t('alerts.col.severity')}</span>
                  <span>{t('alerts.col.type')}</span>
                  <span>{t('alerts.col.entity')}</span>
                  <span>{t('alerts.col.detail')}</span>
                  <span>{t('alerts.col.age')}</span>
                  <span />
                </div>
                <ul>
                  {visible.map((x) => {
                    const open = expanded === x.id;
                    return (
                      <li key={x.id} className="border-b border-divider last:border-b-0">
                        <div className={cn(ROW_GRID, 'min-h-14 px-5 py-3')}>
                          <span><SeverityChip s={x.severity} /></span>
                          <span className="col-span-2 truncate font-semibold text-fg xl:col-span-1">{t(`alerts.kind.${x.kind}`)}</span>
                          <span className="tabular truncate text-muted">{x.sku ?? '—'}</span>
                          <span className="tabular col-span-2 truncate text-body-sm text-fg xl:col-span-1" title={x.observed}>{x.observed}</span>
                          <span className="tabular whitespace-nowrap text-body-sm text-muted">{formatRelativeTime(x.at, locale)}</span>
                          <span className="justify-self-end">
                            <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setExpanded(open ? null : x.id)}>
                              {t('alerts.action.anatomy')}<ChevronDown className={cn('size-3.5 transition-transform duration-fast', open && 'rotate-180')} aria-hidden />
                            </Button>
                          </span>
                        </div>
                        {open && (
                          <dl className="grid gap-3 border-t border-divider bg-subtle px-5 py-4 text-body-sm sm:grid-cols-4">
                            <div><dt className="text-caption text-faint">{t('alerts.anatomy.changed')}</dt><dd className="mt-0.5">{t(`alerts.kind.${x.kind}`)}</dd></div>
                            <div><dt className="text-caption text-faint">{t('alerts.anatomy.expected')}</dt><dd className="tabular mt-0.5">{x.expected}</dd></div>
                            <div><dt className="text-caption text-faint">{t('alerts.anatomy.observed')}</dt><dd className="tabular mt-0.5">{x.observed}</dd></div>
                            <div className="sm:text-right">
                              <Link href={x.href} className="font-medium text-brand hover:underline">{t('alerts.action.investigate')} →</Link>
                            </div>
                          </dl>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
