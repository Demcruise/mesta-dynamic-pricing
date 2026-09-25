'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBadge, type MestaStatus } from '@/components/ds/StatusBadge';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { SkuId } from '@/components/ds/sku';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { MestaDataTable, useColumnVisibility, type DataColumn } from '@/components/ds/table/DataTable';
import { useTranslation } from '@/lib/i18n';
import { signalRows, type SkuSignals, type StockRisk } from '@/lib/signals';
import { useProductCatalogStore } from '@/lib/stores';
import { useScopedSkuList } from '@/lib/queries';
import { cn } from '@/lib/utils';

const RISK_STATUS: Record<StockRisk, MestaStatus> = {
  stockout: 'critical', low: 'warning', healthy: 'healthy', overstock: 'info',
};
const RISK_ORDER: StockRisk[] = ['stockout', 'low', 'healthy', 'overstock'];

/**
 * MI-002/MI-003 market-intelligence workspace: demand signals (modelled velocity,
 * elasticity, competitor coverage) + inventory signals (days of supply, stockout/
 * overstock risk). All values are demand-model estimates — labelled as such.
 */
export function SignalsPage() {
  const { t, locale } = useTranslation();
  const products = useScopedSkuList();
  const competitors = useProductCatalogStore((s) => s.competitors);
  // Category repeats under the product name; the column stays available from the column menu.
  const columnVis = useColumnVisibility('signals', ['category']);
  const [risk, setRisk] = useState<StockRisk | ''>('');

  const rows = useMemo(() => signalRows(products.data, competitors), [products.data, competitors]);
  const counts = useMemo(() => {
    const m = new Map<StockRisk, number>(RISK_ORDER.map((r) => [r, 0]));
    for (const r of rows) m.set(r.stockRisk, (m.get(r.stockRisk) ?? 0) + 1);
    return m;
  }, [rows]);
  const filtered = useMemo(() => (risk ? rows.filter((r) => r.stockRisk === risk) : rows), [rows, risk]);

  /*
   * SIG-001…008/015…018 — one central column model: every track has a fixed width (Name absorbs
   * the rest), header and rows share it through the table colgroup, metric columns are
   * left-aligned per the Signals spec with tabular figures, and each metric keeps its value as one
   * semantic token ("-0.5 · Inelastic", "1,000/mo", "3d"). No per-cell offsets anywhere.
   */
  const nf = (n: number) => n.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US');
  const columns: DataColumn<SkuSignals>[] = [
    {
      id: 'sku', header: t('signals.table.sku'), required: true, defaultWidth: 128,
      cell: (r) => <SkuId sku={r.product.sku} href={`/catalog/${r.product.sku}`} />,
    },
    {
      id: 'name', header: t('signals.table.name'), defaultWidth: 280,
      cell: (r) => <ProductIdentity product={r.product} size="sm" showSku={false} />,
    },
    { id: 'category', header: t('signals.table.category'), defaultWidth: 160, cell: (r) => <span className="block truncate text-muted">{r.product.category}</span> },
    {
      id: 'velocity', header: t('signals.table.velocity'), headerHint: t('signals.def.velocity'), defaultWidth: 140,
      cell: (r) => <span className="tabular whitespace-nowrap">{nf(Math.round(r.velocity))}/mo</span>,
    },
    {
      id: 'elasticity', header: t('signals.table.elasticity'), headerHint: t('signals.def.elasticity'), defaultWidth: 172,
      cell: (r) => <span className="tabular whitespace-nowrap">{r.product.elasticity} · {t(`catalog.elasticity.${r.elasticityBand}`)}</span>,
    },
    {
      id: 'coverage', header: t('signals.table.coverage'), headerHint: t('signals.def.coverage'), defaultWidth: 128,
      cell: (r) => <span className="tabular">{r.competitorCoverage}</span>,
    },
    {
      id: 'stock', header: t('signals.table.stock'), defaultWidth: 112,
      cell: (r) => <span className="tabular">{nf(r.product.stockUnits)}</span>,
    },
    {
      id: 'daysSupply', header: t('signals.table.daysSupply'), headerHint: t('signals.def.daysSupply'), defaultWidth: 152,
      cell: (r) => <span className="tabular">{Number.isFinite(r.daysOfSupply) ? `${Math.round(r.daysOfSupply)}d` : '—'}</span>,
    },
    {
      id: 'risk', header: t('signals.table.risk'), headerHint: t('signals.def.risk'), required: true, defaultWidth: 136,
      cell: (r) => <StatusBadge status={RISK_STATUS[r.stockRisk]} label={t(`signals.risk.${r.stockRisk}`)} />,
    },
  ];

  return (
    <>
      <PageHeader title={t('signals.page.title')} subtitle={t('signals.page.desc')} />
      <p className="mb-5 rounded-input border border-line bg-subtle px-4 py-2.5 text-caption text-muted">{t('signals.page.honest')}</p>

      {products.isLoading ? <LoadingRows rows={6} /> : products.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={products.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState variant="empty" title={t('signals.empty')} />
      ) : (
        <>
          <ul aria-label={t('signals.risk.title')} className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {RISK_ORDER.map((rk) => (
              <li key={rk}>
                <button
                  type="button"
                  onClick={() => setRisk((cur) => (cur === rk ? '' : rk))}
                  aria-pressed={risk === rk}
                  className={cn(
                    'flex h-16 w-full items-center justify-between rounded-card border px-5 text-left transition-colors duration-fast',
                    risk === rk ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
                  )}
                >
                  <span className="text-xs font-medium">{t(`signals.risk.${rk}`)}</span>
                  <span className="tabular text-lg font-semibold">{counts.get(rk) ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
          <MestaDataTable
            tableId="signals"
            caption={t('signals.table.caption')}
            rows={filtered}
            getRowId={(r) => r.product.sku}
            columns={columns}
            resizable
            virtualize
            minWidth={1200}
            visibility={columnVis}
            csv={{
              filename: 'mesta-signals.csv',
              headers: ['sku', 'name', 'category', 'brand', 'velocity', 'elasticity', 'coverage', 'stockUnits', 'daysOfSupply', 'stockRisk'],
              cells: (r) => [
                r.product.sku, r.product.name, r.product.category, r.product.brand,
                Math.round(r.velocity), r.product.elasticity, r.competitorCoverage,
                r.product.stockUnits, Number.isFinite(r.daysOfSupply) ? Math.round(r.daysOfSupply) : '',
                r.stockRisk,
              ],
            }}
          />
          {risk && (
            <button type="button" className="mt-2 text-xs text-brand hover:underline" onClick={() => setRisk('')}>
              {t('common.state.clearFilters')}
            </button>
          )}
        </>
      )}
    </>
  );
}
