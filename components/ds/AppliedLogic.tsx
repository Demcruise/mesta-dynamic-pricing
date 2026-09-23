'use client';

import Link from 'next/link';
import { checkPrice, priceBounds } from '@/lib/guardrails';
import { formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product, Recommendation, Rule, Scenario, Strategy } from '@/lib/ontology';
import { describeCondition, describeFormula } from '@/features/rules/rule-format';
import { cn } from '@/lib/utils';

interface Step {
  key: string;
  title: string;
  detail: React.ReactNode;
}

/**
 * SIM-007 "explain the applied logic": the full chain behind a recommendation —
 * strategy → rule → signals → constraints → calculation — each hop traceable.
 */
export function AppliedLogic({
  rec, product, strategy, rule, scenario,
}: {
  rec: Recommendation;
  product: Product | undefined;
  strategy: Strategy | null;
  rule: Rule | null;
  scenario: Scenario | null;
}) {
  const { t, locale } = useTranslation();
  const steps: Step[] = [
    {
      key: 'strategy',
      title: t('recommendations.logic.strategy'),
      detail: strategy
        ? <Link href={`/strategy/${strategy.id}/edit`} className="text-brand underline-offset-2 hover:underline">{strategy.name}</Link>
        : <span className="text-faint">{t('recommendations.logic.none')}</span>,
    },
    {
      key: 'rule',
      title: t('recommendations.logic.rule'),
      detail: rule ? (
        <span>
          <Link href="/rules" className="text-brand underline-offset-2 hover:underline">{rule.id}</Link>
          {' · '}{rule.when.map((c) => describeCondition(c, t)).join(' AND ')}{' → '}{describeFormula(rule.then, t)}
        </span>
      ) : <span className="text-faint">{t('recommendations.logic.none')}</span>,
    },
    {
      key: 'signals',
      title: t('recommendations.logic.signals'),
      detail: rec.rationale.length === 0 ? (
        <span className="text-faint">{t('recommendations.logic.none')}</span>
      ) : (
        <ul className="space-y-0.5">
          {rec.rationale.map((f, i) => (
            <li key={i}><b>{Math.round(f.weight * 100)}%</b> {t(`recommendations.factor.${f.key}`)} — {f.detail}</li>
          ))}
        </ul>
      ),
    },
    {
      key: 'constraints',
      title: t('recommendations.logic.constraints'),
      detail: product ? (() => {
        const b = priceBounds(product, strategy);
        const c = checkPrice(product, strategy, rec.proposedPrice);
        return (
          <span>
            {formatPrice(b.min, locale)} – {formatPrice(b.max, locale)}
            {b.mapEnforced ? ` · MAP ${formatPrice(product.mapPrice, locale)}` : ''}
            {' → '}
            <b className={cn(c === 'ok' ? 'text-up' : 'text-down')}>{t(`guardrails.check.${c}`)}</b>
          </span>
        );
      })() : <span className="text-faint">{t('recommendations.logic.noProduct')}</span>,
    },
    {
      key: 'calculation',
      title: t('recommendations.logic.calculation'),
      detail: (
        <span>
          {formatPrice(rec.currentPrice, locale)} → {formatPrice(rec.proposedPrice, locale)}
          {' · '}{t('recommendations.logic.impact')}{' '}
          <b>{formatPrice(rec.projectedMarginImpact, locale)}</b>
          {scenario ? ` · ${t('recommendations.logic.fromScenario')} ${scenario.id}` : ''}
        </span>
      ),
    },
  ];

  return (
    <ol className="relative space-y-3 border-l border-line pl-4">
      {steps.map((s, i) => (
        <li key={s.key} className="relative">
          <span
            aria-hidden
            className="absolute -left-[21px] top-1 flex size-2.5 items-center justify-center rounded-full border-2 border-surface bg-brand"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
            {i + 1}. {s.title}
          </h3>
          <div className="mt-0.5 text-xs text-fg">{s.detail}</div>
        </li>
      ))}
    </ol>
  );
}

