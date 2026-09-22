'use client';

import Link from 'next/link';
import { marginHealth, marginPct } from '@/lib/domain';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { cn } from '@/lib/utils';
import { DeltaBadge } from './DeltaBadge';
import { LiveDot } from './LiveDot';
import { PriceValue } from './PriceValue';

const HEALTH_BAR = { healthy: 'bg-up', thin: 'bg-warn', critical: 'bg-down' } as const;
const MAX_ITEMS = 6;

/**
 * "Top price movers" side list — SKUs with the largest latest price move,
 * each with an inline margin-health meter. Rows deep-link into the filtered Catalog.
 */
export function TopMoversPanel({ products }: { products: Product[] }) {
  const { t, locale } = useTranslation();
  const movers = products
    .map((p) => {
      const h = p.priceHistory;
      const prev = h[h.length - 2]?.price ?? h[h.length - 1]?.price ?? p.price;
      const last = h[h.length - 1]?.price ?? p.price;
      return { p, delta: prev ? (last - prev) / prev : 0 };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, MAX_ITEMS);

  return (
    <section aria-label={t('overview.movers.title')} className="rounded-card border border-line bg-surface p-card shadow-e1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('overview.movers.title')}</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-up-soft px-2 py-0.5 text-[11px] font-medium text-up">
          <LiveDot /> {t('overview.movers.live')}
        </span>
      </div>
      {movers.length === 0 ? <p className="text-sm text-muted">{t('overview.movers.empty')}</p> : (
        <ul className="divide-y divide-line">
          {movers.map(({ p, delta }) => {
            const m = marginPct(p);
            const health = marginHealth(p);
            return (
              <li key={p.sku}>
                <Link
                  href={`/catalog?q=${encodeURIComponent(p.sku)}`}
                  className="flex items-center gap-3 py-2 transition-colors duration-fast hover:bg-subtle"
                >
                  <span className="min-w-0 flex-1">
                    <span className="tabular block truncate text-sm font-medium">{p.sku}</span>
                    <span className="block truncate text-xs text-muted">{p.name}</span>
                  </span>
                  <span
                    role="meter" aria-label={t('overview.movers.margin')} aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={Math.round(m * 100)} aria-valuetext={formatPercent(m, locale)}
                    className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-subtle"
                  >
                    <span className={cn('block h-full rounded-full', HEALTH_BAR[health])} style={{ width: `${Math.min(100, Math.max(0, m * 100))}%` }} />
                  </span>
                  <PriceValue value={p.price} muted className="shrink-0 text-xs" />
                  <DeltaBadge value={delta} className="shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
