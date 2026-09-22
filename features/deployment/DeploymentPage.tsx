'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { retryDeployment, triggerDeployment } from '@/lib/actions/deployment';
import { CHANNELS } from '@/lib/stores/deployment';
import { formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { DeploymentStatus } from '@/lib/ontology';
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
  const recs = useRecommendations();
  const recsData = recs.data;
  const records = useDeploymentRecords();
  const skus = useSkuList();
  const [open, setOpen] = useState<string | null>(null);

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
    return { channel, synced: count('synced'), pending: count('pending') + count('in_flight'), failed: count('failed'), last: rs.map((r) => r.updatedAt).sort().at(-1) ?? null };
  });

  const run = (r: { ok: boolean; error?: string }, id?: string) => {
    if (!r.ok) toast(t(`deployment.err.${r.error}`));
    else if (id) toast(t('deployment.toast.started', { id }));
  };

  return (
    <>
      <PageHeader title={t('deployment.title')} subtitle={t('deployment.subtitle')} />
      {records.isLoading || recs.isLoading ? <LoadingRows rows={5} /> : records.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={records.refetch} />
      ) : (
        <>
          <section aria-label={t('deployment.board.title')} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {board.map((b) => (
              <div key={b.channel} className="rounded-card border border-line bg-surface p-card shadow-e1">
                <h2 className="mb-2 text-sm font-semibold">{t(`common.channel.${b.channel}`)}</h2>
                <dl className="grid grid-cols-3 gap-1 text-center text-xs">
                  <div className="rounded bg-up-soft p-1.5 text-up"><dd className="tabular text-lg font-semibold">{b.synced}</dd><dt>{t('deployment.board.synced')}</dt></div>
                  <div className="rounded bg-info-soft p-1.5 text-info"><dd className="tabular text-lg font-semibold">{b.pending}</dd><dt>{t('deployment.board.pending')}</dt></div>
                  <div className="rounded bg-down-soft p-1.5 text-down"><dd className="tabular text-lg font-semibold">{b.failed}</dd><dt>{t('deployment.board.failed')}</dt></div>
                </dl>
                <p className="mt-2 text-xs text-faint">{t('deployment.board.updated')}: {b.last ? formatRelativeTime(b.last, locale) : '—'}</p>
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
              <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">{t('deployment.table.caption')}</caption>
                  <thead className="bg-subtle text-xs text-muted">
                    <tr className="h-row">
                      <th scope="col" className="w-8 px-2 py-row" />
                      {(['sku', 'channel', 'status', 'retries', 'updated', 'actions'] as const).map((c) => (
                        <th key={c} scope="col" className="px-3 py-row text-left font-medium">{t(`deployment.table.${c}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const expanded = open === r.id;
                      return (
                        <Fragment key={r.id}>
                          <tr className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                            <td className="px-2">
                              <button type="button" aria-expanded={expanded} aria-label={t('deployment.table.expand', { id: r.id })} onClick={() => setOpen(expanded ? null : r.id)} className="grid size-7 place-items-center rounded transition-colors duration-fast hover:bg-subtle">
                                {expanded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                              </button>
                            </td>
                            <td className="px-3 py-row"><Link href={`/catalog/${r.sku}`} className="tabular text-brand hover:underline">{r.sku}</Link></td>
                            <td className="px-3">{t(`common.channel.${r.channel}`)}</td>
                            <td className="px-3"><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLS[r.status])}>{t(`deployment.status.${r.status}`)}</span></td>
                            <td className="tabular px-3">{r.retryCount}</td>
                            <td className="tabular px-3 text-muted">{formatRelativeTime(r.updatedAt, locale)}</td>
                            <td className="px-3">
                              <RoleGate action="deployment.execute">
                                {r.status === 'failed' && (
                                  <Button size="sm" variant="secondary" onClick={() => run(retryDeployment(user, r.id))}>{t('deployment.table.retry')}</Button>
                                )}
                                {r.status === 'pending' && (
                                  <Button size="sm" onClick={() => run(triggerDeployment(user, r.recommendationId))}>{t('deployment.queue.deploy')}</Button>
                                )}
                              </RoleGate>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="bg-subtle text-xs">
                              <td />
                              <td colSpan={6} className="px-3 py-2">
                                <p>{t('deployment.table.recommendation')}: <Link className="tabular text-brand underline" href={`/recommendations/${r.recommendationId}`}>{r.recommendationId}</Link> · {names.get(r.sku)}</p>
                                {r.errorReason && <p className="text-down">{t('deployment.table.error')}: {r.errorReason}</p>}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
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
