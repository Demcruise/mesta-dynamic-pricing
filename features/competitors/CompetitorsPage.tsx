'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { FreshnessBadge } from '@/components/ds/system-status';
import { Button } from '@/components/ui/button';
import { formatPrice, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { CompetitorObservation, Product } from '@/lib/ontology';
import { useScopedRecommendations, useScopedSkuSet, useSkuList } from '@/lib/queries';
import { useProductCatalogStore } from '@/lib/stores';

interface CompetitorAgg {
  name: string;
  skus: number;
  /** Mean (competitor / ours - 1) — positive = competitor is pricier. */
  avgGap: number;
  freshest: string;
  stalest: string;
  /** R-01: sign of avgGap — 'cheaper' | 'parity' | 'pricier' vs our price. */
  direction: 'cheaper' | 'parity' | 'pricier';
  /** Pending/escalated recs touching SKUs this competitor covers. */
  affectedRecs: number;
  rows: { obs: CompetitorObservation; product: Product }[];
}

export function CompetitorsPage() {
  const { t, locale } = useTranslation();
  const products = useSkuList();
  const all = useProductCatalogStore((s) => s.competitors);
  const scoped = useScopedSkuSet();
  const recs = useScopedRecommendations();
  const [open, setOpen] = useState<string | null>(null);

  // SKU → open recommendation count, for the "affected recommendations" column.
  const recsBySku = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recs.data) {
      if (r.status === 'pending' || r.status === 'escalated') m.set(r.sku, (m.get(r.sku) ?? 0) + 1);
    }
    return m;
  }, [recs.data]);

  const aggs = useMemo(() => {
    const bySku = new Map(products.data.map((p) => [p.sku, p]));
    const obs = scoped ? all.filter((c) => scoped.has(c.sku)) : all;
    const map = new Map<string, CompetitorAgg>();
    for (const o of obs) {
      const product = bySku.get(o.sku);
      if (!product) continue;
      const a = map.get(o.competitor) ?? { name: o.competitor, skus: 0, avgGap: 0, freshest: o.observedAt, stalest: o.observedAt, direction: 'parity' as const, affectedRecs: 0, rows: [] };
      a.rows.push({ obs: o, product });
      if (o.observedAt > a.freshest) a.freshest = o.observedAt;
      if (o.observedAt < a.stalest) a.stalest = o.observedAt;
      map.set(o.competitor, a);
    }
    for (const a of map.values()) {
      a.skus = new Set(a.rows.map((r) => r.obs.sku)).size;
      a.avgGap = a.rows.reduce((s, r) => s + (r.obs.price / r.product.price - 1), 0) / a.rows.length;
      a.direction = Math.abs(a.avgGap) < 0.01 ? 'parity' : a.avgGap > 0 ? 'pricier' : 'cheaper';
      a.affectedRecs = new Set(a.rows.map((r) => r.obs.sku)).values().reduce((n, sku) => n + (recsBySku.get(sku) ?? 0), 0);
    }
    return [...map.values()].sort((a, b) => b.skus - a.skus);
  }, [all, products.data, scoped, recsBySku]);

  return (
    <>
      <PageHeader title={t('competitors.page.title')} subtitle={t('competitors.page.desc')} />
      {products.isLoading ? <LoadingRows rows={4} /> : products.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={products.refetch} />
      ) : aggs.length === 0 ? (
        <EmptyState title={t('competitors.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {aggs.map((a) => (
            <li key={a.name} className="rounded-card border border-line bg-surface p-3 shadow-e1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="text-sm font-semibold">{a.name}</span>
                <span className="tabular text-xs text-muted">{t('competitors.skusObserved', { n: a.skus })}</span>
                <span className="tabular flex items-center gap-1 text-xs text-muted">
                  {t('competitors.avgGap')} <DeltaBadge value={a.avgGap} />
                  <span className="rounded-full bg-subtle px-1.5 py-px">{t(`competitors.direction.${a.direction}`)}</span>
                </span>
                {a.affectedRecs > 0 && (
                  <Link href="/recommendations?status=pending" className="tabular text-xs text-brand hover:underline">
                    {t('competitors.affectedRecs', { n: a.affectedRecs })}
                  </Link>
                )}
                <FreshnessBadge at={a.freshest} label={t('competitors.freshest', { at: formatRelativeTime(a.freshest, locale) })} />
                <Button size="sm" variant="secondary" className="ms-auto"
                  aria-expanded={open === a.name} onClick={() => setOpen(open === a.name ? null : a.name)}>
                  {open === a.name ? t('competitors.action.collapse') : t('competitors.action.expand')}
                </Button>
              </div>
              {open === a.name && (
                <div className="mt-3 overflow-x-auto rounded-card border border-line">
                  <table className="w-full min-w-[560px] text-sm">
                    <caption className="sr-only">{t('competitors.tableCaption', { name: a.name })}</caption>
                    <thead className="bg-subtle text-xs text-muted">
                      <tr className="h-row">
                        {(['sku', 'product', 'theirs', 'ours', 'gap', 'observed'] as const).map((c) => (
                          <th key={c} scope="col" className="px-3 py-row text-left font-medium">{t(`competitors.col.${c}`)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.rows.map(({ obs, product }) => (
                        <tr key={`${obs.sku}`} className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                          <td className="px-3 py-row"><Link href={`/catalog/${obs.sku}`} className="tabular text-brand hover:underline">{obs.sku}</Link></td>
                          <td className="px-3 text-muted"><ProductIdentity product={product} size="sm" /></td>
                          <td className="tabular px-3">{formatPrice(obs.price, locale)}</td>
                          <td className="tabular px-3">{formatPrice(product.price, locale)}</td>
                          <td className="px-3"><DeltaBadge value={obs.price / product.price - 1} /></td>
                          <td className="tabular px-3 text-muted">{formatRelativeTime(obs.observedAt, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
