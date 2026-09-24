'use client';

import { ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { marginHealth, marginPct } from '@/lib/domain';
import { formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { cn } from '@/lib/utils';
import { DeltaBadge } from './DeltaBadge';
import { LiveDot } from './LiveDot';
import { Pill } from './Pill';
import { PriceValue } from './PriceValue';
import { Panel } from './states';

const HEALTH_BAR = { healthy: 'bg-up-graphic', thin: 'bg-warn', critical: 'bg-down-graphic' } as const;
const MAX_ITEMS = 5;

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
    <Panel
      aria-label={t('overview.movers.title')}
      icon={ArrowUpDown}
      title={t('overview.movers.title')}
      actions={<Pill tone="up" size="sm"><LiveDot /> {t('overview.movers.live')}</Pill>}
    >
      {movers.length === 0 ? <p className="text-[13px] text-muted">{t('overview.movers.empty')}</p> : (
        <ul className="flex flex-col gap-1.5">
          {movers.map(({ p, delta }) => {
            const m = marginPct(p);
            const health = marginHealth(p);
            return (
              <li key={p.sku}>
                <Link
                  href={`/catalog?q=${encodeURIComponent(p.sku)}`}
                  className="grid grid-cols-[minmax(0,1fr)_3rem_auto] items-center gap-3 rounded-row bg-row px-2.5 py-2 transition-colors duration-fast hover:bg-subtle"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-fg">{p.name}</span>
                    <span className="tabular block truncate text-[11px] text-faint">{p.sku}</span>
                  </span>
                  <span
                    role="meter" aria-label={t('overview.movers.margin')} aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={Math.round(m * 100)} aria-valuetext={formatPercent(m, locale)}
                    className="h-1.5 w-12 overflow-hidden rounded-full bg-subtle"
                  >
                    <span className={cn('block h-full rounded-full', HEALTH_BAR[health])} style={{ width: `${Math.min(100, Math.max(0, m * 100))}%` }} />
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <PriceValue value={p.price} className="text-xs font-semibold" />
                    <DeltaBadge value={delta} variant="text" size="sm" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
