'use client';

import { CircleCheck, CircleX, MinusCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatPrice, type Locale } from '@/lib/format';
import type { Product, Recommendation } from '@/lib/ontology';
import { evaluateRules, type RuleEvalRow } from '@/lib/rule-eval';
import { cn } from '@/lib/utils';

function fmt(row: RuleEvalRow, v: number | null, locale: Locale): string {
  if (v === null) return '—';
  if (row.kind === 'price') return formatPrice(v, locale);
  if (row.kind === 'percent') return `${v.toFixed(1)}%`;
  if (row.kind === 'score') return `${Math.round(v)}%`;
  return '—';
}

/** Per-check input→expected→actual→result table for a recommendation (§8.2). */
export function RuleEvaluation({ rec, product }: { rec: Recommendation; product: Product | undefined }) {
  const { t, locale } = useTranslation();
  const rows = evaluateRules(rec, product);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t('recommendations.rules.caption')}</caption>
      <thead>
        <tr className="border-b border-line text-left text-xs text-muted">
          <th className="py-1.5 pr-2 font-medium">{t('recommendations.rules.check')}</th>
          <th className="py-1.5 pr-2 font-medium">{t('recommendations.rules.expected')}</th>
          <th className="py-1.5 pr-2 font-medium">{t('recommendations.rules.actual')}</th>
          <th className="py-1.5 font-medium">{t('recommendations.rules.result')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-line last:border-0">
            <td className="py-1.5 pr-2 align-top">
              <p className="text-xs font-medium">{t(`recommendations.rules.rows.${r.key}`)}</p>
              <p className="text-xs text-muted">{t(`recommendations.rules.explain.${r.key}`)}</p>
            </td>
            <td className="tabular py-1.5 pr-2 align-top text-xs text-muted">{fmt(r, r.expected, locale)}</td>
            <td className="tabular py-1.5 pr-2 align-top text-xs">{fmt(r, r.actual, locale)}</td>
            <td className="py-1.5 align-top">
              {!r.applicable ? (
                <span className="inline-flex items-center gap-1 text-xs text-faint"><MinusCircle className="size-3.5" aria-hidden />{t('recommendations.rules.na')}</span>
              ) : (
                <span className={cn('inline-flex items-center gap-1 text-xs', r.ok ? 'text-up' : 'text-down')}>
                  {r.ok ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleX className="size-3.5" aria-hidden />}
                  {t(r.ok ? 'recommendations.rules.pass' : 'recommendations.rules.fail')}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
