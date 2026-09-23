'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { ConsequencePreview, RecoveryNotice } from '@/components/ds/trust';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { cancelExperiment, concludeExperiment, experimentResults, saveExperiment, startExperiment } from '@/lib/actions/experiment';
import { formatDate, formatPrice } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Experiment } from '@/lib/ontology';
import { useExperiments, useScopedSkuSet } from '@/lib/queries';
import { useSessionStore, useToastStore } from '@/lib/stores';

export function ExperimentsPage() {
  const { t, locale } = useTranslation();
  const q = useExperiments();
  const scoped = useScopedSkuSet();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [building, setBuilding] = useState(false);
  const [confirming, setConfirming] = useState<Experiment | null>(null);
  const can = useCan();

  const items = useMemo(
    () => (scoped ? q.data.filter((e) => e.skuIds.some((sku) => scoped.has(sku))) : q.data),
    [q.data, scoped],
  );

  const act = (fn: () => { ok: boolean; error?: string }, okKey?: string) => {
    const r = fn();
    if (r.ok && okKey) toast(t(okKey));
    else if (!r.ok && r.error) toast(t(`experiments.err.${r.error}`));
    return r.ok;
  };

  return (
    <>
      <PageHeader
        title={t('experiments.page.title')} subtitle={t('experiments.page.desc')}
        actions={
          <RoleGate action="experiment.manage">
            <Button onClick={() => setBuilding(true)}>{t('experiments.action.new')}</Button>
          </RoleGate>
        }
      />
      {q.isLoading ? <LoadingRows rows={3} rowHeight={96} /> : q.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={q.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('experiments.empty')}
          {...(can('experiment.manage') ? { action: { label: t('experiments.action.new'), onClick: () => setBuilding(true) } } : {})}
        />
      ) : (
        <ul className="flex max-w-4xl flex-col gap-3">
          {items.map((e) => (
            <ExperimentCard key={e.id} e={e} t={t} locale={locale}
              onStart={() => setConfirming(e)}
              onConclude={() => act(() => concludeExperiment(user, e.id), 'experiments.toast.concluded')}
              onCancel={() => act(() => cancelExperiment(user, e.id), 'experiments.toast.cancelled')}
            />
          ))}
        </ul>
      )}

      <BuilderDialog open={building} onClose={() => setBuilding(false)} />

      <Dialog open={confirming !== null} onClose={() => setConfirming(null)} title={t('experiments.start.title')}>
        {confirming && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{confirming.name} · {t('experiments.start.delta', { pct: confirming.deltaPct })}</p>
            <ConsequencePreview items={[
              { label: t('experiments.start.skus'), value: <span className="tabular">{confirming.skuIds.length}</span> },
              { label: t('experiments.start.deltaLabel'), value: `${confirming.deltaPct > 0 ? '+' : ''}${confirming.deltaPct}%`, tone: confirming.deltaPct > 0 ? 'up' : 'down' },
            ]} />
            <RecoveryNotice>{t('experiments.start.note')}</RecoveryNotice>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(null)}>{t('common.action.cancel')}</Button>
              <Button onClick={() => {
                const ok = act(() => startExperiment(user, confirming.id), 'experiments.toast.started');
                if (ok) setConfirming(null);
              }}>{t('experiments.action.start')}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function ExperimentCard({ e, t, locale, onStart, onConclude, onCancel }: {
  e: Experiment; t: T; locale: 'en' | 'id';
  onStart: () => void; onConclude: () => void; onCancel: () => void;
}) {
  const res = useMemo(() => {
    if (e.status === 'draft') return null;
    const r = experimentResults(e);
    return r.n > 0 ? r : null;
  }, [e]);
  return (
    <li className="rounded-card border border-line bg-surface p-card shadow-e1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge status={e.status} />
        <span className="text-sm font-semibold">{e.name}</span>
        <span className="tabular text-xs text-muted">{e.deltaPct > 0 ? '+' : ''}{e.deltaPct}%</span>
        <span className="tabular text-xs text-muted">{t('experiments.skuCount', { n: e.skuIds.length })}</span>
        <span className="text-xs text-faint">{formatDate(e.createdAt, locale)}</span>
      </div>
      <p className="mt-1.5 text-xs text-muted">“{e.hypothesis}”</p>
      <p className="mt-1 flex flex-wrap gap-1.5">
        {e.skuIds.map((sku) => (
          <Link key={sku} href={`/catalog/${sku}`} className="tabular rounded-full border border-line px-2 py-0.5 text-xs text-brand hover:underline">{sku}</Link>
        ))}
      </p>
      {res && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ResultRow label={t('experiments.result.revenue')} expected={res.expectedRevenue} observed={res.observedRevenue} locale={locale} />
            <ResultRow label={t('experiments.result.margin')} expected={res.expectedMargin} observed={res.observedMargin} locale={locale} />
          </div>
          <p className="mt-2 text-xs text-faint">
            {t('experiments.result.framing', { n: res.n, days: Math.round(res.daysRunning * 10) / 10 })}
          </p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <RoleGate action="experiment.manage">
          {e.status === 'draft' && <Button size="sm" onClick={onStart}>{t('experiments.action.start')}</Button>}
          {e.status === 'running' && <Button size="sm" onClick={onConclude}>{t('experiments.action.conclude')}</Button>}
          {(e.status === 'draft' || e.status === 'running') && (
            <Button size="sm" variant="secondary" onClick={onCancel}>{t('experiments.action.cancel')}</Button>
          )}
        </RoleGate>
      </div>
    </li>
  );
}

function ResultRow({ label, expected, observed, locale }: { label: string; expected: number; observed: number; locale: 'en' | 'id' }) {
  const delta = expected !== 0 ? observed / expected - 1 : 0;
  return (
    <div className="rounded-input bg-subtle px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm">
        <span className="text-muted">{formatPrice(Math.round(expected), locale)}</span>
        {' → '}
        <span className="font-semibold">{formatPrice(Math.round(observed), locale)}</span>
        {' '}<DeltaBadge value={delta} />
      </p>
    </div>
  );
}

function BuilderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [skus, setSkus] = useState('');
  const [delta, setDelta] = useState('-5');
  const [err, setErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const skuIds = skus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const r = saveExperiment(user, { name, hypothesis, skuIds, deltaPct: Number(delta) }, null);
    if (r.ok) { toast(t('experiments.toast.saved')); setName(''); setHypothesis(''); setSkus(''); setDelta('-5'); setErr(''); onClose(); }
    else setErr(t(`experiments.err.${r.error}`));
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('experiments.builder.title')}>
      <form noValidate className="flex flex-col gap-3" onSubmit={submit}>
        <Field label={t('experiments.builder.name')}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t('experiments.builder.hypothesis')}>
          {(p) => <Input {...p} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} />}
        </Field>
        <Field label={t('experiments.builder.skus')}>
          {(p) => (
            <>
              <Input {...p} value={skus} onChange={(e) => setSkus(e.target.value)} placeholder="SKU-1001, SKU-1002" aria-describedby={`${p.id}-hint`} />
              <p id={`${p.id}-hint`} className="mt-1 text-xs text-faint">{t('experiments.builder.skusHint')}</p>
            </>
          )}
        </Field>
        <Field label={t('experiments.builder.delta')}>
          {(p) => <Input {...p} type="number" step="0.5" className="tabular w-28" value={delta} onChange={(e) => setDelta(e.target.value)} />}
        </Field>
        {err && <p role="alert" className="text-xs text-critical">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.action.cancel')}</Button>
          <Button type="submit">{t('experiments.builder.save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
