'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { FreshnessBadge } from '@/components/ds/system-status';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { triggerSourceSync } from '@/lib/actions/ops';
import { formatPercent, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { DataSource } from '@/lib/ontology';
import { useDataSources, useScopedSkuSet, useSkuList } from '@/lib/queries';
import { useProductCatalogStore, useSessionStore, useToastStore } from '@/lib/stores';

const STALE_PRICE_MS = 30 * 86_400_000;

export function DataPage() {
  const { t, locale } = useTranslation();
  const sources = useDataSources();
  const products = useSkuList();
  const scoped = useScopedSkuSet();
  const competitors = useProductCatalogStore((s) => s.competitors);
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);

  const quality = useMemo(() => {
    const list = scoped ? products.data.filter((p) => scoped.has(p.sku)) : products.data;
    const observed = new Set(competitors.map((c) => c.sku));
    const missing = list.filter((p) => !observed.has(p.sku));
    const stale = list.filter((p) => Date.now() - new Date(p.lastChangeAt).getTime() > STALE_PRICE_MS);
    return { total: list.length, missing, stale };
  }, [products.data, competitors, scoped]);

  const sync = (s: DataSource) => {
    const r = triggerSourceSync(user, s.id);
    toast(r.ok ? t('data.toast.syncing', { name: s.name }) : t(`data.err.${r.error}`));
  };

  return (
    <>
      <PageHeader title={t('data.page.title')} subtitle={t('data.page.desc')} />
      {sources.isLoading || products.isLoading ? <LoadingRows rows={5} /> : sources.isError || products.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={() => { sources.refetch(); products.refetch(); }} />
      ) : (
        <>
          <section aria-label={t('data.sources.title')} className="mb-8">
            <h2 className="mb-2 text-sm font-semibold">{t('data.sources.title')}</h2>
            <p className="mb-3 text-xs text-muted">{t('data.sources.desc')}</p>
            <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
              <table className="mesta-table w-full min-w-[720px] text-sm">
                <caption className="sr-only">{t('data.sources.title')}</caption>
                <thead className="bg-subtle text-xs text-muted">
                  <tr className="h-row">
                    {(['source', 'kind', 'status', 'lastSync', 'coverage', 'rejected', 'actions'] as const).map((c) => (
                      <th key={c} scope="col" className="px-3 py-row text-left font-medium">{t(`data.col.${c}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.data.map((s) => (
                    <tr key={s.id} className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                      <td className="px-3 py-row font-medium">{s.name}</td>
                      <td className="px-3 text-muted">{t(`data.kind.${s.kind}`)}</td>
                      <td className="px-3"><StatusBadge status={s.status} /></td>
                      <td className="px-3"><FreshnessBadge at={s.lastSyncAt} label={formatRelativeTime(s.lastSyncAt, locale)} /></td>
                      <td className="tabular px-3">{formatPercent(s.coveragePct / 100, locale)}</td>
                      <td className="tabular px-3">{s.rejectedRecords > 0 ? <span className="text-warn">{s.rejectedRecords.toLocaleString(locale)}</span> : '0'}</td>
                      <td className="px-3">
                        <RoleGate action="data.sync">
                          <Button size="sm" variant="secondary" disabled={s.status === 'syncing'} onClick={() => sync(s)}>
                            {s.status === 'syncing' ? t('data.action.syncing') : t('data.action.sync')}
                          </Button>
                        </RoleGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label={t('data.quality.title')}>
            <h2 className="mb-2 text-sm font-semibold">{t('data.quality.title')}</h2>
            <p className="mb-3 text-xs text-muted">{t('data.quality.desc')}</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <QualityCard
                title={t('data.quality.missingTitle')}
                desc={t('data.quality.missingDesc')}
                count={quality.missing.length} total={quality.total}
                emptyKey="data.quality.missingEmpty" sample={quality.missing.slice(0, 5).map((p) => p.sku)} t={t}
              />
              <QualityCard
                title={t('data.quality.staleTitle')}
                desc={t('data.quality.staleDesc', { days: Math.round(STALE_PRICE_MS / 86_400_000) })}
                count={quality.stale.length} total={quality.total}
                emptyKey="data.quality.staleEmpty" sample={quality.stale.slice(0, 5).map((p) => p.sku)} t={t}
              />
            </ul>
          </section>
        </>
      )}
    </>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function QualityCard({ title, desc, count, total, emptyKey, sample, t }: {
  title: string; desc: string; count: number; total: number; emptyKey: string; sample: string[]; t: T;
}) {
  return (
    <li className="rounded-card border border-line bg-surface p-3 shadow-e1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="tabular text-sm text-muted">{t('data.quality.count', { n: count, total })}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{desc}</p>
      {count === 0 ? (
        <p className="mt-2 text-xs text-up">{t(emptyKey)}</p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {t('data.quality.sample')}{' '}
          {sample.map((sku, i) => (
            <span key={sku}>
              {i > 0 && ', '}
              <Link href={`/catalog/${sku}`} className="tabular text-brand hover:underline">{sku}</Link>
            </span>
          ))}
          {count > sample.length && <span className="tabular"> +{count - sample.length}</span>}
        </p>
      )}
    </li>
  );
}
