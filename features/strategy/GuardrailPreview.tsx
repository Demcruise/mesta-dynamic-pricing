'use client';

import { useMemo } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import type { StrategyDraft } from '@/lib/strategy-rules';
import { skusInScope } from '@/lib/strategy-rules';
import { cn } from '@/lib/utils';

const MAX_DOTS = 40;

/**
 * Guardrail range diagram: allowed band between min/max, red outside it,
 * amber when the SKU sits below its MAP (when MAP is enforced).
 * Dots are the current prices of every SKU in scope.
 */
export function GuardrailPreview({ draft, products }: { draft: StrategyDraft; products: Product[] }) {
  const { t } = useTranslation();
  const g = draft.guardrail;
  const scoped = useMemo(() => {
    const ids = skusInScope(draft, products);
    return products.filter((p) => ids.has(p.sku));
  }, [draft, products]);

  const hi = Math.max(g.maxPrice ?? 0, g.minPrice ?? 0, ...scoped.map((p) => Math.max(p.price, p.mapPrice)), 1) * 1.15;
  const minPct = g.minPrice !== null ? (g.minPrice / hi) * 100 : 0;
  const maxPct = g.maxPrice !== null ? (g.maxPrice / hi) * 100 : 100;
  const invalid = g.minPrice !== null && g.maxPrice !== null && g.minPrice >= g.maxPrice;

  type Mark = { sku: string; pct: number; cls: 'out' | 'map' | 'ok' };
  const marks: Mark[] = scoped.slice(0, MAX_DOTS).map((p) => {
    const outside = (g.minPrice !== null && p.price < g.minPrice) || (g.maxPrice !== null && p.price > g.maxPrice);
    const belowMap = g.mapEnforced && p.price < p.mapPrice;
    return { sku: p.sku, pct: (p.price / hi) * 100, cls: outside ? 'out' : belowMap ? 'map' : 'ok' };
  });
  const outCount = marks.filter((m) => m.cls === 'out').length;

  const DOT: Record<Mark['cls'], string> = { out: 'bg-down', map: 'bg-warn', ok: 'bg-up' };

  return (
    <div className="rounded-input border border-line p-3 sm:col-span-2" role="img"
      aria-label={t('strategy.guardrailViz.aria', { n: scoped.length })}>
      <p className="mb-2 text-xs font-medium text-muted">{t('strategy.guardrailViz.title')}</p>
      <div className="relative h-6 overflow-visible rounded-full bg-subtle">
        {/* zones */}
        <div className="absolute inset-y-0 rounded-l-full bg-down-soft" style={{ left: 0, width: `${minPct}%` }} />
        {!invalid && <div className="absolute inset-y-0 bg-up-soft" style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }} />}
        <div className="absolute inset-y-0 rounded-r-full bg-down-soft" style={{ left: `${maxPct}%`, right: 0 }} />
        {/* min/max rails */}
        {g.minPrice !== null && <div className="absolute inset-y-[-3px] w-0.5 bg-down" style={{ left: `${minPct}%` }} />}
        {g.maxPrice !== null && <div className="absolute inset-y-[-3px] w-0.5 bg-down" style={{ left: `${maxPct}%` }} />}
        {/* scoped SKU price dots */}
        {marks.map((m) => (
          <span
            key={m.sku}
            title={`${m.sku} · ${m.cls === 'out' ? t('strategy.guardrailViz.outside') : m.cls === 'map' ? t('strategy.guardrailViz.belowMap') : t('strategy.guardrailViz.within')}`}
            className={cn('absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-surface', DOT[m.cls])}
            style={{ left: `${Math.min(99, Math.max(1, m.pct))}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint">
        <span>{g.minPrice !== null ? <PriceValue value={g.minPrice} muted /> : '0'}</span>
        <span>{g.maxPrice !== null ? <PriceValue value={g.maxPrice} muted /> : t('strategy.guardrailViz.noMax')}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-up" />{t('strategy.guardrailViz.within')}</span>
        {g.mapEnforced && <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-warn" />{t('strategy.guardrailViz.belowMap')}</span>}
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-down" />{t('strategy.guardrailViz.outside')}</span>
        {outCount > 0 && <span className="font-medium text-down">{t('strategy.guardrailViz.outsideCount', { n: outCount })}</span>}
      </div>
    </div>
  );
}
