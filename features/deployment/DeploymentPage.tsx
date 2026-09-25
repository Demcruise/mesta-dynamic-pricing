'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/ds/Drawer';
import { PriceValue } from '@/components/ds/PriceValue';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { DocsLink, RecoveryNotice } from '@/components/ds/trust';
import { ExecutionTimeline, FreshnessBadge, JobProgress, SyncStatus, type ExecStep } from '@/components/ds/system-status';
import type { MestaStatus } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { MestaDataTable, useColumnVisibility, type DataColumn } from '@/components/ds/table/DataTable';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { cancelPublishJob, createPublishJob, liveJobStatus, retryDeployment, runScheduledJob } from '@/lib/actions/deployment';
import { CHANNELS } from '@/lib/stores/deployment';

/** DEPLOYMENT-UI-001: top-level channel cards; marketplaces are grouped but keep per-channel detail. */
const CHANNEL_GROUPS: { key: 'pos' | 'ecommerce' | 'marketplaces'; channels: string[] }[] = [
  { key: 'pos', channels: ['pos'] },
  { key: 'ecommerce', channels: ['ecommerce'] },
  { key: 'marketplaces', channels: ['marketplace_a', 'marketplace_b'] },
];
import { formatDate, formatPercent, formatRelativeTime } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { DeploymentRecord, DeploymentStatus, PublishJob, Recommendation } from '@/lib/ontology';
import { useAuditLog, useDeploymentRecords, usePublishJobs, useScopedRecommendations, useScopedSkuSet, useSkuList } from '@/lib/queries';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { PublishDialog } from './PublishDialog';
import { RollbackDialog } from './RollbackDialog';

const STATUSES: DeploymentStatus[] = ['failed', 'in_flight', 'pending', 'synced', 'rolled_back', 'cancelled'];
const DOT_CLS: Record<DeploymentStatus, string> = {
  synced: 'bg-up-soft', pending: 'bg-info-soft', failed: 'bg-down-soft', in_flight: 'bg-warn-soft',
  cancelled: 'bg-subtle', rolled_back: 'bg-warn-soft',
};

export function DeploymentPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const can = useCan();
  const recs = useScopedRecommendations();
  const recsData = recs.data;
  const scopedSkuSet = useScopedSkuSet();
  const recordsAll = useDeploymentRecords();
  const records = useMemo(
    () => ({ ...recordsAll, data: scopedSkuSet ? recordsAll.data.filter((r) => scopedSkuSet.has(r.sku)) : recordsAll.data }),
    [recordsAll, scopedSkuSet],
  );
  const skus = useSkuList();
  const audit = useAuditLog();
  const jobs = usePublishJobs();
  const [selected, setSelected] = useState<DeploymentRecord | null>(null);
  const [publishRec, setPublishRec] = useState<Recommendation | null>(null);
  const [rollbackJob, setRollbackJob] = useState<PublishJob | null>(null);
  const [publishSel, setPublishSel] = useState<Set<string>>(new Set());
  const columnVis = useColumnVisibility('deployment');

  const status = (sp.get('status') ?? '') as DeploymentStatus | '';
  const setStatus = (v: string) => router.replace(v ? `${pathname}?status=${v}` : pathname, { scroll: false });
  const names = useMemo(() => new Map(skus.data.map((p) => [p.sku, p.name])), [skus.data]);
  const productsBySku = useMemo(() => new Map(skus.data.map((p) => [p.sku, p])), [skus.data]);
  const activeJobRecIds = useMemo(
    () => new Set(jobs.data.filter((j) => ['scheduled', 'publishing', 'partial', 'failed'].includes(liveJobStatus(j))).map((j) => j.recommendationId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs.data, records.data],
  );
  const awaiting = useMemo(
    () => recsData.filter((r) => (r.status === 'approved' || r.status === 'adjusted') && !r.deployed && !activeJobRecIds.has(r.id)),
    [recsData, activeJobRecIds],
  );
  const jobRows = useMemo(
    () => jobs.data.filter((j) => !scopedSkuSet || scopedSkuSet.has(j.sku))
      .map((j) => ({ job: j, live: liveJobStatus(j), rs: records.data.filter((r) => r.jobId === j.id) }))
      .sort((a, b) => b.job.updatedAt.localeCompare(a.job.updatedAt)),
    [jobs.data, records.data, scopedSkuSet],
  );
  const rows = useMemo(
    () => records.data.filter((r) => !status || r.status === status)
      .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt)),
    [records.data, status],
  );
  const statusSelect = (
    <select aria-label={t('deployment.status.all')} className={cn(inputCls, 'w-auto min-w-44')} value={status} onChange={(e) => setStatus(e.target.value)}>
      <option value="">{t('deployment.status.all')}</option>
      {STATUSES.map((s) => <option key={s} value={s}>{t(`deployment.status.${s}`)}</option>)}
    </select>
  );
  const board = CHANNELS.map((channel) => {
    const rs = records.data.filter((r) => r.channel === channel);
    const count = (s: DeploymentStatus) => rs.filter((r) => r.status === s).length;
    const failed = rs.filter((r) => r.status === 'failed');
    const recent = [...rs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
    return {
      channel,
      synced: count('synced'),
      pending: count('pending') + count('in_flight'),
      inFlight: count('in_flight'),
      failed: failed.length,
      total: rs.length,
      lastFailed: failed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
      successRate: rs.length ? count('synced') / rs.length : null,
      avgRetries: rs.length ? rs.reduce((n, r) => n + r.retryCount, 0) / rs.length : null,
      last: rs.map((r) => r.updatedAt).sort().at(-1) ?? null,
      recent,
    };
  });

  const selectedJob = selected ? jobs.data.find((j) => j.id === selected.jobId) : undefined;
  const trace: ExecStep[] = useMemo(() => {
    if (!selected) return [];
    const statusOf = (type: string): MestaStatus =>
      type === 'deployment_success' ? 'synced'
        : type === 'deployment_failure' ? 'failed'
          : type === 'deployment_rollback' ? 'rolled_back'
            : type === 'publish_cancelled' ? 'cancelled'
              : type === 'publish_scheduled' ? 'scheduled' : 'in_flight';
    return audit.data
      .filter((e) => e.entityType === 'deployment' && e.entityId === selected.recommendationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((e) => ({
        id: e.id,
        label: t(`common.event.${e.type}`),
        detail: e.note ?? undefined,
        at: e.timestamp,
        status: statusOf(e.type),
      }));
  }, [audit.data, selected, t]);

  const run = (r: { ok: boolean; error?: string }, id?: string) => {
    if (!r.ok) toast(t(`deployment.err.${r.error}`));
    else if (id) toast(t('deployment.toast.started', { id }));
  };

  const deployColumns: DataColumn<DeploymentRecord>[] = [
    {
      id: 'sku', header: t('deployment.table.sku'), required: true,
      cell: (r) => <Link href={`/catalog/${r.sku}`} className="tabular text-brand hover:underline">{r.sku}</Link>,
    },
    { id: 'channel', header: t('deployment.table.channel'), cell: (r) => t(`common.channel.${r.channel}`) },
    {
      id: 'status', header: t('deployment.table.status'),
      cell: (r) => <StatusBadge status={r.status} label={t(`deployment.status.${r.status}`)} />,
    },
    { id: 'retries', header: t('deployment.table.retries'), cell: (r) => <span className="tabular">{r.retryCount}</span> },
    { id: 'updated', header: t('deployment.table.updated'), cell: (r) => <span className="tabular text-muted">{formatRelativeTime(r.updatedAt, locale)}</span> },
    {
      id: 'actions', header: t('deployment.table.actions'), required: true,
      cell: (r) => (
        <RoleGate action="deployment.execute">
          {r.status === 'failed' && (
            <Button size="sm" variant="secondary" onClick={() => run(retryDeployment(user, r.id))}>{t('deployment.table.retry')}</Button>
          )}
        </RoleGate>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('deployment.title')} subtitle={t('deployment.subtitle')} />
      {records.isLoading || recs.isLoading ? <LoadingRows rows={5} /> : records.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={records.refetch} />
      ) : (
        <>
          {/* DEPLOYMENT-UI-001: three top-level cards — POS, E-commerce, Marketplaces. The Marketplaces card
              keeps Marketplace A and B as individual panels with their own status, sync and retry. */}
          <section aria-label={t('deployment.board.title')} className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CHANNEL_GROUPS.map((group) => {
              const channels = board.filter((b) => group.channels.includes(b.channel));
              const single = channels.length === 1;
              return (
                <div key={group.key} className="flex flex-col rounded-card border border-line bg-surface p-card">
                  {!single && <h2 className="mb-3 text-sm font-semibold">{t(`deployment.board.group.${group.key}`)}</h2>}
                  <div className={cn('grid flex-1 gap-3', !single && 'md:grid-cols-2 xl:grid-cols-1 min-[1600px]:grid-cols-2')}>
                    {channels.map((b) => {
                      const health: MestaStatus = b.failed > 0 ? 'failed' : b.inFlight > 0 ? 'in_flight' : b.pending > 0 ? 'queued' : 'healthy';
                      return (
                        <div key={b.channel} className={cn('flex min-w-0 flex-col', !single && 'rounded-input border border-line p-3')}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            {single
                              ? <h2 className="text-sm font-semibold">{t(`common.channel.${b.channel}`)}</h2>
                              : <h3 className="text-sm font-semibold">{t(`common.channel.${b.channel}`)}</h3>}
                            <div className="flex items-center gap-2">
                              <SyncStatus status={health} />
                              <RoleGate action="deployment.execute">
                                {b.lastFailed && (
                                  <Button size="sm" variant="secondary" onClick={() => run(retryDeployment(user, b.lastFailed!.id))}>
                                    {t('deployment.board.retry')}
                                  </Button>
                                )}
                              </RoleGate>
                            </div>
                          </div>
                          <dl className="grid grid-cols-3 gap-1 text-center text-xs">
                            <div className="rounded bg-up-soft p-1.5 text-up"><dd className="tabular text-lg font-semibold">{b.synced}</dd><dt>{t('deployment.board.synced')}</dt></div>
                            <div className="rounded bg-info-soft p-1.5 text-info"><dd className="tabular text-lg font-semibold">{b.pending}</dd><dt>{t('deployment.board.pending')}</dt></div>
                            <div className="rounded bg-down-soft p-1.5 text-down"><dd className="tabular text-lg font-semibold">{b.failed}</dd><dt>{t('deployment.board.failed')}</dt></div>
                          </dl>
                          {b.total > 0 && <JobProgress done={b.synced} total={b.total} label={t('deployment.board.progress')} className="mt-2" />}
                          <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-line pt-2 text-xs">
                            <div><dt className="text-faint">{t('deployment.board.updated')}</dt><dd><FreshnessBadge at={b.last} /></dd></div>
                            <div><dt className="text-faint">{t('deployment.board.successRate')}</dt><dd className="tabular">{b.successRate === null ? '—' : formatPercent(b.successRate, locale)}</dd></div>
                            <div><dt className="text-faint">{t('deployment.board.avgRetries')}</dt><dd className="tabular">{b.avgRetries === null ? '—' : b.avgRetries.toFixed(1)}</dd></div>
                          </dl>
                          {b.recent.length > 0 && (
                            <ul aria-label={t('deployment.board.recent')} className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs">
                              {b.recent.map((r) => (
                                <li key={r.id} className="flex items-center gap-2">
                                  <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT_CLS[r.status])} />
                                  <span className="tabular min-w-0 flex-1 truncate">{r.sku}</span>
                                  <StatusBadge status={r.status} label={t(`deployment.status.${r.status}`)} className="px-1.5 py-px" />
                                  <span className="tabular shrink-0 text-faint">{formatRelativeTime(r.updatedAt, locale)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold">{t('deployment.jobs.title')}</h2>
            {jobRows.length === 0 ? (
              <EmptyState variant="empty" title={t('deployment.jobs.empty')} />
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {jobRows.map(({ job, live, rs }) => {
                  const synced = rs.filter((r) => r.status === 'synced').length;
                  const failedRs = rs.filter((r) => r.status === 'failed');
                  return (
                    <li key={job.id} className="rounded-card border border-line bg-surface p-3 text-sm shadow-e1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0"><span className="tabular font-medium">{job.id}</span> <span className="text-muted">·</span> <span className="tabular">{job.sku}</span></p>
                        <StatusBadge status={live} />
                      </div>
                      {job.scheduledFor && (
                        <p className="mt-1 text-xs text-muted">
                          {t('deployment.jobs.scheduledFor')}: <span className="tabular">{formatDate(job.scheduledFor, locale)}</span>
                          <span className="text-faint"> ({job.timezone})</span>
                        </p>
                      )}
                      {job.effectiveUntil && (
                        <p className="mt-0.5 text-xs text-muted">{t('deployment.jobs.effectiveUntil')}: <span className="tabular">{formatDate(job.effectiveUntil, locale)}</span></p>
                      )}
                      <p className="mt-0.5 text-xs text-faint">{job.channels.map((c) => t(`common.channel.${c}`)).join(' · ')}</p>
                      <JobProgress done={synced} total={rs.length} label={t('deployment.board.progress')} className="mt-2" />
                      <RoleGate action="deployment.execute">
                        <div className="mt-2 flex flex-wrap gap-2">
                          {job.status === 'scheduled' && (
                            <>
                              <Button size="sm" onClick={() => run(runScheduledJob(user, job.id))}>{t('deployment.jobs.runNow')}</Button>
                              <Button size="sm" variant="secondary" onClick={() => run(cancelPublishJob(user, job.id))}>{t('deployment.jobs.cancel')}</Button>
                            </>
                          )}
                          {(live === 'published' || live === 'partial') && (
                            <Button size="sm" variant="secondary" onClick={() => setRollbackJob(job)}>{t('deployment.jobs.rollback')}</Button>
                          )}
                          {failedRs.length > 0 && live !== 'published' && (
                            <Button size="sm" variant="secondary" onClick={() => failedRs.forEach((r) => run(retryDeployment(user, r.id)))}>
                              {t('deployment.jobs.retryFailed', { n: failedRs.length })}
                            </Button>
                          )}
                        </div>
                      </RoleGate>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mb-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t('deployment.queue.title')}</h2>
              <RoleGate action="deployment.execute">
                {awaiting.some((r) => publishSel.has(r.id)) && (
                  <Button size="sm" onClick={() => {
                    let n = 0;
                    for (const r of awaiting) if (publishSel.has(r.id) && createPublishJob(user, r.id).ok) n++;
                    toast(t('deployment.toast.bulkStarted', { n }));
                    setPublishSel(new Set());
                  }}>
                    {t('deployment.queue.publishSelected', { n: publishSel.size })}
                  </Button>
                )}
              </RoleGate>
            </div>
            {awaiting.length === 0 ? (
              <EmptyState variant="caughtUp" title={t('deployment.queue.empty')} />
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {awaiting.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-surface p-3 text-sm shadow-e1">
                    <div className="flex min-w-0 items-start gap-2">
                      <RoleGate action="deployment.execute">
                        <input
                          type="checkbox"
                          className="mt-1"
                          aria-label={t('deployment.queue.select', { id: r.id })}
                          checked={publishSel.has(r.id)}
                          onChange={(e) => setPublishSel((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })}
                        />
                      </RoleGate>
                      <div className="min-w-0">
                        <p><Link href={`/recommendations/${r.id}`} className="tabular text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand">{r.id}</Link> · <span className="tabular">{r.sku}</span> {names.get(r.sku)}</p>
                        <p className="text-xs text-muted">{t('deployment.queue.proposed')}: <PriceValue value={r.proposedPrice} /></p>
                      </div>
                    </div>
                    <RoleGate action="deployment.execute">
                      <Button size="sm" onClick={() => setPublishRec(r)}>{t('deployment.queue.deploy')}</Button>
                    </RoleGate>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            {rows.length === 0 ? (
              <>
                <h2 className="mb-3 text-section">{t('deployment.table.title')}</h2>
                <div className="mb-3">{statusSelect}</div>
                <EmptyState variant="filter" title={t('deployment.table.empty')} {...(status ? { action: { label: t('common.state.clearFilters'), onClick: () => setStatus('') } } : {})} />
              </>
            ) : (
              <MestaDataTable
                tableId="deployment"
                caption={t('deployment.table.caption')}
                toolbarLeading={<h2 className="text-section">{t('deployment.table.title')}</h2>}
                filterBar={statusSelect}
                rows={rows}
                getRowId={(r) => r.id}
                onRowClick={setSelected}
                minWidth={720}
                visibility={columnVis}
                columns={deployColumns}
                csv={can('deployment.export') ? {
                  filename: 'mesta-deployment.csv',
                  headers: ['id', 'recommendationId', 'sku', 'channel', 'status', 'retryCount', 'errorReason', 'updatedAt'],
                  cells: (r) => [r.id, r.recommendationId, r.sku, r.channel, r.status, r.retryCount, r.errorReason, r.updatedAt],
                } : undefined}
              />
            )}
          </section>
        </>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${t('deployment.table.title')} — ${selected.id}` : ''}
        href={selected && can('recommendation.view') ? `/recommendations/${selected.recommendationId}` : undefined}
        hrefLabel={t('deployment.table.openFull')}
      >
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-muted">{t('deployment.table.sku')}</dt>
                <dd>
                  {productsBySku.get(selected.sku)
                    ? <Link href={`/catalog/${selected.sku}`} className="hover:underline"><ProductIdentity product={productsBySku.get(selected.sku)!} size="sm" /></Link>
                    : <Link href={`/catalog/${selected.sku}`} className="tabular text-brand hover:underline">{selected.sku}</Link>}
                </dd>
              </div>
              <div><dt className="text-xs text-muted">{t('deployment.table.channel')}</dt><dd>{t(`common.channel.${selected.channel}`)}</dd></div>
              <div><dt className="text-xs text-muted">{t('deployment.table.status')}</dt><dd><StatusBadge status={selected.status} label={t(`deployment.status.${selected.status}`)} /></dd></div>
              <div>
                <dt className="text-xs text-muted">{t('deployment.table.job')}</dt>
                <dd className="flex items-center gap-2">
                  <span className="tabular">{selected.jobId}</span>
                  {selectedJob && <StatusBadge status={liveJobStatus(selectedJob)} className="px-1.5 py-px" />}
                </dd>
              </div>
              <div><dt className="text-xs text-muted">{t('deployment.table.retries')}</dt><dd className="tabular">{selected.retryCount}</dd></div>
              <div><dt className="text-xs text-muted">{t('deployment.table.updated')}</dt><dd className="tabular">{formatRelativeTime(selected.updatedAt, locale)}</dd></div>
              <div>
                <dt className="text-xs text-muted">{t('deployment.table.recommendation')}</dt>
                <dd>
                  {can('recommendation.view') ? (
                    <Link className="tabular text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand" href={`/recommendations/${selected.recommendationId}`}>{selected.recommendationId}</Link>
                  ) : (
                    <span className="tabular">{selected.recommendationId}</span>
                  )}
                </dd>
              </div>
            </dl>
            {trace.length > 0 && (
              <section aria-label={t('deployment.table.trace')} className="border-t border-line pt-3">
                <h3 className="mb-2 text-xs font-semibold text-muted">{t('deployment.table.trace')}</h3>
                <ExecutionTimeline steps={trace} ariaLabel={t('deployment.table.trace')} />
              </section>
            )}
            {selected.errorReason && <p className="rounded-input bg-down-soft px-3 py-2 text-xs text-down">{t('deployment.table.error')}: {selected.errorReason}</p>}
            {selected.status === 'failed' && <RecoveryNotice>{t('deployment.recovery.retry')}</RecoveryNotice>}
            {/* W-03: every deployment is auditable — the trail is one click away, not just on failure. */}
            <DocsLink href="/audit">{t('common.action.viewAudit')}</DocsLink>
            <RoleGate action="deployment.execute">
              <div className="flex gap-2 border-t border-line pt-3">
                {selected.status === 'failed' && (
                  <Button size="sm" variant="secondary" onClick={() => { run(retryDeployment(user, selected.id)); }}>{t('deployment.table.retry')}</Button>
                )}
                {selectedJob && liveJobStatus(selectedJob) === 'scheduled' && (
                  <Button size="sm" onClick={() => { run(runScheduledJob(user, selectedJob.id)); setSelected(null); }}>{t('deployment.jobs.runNow')}</Button>
                )}
              </div>
            </RoleGate>
          </div>
        )}
      </Drawer>

      <PublishDialog rec={publishRec} onClose={() => setPublishRec(null)} />
      <RollbackDialog
        job={rollbackJob}
        rec={rollbackJob ? recsData.find((x) => x.id === rollbackJob.recommendationId) : undefined}
        records={records.data}
        onClose={() => setRollbackJob(null)}
      />
    </>
  );
}
