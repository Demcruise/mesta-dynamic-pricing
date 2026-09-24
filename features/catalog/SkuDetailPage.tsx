'use client';

import { ArrowLeft, ChevronLeft, ChevronRight, FlaskConical, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { ConfidenceBar } from '@/components/ds/ConfidenceBar';
import { PriceValue } from '@/components/ds/PriceValue';
import { CategoryIcon } from '@/components/ds/ProductIdentity';
import { Sparkline } from '@/components/ds/Sparkline';
import { StatusChip } from '@/components/ds/StatusChip';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { Term } from '@/components/shell/Glossary';
import { RoleGate } from '@/components/shell/RoleGate';
import { competitorGap, elasticityBand, marginHealth, marginPct } from '@/lib/domain';
import { formatDate, formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useAuditLog, useCompetitorObservations, useRecommendations, useSkuDetail, useSkuList } from '@/lib/queries';
import { applyFilters, parseFilters, sortProducts } from './filters';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-card shadow-e1">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ p }: { p: Product }) {
  const { t, locale } = useTranslation();
  const comps = useCompetitorObservations(p.sku);
  const recs = useRecommendations();
  const audit = useAuditLog();
  const related = recs.data.filter((r) => r.sku === p.sku);
  const events = audit.data.filter((e) => e.sku === p.sku).slice(0, 8);
  const health = marginHealth(p);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <CategoryIcon category={p.category} className="size-5" />
            {p.name}
          </span>
        }
        subtitle={`${p.category} · ${p.sku}`}
        actions={
          <>
            <RoleGate action="simulation.use">
              <Link href={`/simulation?sku=${p.sku}`} className="inline-flex h-control-md items-center gap-1.5 rounded-input bg-brand px-3 text-sm font-medium text-brand-fg">
                <FlaskConical className="size-4" aria-hidden />{t('catalog.action.simulate')}
              </Link>
            </RoleGate>
            <Link href={`/audit?sku=${p.sku}`} className="inline-flex h-control-md items-center gap-1.5 rounded-input border border-line bg-surface px-3 text-sm">
              <ScrollText className="size-4" aria-hidden />{t('catalog.action.audit')}
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('catalog.detail.identity')}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">{t('catalog.col.price')}</dt><dd><PriceValue value={p.price} animate /></dd>
            <dt className="text-muted">{t('catalog.col.cost')}</dt><dd><PriceValue value={p.cost} /></dd>
            <dt className="text-muted"><Term k="margin" /></dt>
            <dd className="tabular">{formatPercent(marginPct(p), locale)} ({t(`catalog.health.${health}`)})</dd>
            <dt className="text-muted">{t('catalog.col.stock')}</dt>
            <dd className="tabular">{p.stockUnits} ({t(`catalog.stock.${p.stockStatus}`)})</dd>
            <dt className="text-muted"><Term k="elasticity" /></dt>
            <dd>{t(`catalog.elasticity.${elasticityBand(p.elasticity)}`)} <span className="tabular text-muted">({p.elasticity})</span></dd>
            <dt className="text-muted">{t('catalog.detail.minMax')}</dt>
            <dd><PriceValue value={p.minPrice} /> – <PriceValue value={p.maxPrice} /></dd>
            <dt className="text-muted"><Term k="map" /></dt><dd><PriceValue value={p.mapPrice} /></dd>
            <dt className="text-muted">{t('catalog.detail.gap')}</dt><dd><DeltaBadge value={competitorGap(p)} /></dd>
          </dl>
        </Card>

        <Card title={t('catalog.detail.history')}>
          <Sparkline points={p.priceHistory.map((h) => h.price)} tone="brand" className="h-20 w-full" />
          <table className="mesta-table mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="py-1 font-medium">{t('catalog.detail.date')}</th>
                <th scope="col" className="py-1 text-right font-medium">{t('catalog.detail.price')}</th>
              </tr>
            </thead>
            <tbody>
              {[...p.priceHistory].reverse().map((h) => (
                <tr key={h.at} className="border-t border-line">
                  <td className="tabular py-1 text-muted">{formatDate(h.at, locale)}</td>
                  <td className="py-1 text-right"><PriceValue value={h.price} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={t('catalog.detail.competitors')}>
          {comps.data.length === 0 ? (
            <p className="text-sm text-muted">{t('catalog.detail.none')}</p>
          ) : (
            <table className="mesta-table w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-1 font-medium">{t('catalog.detail.competitor')}</th>
                  <th scope="col" className="py-1 text-right font-medium">{t('catalog.detail.price')}</th>
                  <th scope="col" className="py-1 text-right font-medium">{t('catalog.detail.observed')}</th>
                </tr>
              </thead>
              <tbody>
                {comps.data.map((c) => (
                  <tr key={c.competitor} className="border-t border-line">
                    <td className="py-1">{c.competitor}</td>
                    <td className="py-1 text-right"><PriceValue value={c.price} /></td>
                    <td className="tabular py-1 text-right text-muted">{formatDate(c.observedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={t('catalog.detail.recs')}>
          {related.length === 0 ? (
            <p className="text-sm text-muted">{t('catalog.detail.none')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {related.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="tabular">{r.id}</span>
                  <PriceValue value={r.proposedPrice} />
                  <DeltaBadge value={(r.proposedPrice - r.currentPrice) / r.currentPrice} />
                  <ConfidenceBar value={r.confidence} />
                  <StatusChip status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('catalog.detail.audit')}>
          {events.length === 0 ? (
            <p className="text-sm text-muted">{t('catalog.detail.none')}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>{e.type}</span>
                  <span className="tabular text-muted">{formatDate(e.timestamp, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function SkuDetailPage({ sku }: { sku: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useSkuDetail(sku);
  const products = useSkuList();
  const sp = useSearchParams();

  // The catalog forwards its serialized filters so prev/next walk the analyst's current result set.
  const query = sp.toString();
  const nav = useMemo(() => {
    const f = parseFilters(new URLSearchParams(query));
    const ordered = sortProducts(applyFilters(products.data, f), f.sort, f.dir).map((p) => p.sku);
    const i = ordered.indexOf(sku);
    return {
      index: i,
      total: ordered.length,
      prev: i > 0 ? ordered[i - 1]! : null,
      next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1]! : null,
    };
  }, [products.data, query, sku]);

  const href = (s: string) => `/catalog/${s}${query ? `?${query}` : ''}`;
  const navBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-input border border-line bg-surface text-muted transition-colors duration-fast hover:text-fg disabled:opacity-40';

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Link href={`/catalog${query ? `?${query}` : ''}`} className="inline-flex items-center gap-1 text-sm text-muted transition-colors duration-fast hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden />{t('catalog.detail.backToCatalog')}
        </Link>
        {nav.index >= 0 && (
          <nav aria-label={t('catalog.detail.skuNav')} className="ml-auto flex items-center gap-2 text-sm">
            {nav.prev ? (
              <Link href={href(nav.prev)} aria-label={t('catalog.detail.prev', { sku: nav.prev })} title={nav.prev} className={navBtn}><ChevronLeft className="size-4" aria-hidden /></Link>
            ) : (
              <span aria-hidden className={navBtn}><ChevronLeft className="size-4" /></span>
            )}
            <span className="tabular text-xs text-faint">{t('catalog.detail.position', { i: nav.index + 1, n: nav.total })}</span>
            {nav.next ? (
              <Link href={href(nav.next)} aria-label={t('catalog.detail.next', { sku: nav.next })} title={nav.next} className={navBtn}><ChevronRight className="size-4" aria-hidden /></Link>
            ) : (
              <span aria-hidden className={navBtn}><ChevronRight className="size-4" /></span>
            )}
          </nav>
        )}
      </div>
      {q.isLoading ? <LoadingRows rows={4} /> : q.isError ? (
        <ErrorState title={t('catalog.error')} onRetry={q.refetch} />
      ) : q.data ? <Detail p={q.data} /> : (
        <EmptyState
          title={t('catalog.detail.notFound')}
          action={{ label: t('catalog.detail.backToCatalog'), onClick: () => router.push('/catalog') }}
        />
      )}
    </>
  );
}
