'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/ds/Drawer';
import { PriceValue } from '@/components/ds/PriceValue';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { MestaDataTable, useColumnVisibility, type DataColumn } from '@/components/ds/table/DataTable';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { retryDeployment, triggerDeployment } from '@/lib/actions/deployment';
import { CHANNELS } from '@/lib/stores/deployment';
import { formatPercent, formatRelativeTime } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { DeploymentRecord, DeploymentStatus } from '@/lib/ontology';
import { useDeploymentRecords, useRecommendations, useSkuList } from '@/lib/queries';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

const STATUSES: DeploymentStatus[] = ['failed', 'in_flight', 'pending', 'synced'];
const STATUS_CLS: Record<DeploymentStatus, string> = {
  synced: 'bg-up-soft text-up', pending: 'bg-info-soft text-info', failed: 'bg-down-soft text-down', in_flight: 'bg-warn-soft text-warn',
};

export function DeploymentPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const can = useCan();
  const recs = useRecommendations();
  const recsData = recs.data;
  const records = useDeploymentRecords();
  const skus = useSkuList();
  const [selected, setSelected] = useState<DeploymentRecord | null>(null);
  const columnVis = useColumnVisibility('deployment');

  const status = (sp.get('status') ?? '') as DeploymentStatus | '';
  const setStatus = (v: string) => router.replace(v ? `${pathname}?status=${v}` : pathname, { scroll: false });
  const names = useMemo(() => new Map(skus.data.map((p) => [p.sku, p.name])), [skus.data]);
  const awaiting = useMemo(
    () => recsData.filter((r) => (r.status === 'approved' || r.status === 'adjusted') && !r.deployed && !records.data.some((d) => d.recommendationId === r.id)),
    [recsData, records.data],
  );
  const rows = useMemo(
    () => records.data.filter((r) => !status || r.status === status)
      .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt)),
    [records.data, status],
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
      failed: failed.length,
      lastFailed: failed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
      successRate: rs.length ? count('synced') / rs.length : null,
      avgRetries: rs.length ? rs.reduce((n, r) => n + r.retryCount, 0) / rs.length : null,
      last: rs.map((r) => r.updatedAt).sort().at(-1) ?? null,
      recent,
    };
  });

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
      cell: (r) => <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLS[r.status])}>{t(`deployment.status.${r.status}`)}</span>,
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
          {r.status === 'pending' && (
            <Button size="sm" onClick={() => run(triggerDeployment(user, r.recommendationId))}>{t('deployment.queue.deploy')}</Button>
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
          <section aria-label={t('deployment.board.title')} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {board.map((b) => (
              <div key={b.channel} className="flex flex-col rounded-card border border-line bg-surface p-card shadow-e1">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{t(`common.channel.${b.channel}`)}</h2>
                  <RoleGate action="deployment.execute">
                    {b.lastFailed && (
                      <Button size="sm" variant="secondary" onClick={() => run(retryDeployment(user, b.lastFailed!.id))}>
                        {t('deployment.board.retry')}
                      </Button>
                    )}
                  </RoleGate>
                </div>
                <dl className="grid grid-cols-3 gap-1 text-center text-xs">
                  <div className="rounded bg-up-soft p-1.5 text-up"><dd className="tabular text-lg font-semibold">{b.synced}</dd><dt>{t('deployment.board.synced')}</dt></div>
                  <div className="rounded bg-info-soft p-1.5 text-info"><dd className="tabular text-lg font-semibold">{b.pending}</dd><dt>{t('deployment.board.pending')}</dt></div>
                  <div className="rounded bg-down-soft p-1.5 text-down"><dd className="tabular text-lg font-semibold">{b.failed}</dd><dt>{t('deployment.board.failed')}</dt></div>
                </dl>
                <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-line pt-2 text-xs">
                  <div><dt className="text-faint">{t('deployment.board.updated')}</dt><dd className="tabular">{b.last ? formatRelativeTime(b.last, locale) : '—'}</dd></div>
                  <div><dt className="text-faint">{t('deployment.board.successRate')}</dt><dd className="tabular">{b.successRate === null ? '—' : formatPercent(b.successRate, locale)}</dd></div>
                  <div><dt className="text-faint">{t('deployment.board.avgRetries')}</dt><dd className="tabular">{b.avgRetries === null ? '—' : b.avgRetries.toFixed(1)}</dd></div>
                </dl>
                {b.recent.length > 0 && (
                  <ul aria-label={t('deployment.board.recent')} className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs">
                    {b.recent.map((r) => (
                      <li key={r.id} className="flex items-center gap-2">
                        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', STATUS_CLS[r.status].split(' ')[0])} />
                        <span className="tabular min-w-0 flex-1 truncate">{r.sku}</span>
                        <span className={cn('rounded-full px-1.5 py-px font-medium', STATUS_CLS[r.status])}>{t(`deployment.status.${r.status}`)}</span>
                        <span className="tabular shrink-0 text-faint">{formatRelativeTime(r.updatedAt, locale)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold">{t('deployment.queue.title')}</h2>
            {awaiting.length === 0 ? (
              <EmptyState title={t('deployment.queue.empty')} />
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {awaiting.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-surface p-3 text-sm shadow-e1">
                    <div>
                      <p><Link href={`/recommendations/${r.id}`} className="tabular text-brand hover:underline">{r.id}</Link> · <span className="tabular">{r.sku}</span> {names.get(r.sku)}</p>
                      <p className="text-xs text-muted">{t('deployment.queue.proposed')}: <PriceValue value={r.proposedPrice} /></p>
                    </div>
                    <RoleGate action="deployment.execute">
                      <Button size="sm" onClick={() => run(triggerDeployment(user, r.id), r.id)}>{t('deployment.queue.deploy')}</Button>
                    </RoleGate>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t('deployment.table.title')}</h2>
              <select aria-label={t('deployment.status.all')} className={`${inputCls} w-48`} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('deployment.status.all')}</option>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`deployment.status.${s}`)}</option>)}
              </select>
            </div>
            {rows.length === 0 ? (
              <EmptyState title={t('deployment.table.empty')} {...(status ? { action: { label: t('common.state.clearFilters'), onClick: () => setStatus('') } } : {})} />
            ) : (
              <MestaDataTable
                tableId="deployment"
                caption={t('deployment.table.caption')}
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
              <div><dt className="text-xs text-muted">{t('deployment.table.sku')}</dt><dd><Link href={`/catalog/${selected.sku}`} className="tabular text-brand hover:underline">{selected.sku}</Link> <span className="text-muted">{names.get(selected.sku)}</span></dd></div>
              <div><dt className="text-xs text-muted">{t('deployment.table.channel')}</dt><dd>{t(`common.channel.${selected.channel}`)}</dd></div>
              <div><dt className="text-xs text-muted">{t('deployment.table.status')}</dt><dd><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLS[selected.status])}>{t(`deployment.status.${selected.status}`)}</span></dd></div>
              <div><dt className="text-xs text-muted">{t('deployment.table.retries')}</dt><dd className="tabular">{selected.retryCount}</dd></div>
              <div><dt className="text-xs text-muted">{t('deployment.table.updated')}</dt><dd className="tabular">{formatRelativeTime(selected.updatedAt, locale)}</dd></div>
              <div>
                <dt className="text-xs text-muted">{t('deployment.table.recommendation')}</dt>
                <dd>
                  {can('recommendation.view') ? (
                    <Link className="tabular text-brand hover:underline" href={`/recommendations/${selected.recommendationId}`}>{selected.recommendationId}</Link>
                  ) : (
                    <span className="tabular">{selected.recommendationId}</span>
                  )}
                </dd>
              </div>
            </dl>
            {selected.errorReason && <p className="rounded-input bg-down-soft px-3 py-2 text-xs text-down">{t('deployment.table.error')}: {selected.errorReason}</p>}
            <RoleGate action="deployment.execute">
              <div className="flex gap-2 border-t border-line pt-3">
                {selected.status === 'failed' && (
                  <Button size="sm" variant="secondary" onClick={() => { run(retryDeployment(user, selected.id)); }}>{t('deployment.table.retry')}</Button>
                )}
                {selected.status === 'pending' && (
                  <Button size="sm" onClick={() => { run(triggerDeployment(user, selected.recommendationId)); }}>{t('deployment.queue.deploy')}</Button>
                )}
              </div>
            </RoleGate>
          </div>
        )}
      </Drawer>
    </>
  );
}
