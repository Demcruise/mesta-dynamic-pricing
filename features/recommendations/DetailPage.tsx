'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { RuleEvaluation } from '@/components/ds/RuleEvaluation';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { ConsequencePreview, DocsLink, RecoveryNotice } from '@/components/ds/trust';
import { UNDO_WINDOW_MS } from '@/lib/stores';
import { formatDate, formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { useAuditLog, useRecommendation, useSkuDetail } from '@/lib/queries';
import { RecommendationCard } from './RecommendationCard';

export function RecommendationDetailPage({ recId }: { recId: string }) {
  const { t, locale } = useTranslation();
  const q = useRecommendation(recId);
  const product = useSkuDetail(q.data?.sku ?? '').data;
  const audit = useAuditLog();
  const events = audit.data.filter((e) => e.entityId === recId);

  return (
    <>
      <Link href="/recommendations" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors duration-fast hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />{t('recommendations.back')}
      </Link>
      {q.isLoading ? <LoadingRows rows={3} rowHeight={120} /> : q.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={q.refetch} />
      ) : !q.data ? (
        <EmptyState title={t('recommendations.notFound')} />
      ) : (
        <>
          <PageHeader title={q.data.id} subtitle={q.data.sku} />
          <div className="grid max-w-3xl gap-4">
            <RecommendationCard rec={q.data} product={product} defaultOpen />
            <section className="rounded-card border border-line bg-surface p-card shadow-e1">
              <h2 className="mb-2 text-sm font-semibold">{t('recommendations.rules.title')}</h2>
              <RuleEvaluation rec={q.data} product={product} />
            </section>
            {q.data.status === 'pending' && (
              <section className="rounded-card border border-line bg-surface p-card shadow-e1">
                <h2 className="mb-2 text-sm font-semibold">{t('recommendations.decision.title')}</h2>
                <ConsequencePreview
                  items={[
                    { label: t('recommendations.decision.priceMove'), value: `${formatPrice(q.data.currentPrice, locale)} → ${formatPrice(q.data.proposedPrice, locale)}` },
                    { label: t('recommendations.decision.marginImpact'), value: formatPrice(q.data.projectedMarginImpact, locale) },
                    { label: t('recommendations.decision.channels'), value: t('recommendations.decision.channelsValue') },
                  ]}
                />
                <RecoveryNotice className="mt-3">
                  {t('recommendations.decision.undoNote', { s: Math.round(UNDO_WINDOW_MS / 1000) })}{' '}
                  <DocsLink href="/audit">{t('common.action.viewAudit')}</DocsLink>
                </RecoveryNotice>
              </section>
            )}
            <section className="rounded-card border border-line bg-surface p-card shadow-e1">
              <h2 className="mb-2 text-sm font-semibold">{t('recommendations.audit')}</h2>
              {events.length === 0 ? (
                <p className="text-sm text-muted">{t('catalog.detail.none')}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {events.map((e) => (
                    <li key={e.id} className="flex justify-between gap-2">
                      <span>{e.type}{e.note ? ` — ${e.note}` : ''}</span>
                      <span className="tabular text-muted">{formatDate(e.timestamp, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
