'use client';

import { FlaskConical, PencilLine, ScrollText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { Drawer } from '@/components/ds/Drawer';
import { PriceValue } from '@/components/ds/PriceValue';
import { Sparkline } from '@/components/ds/Sparkline';
import { RoleGate } from '@/components/shell/RoleGate';
import { competitorGap, elasticityBand, marginHealth, marginPct } from '@/lib/domain';
import { formatDate, formatPercent } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { cn } from '@/lib/utils';

const HEALTH_CLS = { healthy: 'text-up', thin: 'text-warn', critical: 'text-down' } as const;

/** Quick-view side drawer for a catalog row; the full SKU page remains one click away. */
export function SkuDrawer({ product, pendingSkus, detailQuery = '', onClose, onOverride }: {
  product: Product | null;
  pendingSkus: Set<string>;
  /** Serialized catalog filters so the full page keeps the analyst's current result set. */
  detailQuery?: string;
  onClose: () => void;
  onOverride: (p: Product) => void;
}) {
  const { t, locale } = useTranslation();
  return (
    <Drawer
      open={product !== null}
      onClose={onClose}
      title={product ? `${product.sku} — ${product.name}` : ''}
      href={product ? `/catalog/${product.sku}${detailQuery ? `?${detailQuery}` : ''}` : undefined}
    >
      {product && (
        <div className="flex flex-col gap-4 text-sm">
          {pendingSkus.has(product.sku) && (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-agent">
              <Sparkles className="size-3.5" aria-hidden />{t('catalog.ai.pending')}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><dt className="text-xs text-muted">{t('catalog.col.category')}</dt><dd>{product.category}</dd></div>
            <div><dt className="text-xs text-muted">{t('catalog.col.stock')}</dt><dd className="tabular">{product.stockUnits} <span className="text-xs text-muted">({t(`catalog.stock.${product.stockStatus}`)})</span></dd></div>
            <div><dt className="text-xs text-muted">{t('catalog.col.price')}</dt><dd><PriceValue value={product.price} animate /></dd></div>
            <div><dt className="text-xs text-muted">{t('catalog.col.cost')}</dt><dd><PriceValue value={product.cost} muted /></dd></div>
            <div>
              <dt className="text-xs text-muted">{t('catalog.col.margin')}</dt>
              <dd className={cn('tabular', HEALTH_CLS[marginHealth(product)])}>{formatPercent(marginPct(product), locale)} ({t(`catalog.health.${marginHealth(product)}`)})</dd>
            </div>
            <div><dt className="text-xs text-muted">{t('catalog.col.elasticity')}</dt><dd>{t(`catalog.elasticity.${elasticityBand(product.elasticity)}`)}</dd></div>
            <div>
              <dt className="text-xs text-muted">{t('catalog.col.competitor')}</dt>
              <dd className="flex items-center gap-2"><PriceValue value={product.competitorAvg} muted /><DeltaBadge value={competitorGap(product)} /></dd>
            </div>
            <div><dt className="text-xs text-muted">{t('catalog.col.lastChange')}</dt><dd className="tabular">{formatDate(product.lastChangeAt, locale)}</dd></div>
          </dl>
          <p className="text-xs text-faint">
            {t('catalog.detail.minMax')}: <PriceValue value={product.minPrice} /> – <PriceValue value={product.maxPrice} /> · {t('catalog.detail.map')}: <PriceValue value={product.mapPrice} />
          </p>
          <section>
            <h3 className="mb-1 text-xs font-medium text-muted">{t('catalog.detail.history')}</h3>
            <Sparkline points={product.priceHistory.map((h) => h.price)} tone="brand" className="h-16 w-full" />
          </section>
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <RoleGate action="simulation.use">
              <Link href={`/simulation?sku=${product.sku}`} className="inline-flex h-9 items-center gap-1.5 rounded-input border border-line px-3 text-sm transition-colors duration-fast hover:bg-subtle">
                <FlaskConical className="size-4" aria-hidden />{t('catalog.action.simulate')}
              </Link>
            </RoleGate>
            <RoleGate action="catalog.override_price">
              <button type="button" onClick={() => onOverride(product)} className="inline-flex h-9 items-center gap-1.5 rounded-input border border-line px-3 text-sm transition-colors duration-fast hover:bg-subtle">
                <PencilLine className="size-4" aria-hidden />{t('catalog.action.override')}
              </button>
            </RoleGate>
            <Link href={`/audit?sku=${product.sku}`} className="inline-flex h-9 items-center gap-1.5 rounded-input border border-line px-3 text-sm transition-colors duration-fast hover:bg-subtle">
              <ScrollText className="size-4" aria-hidden />{t('catalog.action.audit')}
            </Link>
          </div>
        </div>
      )}
    </Drawer>
  );
}
