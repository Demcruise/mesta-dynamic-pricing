'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { EmptyState, LoadingRows, PageHeader } from '@/components/ds/states';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, inputCls } from '@/components/ui/field';
import { saveScenario, sendScenario } from '@/lib/actions/scenario';
import { FreshnessBadge } from '@/components/ds/system-status';
import { checkPrice, priceBounds } from '@/lib/guardrails';
import { useCan } from '@/lib/hooks';
import { formatPercent, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product, Strategy } from '@/lib/ontology';
import { BASE_UNITS, CI, project } from '@/lib/projection';
import { useCompetitorObservations, useScenario, useScenarios, useScopedSkuList, useSkuDetail, useSkuList, useStrategies } from '@/lib/queries';
import { skusInScope } from '@/lib/strategy-rules';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { DemandChart } from './DemandChart';
import { ScenarioCompare } from './ScenarioCompare';

const MAX_SCENARIOS = 3;

/** Closest historical price point to `price` — the "has this been tried before" comparison. */
function nearestHistory(product: Product, price: number): { at: string; price: number; delta: number } | null {
  const h = product.priceHistory;
  if (!h.length) return null;
  const nearest = h.reduce((a, b) => (Math.abs(b.price - price) < Math.abs(a.price - price) ? b : a));
  return { at: nearest.at, price: nearest.price, delta: price / nearest.price - 1 };
}

interface Draft {
  key: number;
  price: string;
  savedId: string | null;
  sentRec: string | null;
  dirty: boolean;
}

export function SimulationPage({ scenarioId }: { scenarioId?: string }) {
  const { t } = useTranslation();
  const sp = useSearchParams();
  const saved = useScenario(scenarioId ?? '');
  const products = useSkuList();
  if (products.isLoading || (scenarioId && saved.isLoading)) return <LoadingRows rows={5} />;
  if (scenarioId && !saved.data) return <EmptyState title={t('simulation.notFound')} />;
  const sku = saved.data?.sku ?? sp.get('sku') ?? '';
  const strategyId = saved.data ? saved.data.strategyId : sp.get('strategyId');
  return <Simulator key={`${scenarioId ?? ''}|${sku}|${strategyId ?? ''}`} sku={sku} strategyId={strategyId} initial={saved.data ?? null} basePrice={products.data.find((p) => p.sku === sku)?.price ?? null} />;
}

function Simulator({ sku, strategyId, initial, basePrice }: {
  sku: string; strategyId: string | null; basePrice: number | null;
  initial: { id: string; proposedPrice: number; recommendationId: string | null } | null;
}) {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const product = useSkuDetail(sku).data;
  const strategies = useStrategies().data;
  const competitorObs = useCompetitorObservations(sku).data;
  const competitorFreshAt = useMemo(() => competitorObs.map((o) => o.observedAt).sort().at(-1) ?? null, [competitorObs]);
  useScenarios();

  const strategy: Strategy | null = strategyId ? strategies.find((s) => s.id === strategyId) ?? null : null;
  const [seq, setSeq] = useState(1);
  const [scenarios, setScenarios] = useState<Draft[]>(() => [
    initial
      ? { key: 0, price: String(initial.proposedPrice), savedId: initial.id, sentRec: initial.recommendationId, dirty: false }
      : { key: 0, price: basePrice !== null ? String(basePrice) : '', savedId: null, sentRec: null, dirty: false },
  ]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = scenarios.some((s) => s.dirty && !s.sentRec);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!product) return <SkuPicker strategyId={strategyId} />;

  const bounds = priceBounds(product, strategy);
  const base = project(product, product.price);
  const rows = scenarios.map((s) => ({ s, price: Number(s.price), check: checkPrice(product, strategy, Number(s.price)) }));
  const update = (key: number, patch: Partial<Draft>) =>
    setScenarios((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const persist = (d: Draft, price: number) => {
    const r = saveScenario(user, { id: d.savedId, sku: product.sku, strategyId, proposedPrice: price });
    if (!r.ok) { toast(t(`simulation.err.${r.error}`)); return null; }
    update(d.key, { savedId: r.scenario.id, dirty: false });
    return r.scenario.id;
  };

  const send = (d: Draft, price: number) => {
    const id = persist(d, price);
    if (!id) return;
    const r = sendScenario(user, id);
    if (!r.ok) { toast(t(`simulation.err.${r.error}`)); return; }
    update(d.key, { sentRec: r.recommendation.id });
    toast(`${t('simulation.sentNotice')} (${r.recommendation.id})`);
  };

  const discard = () => {
    setScenarios([{ key: seq, price: String(product.price), savedId: null, sentRec: null, dirty: false }]);
    setSeq(seq + 1);
    setConfirmDiscard(false);
  };

  const markers = [
    { label: 'B', price: product.price },
    ...(product.cost >= product.minPrice && product.cost <= product.maxPrice ? [{ label: 'E', price: product.cost }] : []),
    ...rows.filter((r) => r.check === 'ok').map((r, i) => ({ label: String(i + 1), price: r.price })),
  ];
  const columns = [{ label: t('simulation.baseline'), p: base }, ...rows.filter((r) => Number.isFinite(r.price) && r.price > 0).map((r, i) => ({ label: t('simulation.scenario', { n: i + 1 }), p: project(product, r.price) }))];
  const pct = (v: number) => formatPercent(v, locale);
  const metric: { key: string; render: (p: ReturnType<typeof project>) => React.ReactNode }[] = [
    { key: 'price', render: (p) => <PriceValue value={Math.round(p.price)} /> },
    { key: 'priceDelta', render: (p) => <DeltaBadge value={p.priceDelta} /> },
    { key: 'competitorAvg', render: () => <PriceValue value={Math.round(product.competitorAvg)} muted /> },
    { key: 'vsCompetitor', render: (p) => <DeltaBadge value={product.competitorAvg > 0 ? p.price / product.competitorAvg - 1 : 0} /> },
    { key: 'units', render: (p) => <span className="tabular">{Math.round(p.units)}</span> },
    { key: 'demandChange', render: (p) => <DeltaBadge value={p.demandChange} /> },
    // SIM-004: customer response band derived from the same elasticity model (labelled in the row header tooltip).
    { key: 'customerResponse', render: (p) => <span className="text-xs">{t(`simulation.response.${p.demandChange <= -0.15 ? 'strongDrop' : p.demandChange < -0.03 ? 'mildDrop' : p.demandChange >= 0.15 ? 'strongGain' : p.demandChange > 0.03 ? 'mildGain' : 'neutral'}`)}</span> },
    // SIM-004: historical comparison — nearest observed price point for this SKU.
    {
      key: 'historical',
      render: (p) => {
        const h = nearestHistory(product, p.price);
        return h === null
          ? <span className="text-xs text-muted">{t('simulation.historical.none')}</span>
          : <span className="text-xs"><DeltaBadge value={h.delta} /> <span className="text-muted">{t('simulation.historical.vs', { at: formatRelativeTime(h.at, locale), price: Math.round(h.price).toLocaleString(locale === 'id' ? 'id-ID' : 'en-US') })}</span></span>;
      },
    },
    { key: 'revenue', render: (p) => <PriceValue value={Math.round(p.revenue)} /> },
    { key: 'grossMargin', render: (p) => <PriceValue value={Math.round(p.grossMargin)} /> },
    { key: 'marginPct', render: (p) => <span className="tabular">{pct(p.marginPct)}</span> },
    { key: 'breakEven', render: () => <PriceValue value={product.cost} muted /> },
  ];

  return (
    <>
      <PageHeader
        title={t('simulation.title')}
        subtitle={`${product.sku} · ${product.name}`}
        actions={
          <>
            <FreshnessBadge at={competitorFreshAt} label={competitorFreshAt ? t('simulation.competitorFresh', { at: formatRelativeTime(competitorFreshAt, locale) }) : undefined} />
            <Link href="/simulation" className="text-sm text-muted underline">{t('simulation.context.change')}</Link>
            <Button variant="secondary" disabled={!dirty && scenarios.length === 1} onClick={() => (dirty ? setConfirmDiscard(true) : discard())}>
              {t('simulation.controls.discard')}
            </Button>
          </>
        }
      />
      <StrategySelect product={product} strategyId={strategyId} />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {rows.map(({ s, price, check }, i) => {
          const disabled = !!s.sentRec || !can('simulation.use');
          const errId = `err-${s.key}`;
          return (
            <section key={s.key} aria-label={t('simulation.scenario', { n: i + 1 })} className="rounded-card border border-line bg-surface p-card shadow-e1">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t('simulation.scenario', { n: i + 1 })}</h2>
                {scenarios.length > 1 && !s.sentRec && (
                  <button type="button" aria-label={t('simulation.controls.remove', { n: i + 1 })} className="text-muted transition-colors duration-fast hover:text-fg"
                    onClick={() => setScenarios((all) => all.filter((x) => x.key !== s.key))}>×</button>
                )}
              </div>
              <label className="text-xs text-muted" htmlFor={`price-${s.key}`}>{t('simulation.controls.price')}</label>
              <Input id={`price-${s.key}`} type="number" inputMode="numeric" value={s.price} disabled={disabled}
                aria-invalid={check !== 'ok'} aria-describedby={check !== 'ok' ? errId : undefined}
                onChange={(e) => update(s.key, { price: e.target.value, dirty: true })} />
              <input
                type="range" aria-label={t('simulation.controls.slider')} className="mt-2 w-full" step={100} disabled={disabled || bounds.min >= bounds.max}
                min={bounds.min} max={bounds.max} value={Math.min(Math.max(price || product.price, bounds.min), bounds.max)}
                onChange={(e) => update(s.key, { price: e.target.value, dirty: true })}
              />
              <p className="mt-1 text-xs text-faint">{t('simulation.controls.range', { min: bounds.min.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US'), max: bounds.max.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US') })}</p>
              {check !== 'ok' && <p id={errId} role="alert" className="mt-1 text-xs text-critical">{t(`simulation.err.${check}`)}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={disabled} onClick={() => update(s.key, { price: String(product.price), dirty: true })}>{t('simulation.controls.reset')}</Button>
                <Button size="sm" variant="secondary" disabled={disabled || check !== 'ok'} onClick={() => persist(s, price)}>{t('simulation.controls.save')}</Button>
                <Button size="sm" disabled={disabled || check !== 'ok'} onClick={() => send(s, price)}>{t('simulation.controls.send')}</Button>
              </div>
              {s.savedId && !s.sentRec && <p className="mt-2 text-xs text-muted">{t('simulation.controls.saved', { id: s.savedId })}{s.dirty ? ' *' : ''}</p>}
              {s.sentRec && (
                <p className="mt-2 text-xs text-up">
                  {t('simulation.controls.sent', { rec: s.sentRec })} · <Link className="underline" href={`/recommendations/${s.sentRec}`}>{t('simulation.viewQueue')}</Link>
                </p>
              )}
            </section>
          );
        })}
        {scenarios.length < MAX_SCENARIOS && (
          <button
            type="button"
            className="rounded-card border border-dashed border-line p-4 text-sm text-muted transition-colors duration-fast hover:bg-subtle"
            onClick={() => { setScenarios((all) => [...all, { key: seq, price: String(product.price), savedId: null, sentRec: null, dirty: true }]); setSeq(seq + 1); }}
          >
            + {t('simulation.controls.add')}
          </button>
        )}
      </div>

      <ScenarioCompare columns={columns} />

      <section className="mb-4 overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">{t('simulation.title')}</caption>
          <thead className="bg-subtle text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium" />
              {columns.map((c) => <th key={c.label} scope="col" className="px-3 py-2 text-right font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {metric.map((m) => (
              <tr key={m.key} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-medium text-muted">{t(`simulation.metric.${m.key}`)}</th>
                {columns.map((c) => <td key={c.label} className="px-3 py-2 text-right">{m.render(c.p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <DemandChart product={product} markers={markers} />
        <section className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 className="mb-2 text-sm font-semibold">{t('simulation.assumptions.title')}</h2>
          <p className="text-sm text-muted">
            {t('simulation.assumptions.body', { base: BASE_UNITS, elasticity: product.elasticity, ci: Math.round(CI * 100) })}
          </p>
          <p className="mt-2 text-xs text-faint">
            {competitorFreshAt
              ? t('simulation.assumptions.runState', { n: competitorObs.length, at: formatRelativeTime(competitorFreshAt, locale) })
              : t('simulation.assumptions.noCompetitorData')}
          </p>
        </section>
      </div>

      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title={t('simulation.confirmDiscard.title')}>
        <p className="mb-4 text-sm text-muted">{t('simulation.confirmDiscard.body')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>{t('simulation.confirmDiscard.cancel')}</Button>
          <Button variant="destructive" onClick={discard}>{t('simulation.confirmDiscard.confirm')}</Button>
        </div>
      </Dialog>
    </>
  );
}

function StrategySelect({ product, strategyId }: { product: Product; strategyId: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const strategies = useStrategies().data;
  const products = useSkuList().data;
  const options = useMemo(
    () => strategies.filter((s) => s.status === 'active' && skusInScope(s, products).has(product.sku)),
    [strategies, products, product.sku],
  );
  return (
    <label className="mb-4 flex max-w-md flex-col gap-1 text-xs font-medium text-muted">
      {t('simulation.context.strategy')}
      <select
        className={inputCls}
        value={strategyId ?? ''}
        onChange={(e) => router.replace(`/simulation?sku=${product.sku}${e.target.value ? `&strategyId=${e.target.value}` : ''}`)}
      >
        <option value="">{t('simulation.context.noStrategy')}</option>
        {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}

function SkuPicker({ strategyId }: { strategyId: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const products = useScopedSkuList().data;
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n ? products.filter((p) => p.sku.toLowerCase().includes(n) || p.name.toLowerCase().includes(n)) : products).slice(0, 8);
  }, [q, products]);
  return (
    <>
      <PageHeader title={t('simulation.title')} subtitle={t('simulation.subtitle')} />
      <div className="max-w-md">
        <p className="mb-2 text-sm text-muted">{t('simulation.context.pick')}</p>
        <Input aria-label={t('simulation.context.searchSku')} placeholder={t('simulation.context.searchSku')} value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface shadow-e1">
          {hits.map((p) => (
            <li key={p.sku}>
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors duration-fast hover:bg-subtle"
                onClick={() => router.push(`/simulation?sku=${p.sku}${strategyId ? `&strategyId=${strategyId}` : ''}`)}>
                <span><span className="tabular">{p.sku}</span> · {p.name}</span>
                <PriceValue value={p.price} muted />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
