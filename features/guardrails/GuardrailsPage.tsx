'use client';

import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { inputCls } from '@/components/ui/field';
import { checkPrice, priceBounds } from '@/lib/guardrails';
import { formatPercent, formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { useRules, useScopedSkuList, useStrategies } from '@/lib/queries';
import { describeFormula } from '@/features/rules/rule-format';
import { catalogRows, skuReport, type ConstraintId } from './report';

const CONSTRAINT_ORDER: ConstraintId[] = ['bounds', 'map', 'max_change', 'auto_approve', 'margin_floor', 'staleness'];

export function GuardrailsPage() {
  const { t, locale } = useTranslation();
  const products = useScopedSkuList();
  const strategies = useStrategies();
  const rules = useRules();
  const [sku, setSku] = useState('');

  const now = Date.now();
  const rows = useMemo(
    () => catalogRows(products.data, strategies.data, rules.data, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products.data, strategies.data, rules.data],
  );

  const report = useMemo(() => {
    const p = products.data.find((x) => x.sku === sku) ?? products.data[0];
    return p ? skuReport(p, strategies.data, rules.data, now) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku, products.data, strategies.data, rules.data]);

  const breaches = useMemo(
    () => products.data.filter((p) => checkPrice(p, null, p.price) !== 'ok'),
    [products.data],
  );

  if (products.isLoading || strategies.isLoading || rules.isLoading) return <LoadingRows rows={4} rowHeight={90} />;
  if (products.isError || strategies.isError || rules.isError) {
    return <ErrorState title={t('common.state.error')} onRetry={() => { products.refetch(); strategies.refetch(); rules.refetch(); }} />;
  }

  return (
    <>
      <PageHeader title={t('guardrails.page.title')} subtitle={t('guardrails.page.desc')} />

      <section aria-label={t('guardrails.catalog.title')}>
        <h2 className="mb-2 text-sm font-semibold">{t('guardrails.catalog.title')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CONSTRAINT_ORDER.map((id) => {
            const r = rows.find((x) => x.id === id)!;
            return (
              <li key={id} className="rounded-card border border-line bg-surface p-card shadow-e1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium">{t(`guardrails.constraint.${id}.name`)}</h3>
                  <StatusBadge status={r.breaches > 0 ? 'failed' : r.enforced ? 'active' : 'info'} label={r.breaches > 0 ? t('guardrails.breached', { n: r.breaches }) : t(r.enforced ? 'guardrails.enforced' : 'guardrails.observed')} />
                </div>
                <p className="mt-1 text-xs text-muted">{t(`guardrails.constraint.${id}.desc`)}</p>
                <p className="mt-2 text-xs text-fg">
                  {t('guardrails.covered', { n: r.covered })}
                  {r.detail ? ` · ${t(`guardrails.constraint.${id}.detail`, { v: r.detail })}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6" aria-label={t('guardrails.breaches.title')}>
        <h2 className="mb-2 text-sm font-semibold">{t('guardrails.breaches.title')}</h2>
        {breaches.length === 0 ? (
          <EmptyState variant="caughtUp" title={t('guardrails.breaches.none')} />
        ) : (
          <ul className="rounded-card border border-down bg-down-soft p-3 text-sm">
            {breaches.map((p) => <li key={p.sku}>{p.sku} — {p.price}</li>)}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-label={t('guardrails.drill.title')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('guardrails.drill.title')}</h2>
          <select aria-label={t('guardrails.drill.pick')} className={`${inputCls} w-64`} value={report?.product.sku ?? ''} onChange={(e) => setSku(e.target.value)}>
            {products.data.map((p) => <option key={p.sku} value={p.sku}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        {report && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-card shadow-e1">
              <h3 className="text-sm font-medium">{report.product.sku} · {report.product.name}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted">{t('guardrails.drill.current')}</dt>
                <dd className="text-fg">{formatPrice(report.product.price, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.rawBounds')}</dt>
                <dd className="text-fg">{formatPrice(report.product.minPrice, locale)} – {formatPrice(report.product.maxPrice, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.effectiveBounds')}</dt>
                <dd className="text-fg">{formatPrice(report.bounds.min, locale)} – {formatPrice(report.bounds.max, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.map')}</dt>
                <dd className="text-fg">{report.bounds.mapEnforced ? formatPrice(report.product.mapPrice, locale) : t('guardrails.drill.mapOff')}</dd>
                <dt className="text-muted">{t('guardrails.drill.margin')}</dt>
                <dd className="text-fg">{formatPercent(report.marginPct / 100, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.headroom')}</dt>
                <dd className="text-fg">{formatPercent(report.headroomPct / 100, locale)}</dd>
                <dt className="text-muted">{t('guardrails.drill.lastChange')}</dt>
                <dd className="text-fg">{t('guardrails.drill.daysAgo', { n: report.daysSinceChange })}</dd>
                <dt className="text-muted">{t('guardrails.drill.check')}</dt>
                <dd><StatusBadge status={report.check === 'ok' ? 'healthy' : 'failed'} label={t(`guardrails.check.${report.check}`)} /></dd>
              </dl>
            </div>
            <div className="rounded-card border border-line bg-surface p-card shadow-e1">
              <h3 className="text-sm font-medium">{t('guardrails.drill.governedBy')}</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">{t('guardrails.drill.strategy')}</dt>
                  <dd className="text-fg">{report.strategy ? `${report.strategy.name} (±${report.strategy.guardrail.maxChangePercent}%, ≥${report.strategy.guardrail.autoApproveThreshold})` : t('guardrails.drill.noStrategy')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">{t('guardrails.drill.rules')}</dt>
                  <dd className="min-w-0 flex-1 text-fg">
                    {report.rules.length === 0 ? t('guardrails.drill.noRules') : (
                      <ul className="space-y-1">
                        {report.rules.map((r) => <li key={r.id}><b>{r.id}</b> {r.name} — {describeFormula(r.then, t)}</li>)}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
