'use client';

import { useMemo, useState } from 'react';
import { ConstraintRange } from '@/components/ds/ConstraintRange';
import { inputCls } from '@/components/ui/field';
import { explainBounds } from '@/lib/guardrails';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import type { StrategyDraft } from '@/lib/strategy-rules';
import { skusInScope } from '@/lib/strategy-rules';
import { cn } from '@/lib/utils';

/**
 * Effective bounds for the draft guardrail (STRATEGY-007…017). A strategy covers many SKUs and each
 * has its own product limits, MAP and current price, so the range is explained for one SKU at a time
 * (picker defaults to the first scoped SKU) plus a one-line scope summary. Recomputed on every edit —
 * the form and the preview can never disagree (STRATEGY-017).
 */
export function GuardrailPreview({ draft, products, className }: { draft: StrategyDraft; products: Product[]; className?: string }) {
  const { t } = useTranslation();
  const g = draft.guardrail;
  const scoped = useMemo(() => {
    const ids = skusInScope(draft, products);
    return products.filter((p) => ids.has(p.sku));
  }, [draft, products]);
  const [pick, setPick] = useState<string | null>(null);
  const product = scoped.find((p) => p.sku === pick) ?? scoped[0];

  const outside = useMemo(
    () => scoped.filter((p) => {
      const s = explainBounds(p, g).state;
      return s === 'below' || s === 'above' || s === 'invalid';
    }).length,
    [scoped, g],
  );

  if (!product) {
    return <p className={cn('rounded-card border border-dashed border-line-strong px-4 py-6 text-center text-body-sm text-muted', className)}>{t('common.bounds.noScope')}</p>;
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className={cn('text-body-sm font-medium', outside > 0 ? 'text-warn' : 'text-muted')}>
          {outside > 0 ? t('common.bounds.scopeOutside', { n: outside, total: scoped.length }) : t('common.bounds.scopeInside', { total: scoped.length })}
        </p>
        <label className="flex items-center gap-2 text-label text-muted">
          {t('common.bounds.previewFor')}
          <select className={cn(inputCls, 'w-64')} value={product.sku} onChange={(e) => setPick(e.target.value)}>
            {scoped.slice(0, 200).map((p) => <option key={p.sku} value={p.sku}>{p.sku} · {p.name}</option>)}
          </select>
        </label>
      </div>
      <ConstraintRange bounds={explainBounds(product, g)} strategyName={draft.name || undefined} />
    </div>
  );
}
