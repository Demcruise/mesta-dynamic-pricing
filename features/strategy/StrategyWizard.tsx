'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, LoadingRows, PageHeader } from '@/components/ds/states';
import { PriceValue } from '@/components/ds/PriceValue';
import { Button } from '@/components/ui/button';
import { Field, Input, inputCls } from '@/components/ui/field';
import { activateStrategy, rollbackStrategy, saveStrategy, submitStrategy } from '@/lib/actions/strategy';
import { CATEGORIES } from '@/lib/categories';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { StrategyObjective } from '@/lib/ontology';
import { useSkuList, useStrategies, useStrategyHistory } from '@/lib/queries';
import {
  emptyDraft, hasBlocker, toDraft, validateDraft, type Issue, type IssueCode, type StrategyDraft,
} from '@/lib/strategy-rules';
import { useCatalogSelectionStore, useSessionStore, useStrategyDraftStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

const OBJECTIVES: StrategyObjective[] = ['maximize_margin', 'maximize_revenue', 'match_competitor', 'clear_inventory'];
const STEPS = ['objective', 'scope', 'guardrail', 'review'] as const;
const STEP_OF: Record<IssueCode, number> = {
  name_required: 0, scope_required: 1, min_ge_max: 2, change_range: 2, threshold_range: 2, overlap: 1,
};

export function StrategyWizard({ strategyId }: { strategyId: string | null }) {
  const strategies = useStrategies();
  const skus = useSkuList();
  if (strategies.isLoading || skus.isLoading) return <LoadingRows rows={4} />;
  const existing = strategyId ? strategies.data.find((s) => s.id === strategyId) : undefined;
  if (strategyId && !existing) return <NotFound />;
  return (
    <>
      <Wizard key={existing?.updatedAt ?? 'new'} strategyId={strategyId} initial={existing ? toDraft(existing) : null} status={existing?.status ?? null} />
      {strategyId && <History strategyId={strategyId} />}
    </>
  );
}

function History({ strategyId }: { strategyId: string }) {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const versions = useStrategyHistory(strategyId).data;
  return (
    <section className="mt-6 max-w-2xl rounded-card border border-line bg-surface p-5 shadow-e1">
      <h2 className="mb-2 text-sm font-semibold">{t('strategy.history.history')}</h2>
      {versions.length === 0 ? <p className="text-sm text-muted">{t('strategy.history.noHistory')}</p> : (
        <ol className="divide-y divide-line text-sm">
          {versions.map((v, i) => (
            <li key={`${v.updatedAt}-${i}`} className="flex items-center justify-between gap-2 py-2">
              <span>{t('strategy.history.version', { n: i + 1 })} · {v.name} · <span className="text-muted">{formatDate(v.updatedAt, locale)}</span></span>
              {can('strategy.activate') && (
                <Button size="sm" variant="secondary" onClick={() => {
                  const r = rollbackStrategy(user, strategyId, i);
                  toast(r.ok ? t('strategy.history.rolledBack', { n: i + 1 }) : t(`strategy.err.${r.error}`));
                  if (r.ok) useStrategyDraftStore.getState().clearDraft(strategyId);
                }}>{t('strategy.history.rollback')}</Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return <EmptyState title={t('strategy.notFound')} />;
}

function Wizard({ strategyId, initial, status }: { strategyId: string | null; initial: StrategyDraft | null; status: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const can = useCan();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const strategies = useStrategies().data;
  const products = useSkuList().data;
  const selection = useCatalogSelectionStore((s) => s.skuIds);
  const key = strategyId ?? 'new';
  const stored = useStrategyDraftStore.getState().drafts[key];

  const [draft, setDraft] = useState<StrategyDraft>(() => stored?.draft ?? initial ?? emptyDraft(selection));
  const [step, setStep] = useState(stored?.step ?? 0);
  const [restored] = useState(!!stored);
  const [skuInput, setSkuInput] = useState('');
  const [skuErr, setSkuErr] = useState(false);

  // Autosave to the local draft store on every change.
  useEffect(() => { useStrategyDraftStore.getState().setDraft(key, { draft, step }); }, [key, draft, step]);

  const issues = useMemo(() => validateDraft(draft, strategies, products, strategyId), [draft, strategies, products, strategyId]);
  const stepBlocked = (s: number) => issues.some((i) => i.severity === 'blocker' && STEP_OF[i.code] === s);
  const set = (patch: Partial<StrategyDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setG = (patch: Partial<StrategyDraft['guardrail']>) => setDraft((d) => ({ ...d, guardrail: { ...d.guardrail, ...patch } }));
  const numOrNull = (v: string) => (v === '' ? null : Number(v));

  const addSku = () => {
    const v = skuInput.trim().toUpperCase();
    if (!v) return;
    if (!products.some((p) => p.sku === v)) { setSkuErr(true); return; }
    setSkuErr(false);
    set({ skuIds: [...new Set([...draft.skuIds, v])] });
    setSkuInput('');
  };

  const issueText = (i: Issue) => t(`strategy.issue.${i.code}`, { detail: i.detail ?? '' });

  const finish = (mode: 'draft' | 'submit' | 'activate') => {
    if (mode !== 'draft' && hasBlocker(issues)) { toast(t('strategy.err.invalid')); return; }
    const saved = saveStrategy(user, draft, strategyId);
    if (!saved.ok) { toast(t(`strategy.err.${saved.error}`)); return; }
    const id = saved.strategy.id;
    if (mode === 'submit' || mode === 'activate') {
      if (saved.strategy.status === 'draft') {
        const r = submitStrategy(user, id);
        if (!r.ok) { toast(t(`strategy.err.${r.error}`)); return; }
      }
    }
    if (mode === 'activate') {
      const r = activateStrategy(user, id);
      if (!r.ok) { toast(t(`strategy.err.${r.error}`)); return; }
    }
    useStrategyDraftStore.getState().clearDraft(key);
    router.push('/strategy');
  };

  const g = draft.guardrail;
  const scopeText = t('strategy.review.scopeText', { skus: draft.skuIds.length, cats: draft.categories.length });
  const summary = t('strategy.review.plain', {
    objective: t(`strategy.objective.${draft.objective}`).toLowerCase(),
    scope: scopeText,
    change: g.maxChangePercent,
    threshold: g.autoApproveThreshold,
    bounds: g.minPrice !== null && g.maxPrice !== null ? t('strategy.review.bounds', { min: g.minPrice, max: g.maxPrice }) : '',
    map: g.mapEnforced ? t('strategy.review.map') : '',
  });

  return (
    <>
      <PageHeader title={strategyId ? t('strategy.edit') : t('strategy.new')} subtitle={t('strategy.step.progress', { n: step + 1, total: STEPS.length })} />
      {restored && <p role="status" className="mb-3 rounded-input bg-info-soft px-3 py-2 text-sm text-info">{t('strategy.draftRestored')}</p>}

      <ol className="mb-4 flex flex-wrap gap-2" aria-label={t('strategy.step.progress', { n: step + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn('rounded-full border px-3 py-1 text-sm', i === step ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted')}
            >
              {i + 1}. {t(`strategy.step.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      <section className="max-w-2xl rounded-card border border-line bg-surface p-5 shadow-e1">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field label={t('strategy.field.name')} error={stepBlocked(0) && draft.name === '' ? issueText({ severity: 'blocker', code: 'name_required' }) : undefined}>
              {(p) => <Input {...p} value={draft.name} onChange={(e) => set({ name: e.target.value })} />}
            </Field>
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-muted">{t('strategy.objective.label')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {OBJECTIVES.map((o) => (
                  <label key={o} className={cn('flex cursor-pointer items-center gap-2 rounded-input border p-3 text-sm', draft.objective === o ? 'border-brand bg-brand-soft' : 'border-line')}>
                    <input type="radio" name="objective" checked={draft.objective === o} onChange={() => set({ objective: o })} />
                    {t(`strategy.objective.${o}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-muted">{t('strategy.field.categories')}</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 rounded-input border border-line px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.categories.includes(c)}
                      onChange={(e) => set({ categories: e.target.checked ? [...draft.categories, c] : draft.categories.filter((x) => x !== c) })}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t('strategy.field.skus')}</p>
              <div className="mb-2 flex gap-2">
                <Input aria-label={t('strategy.field.addSku')} placeholder={t('strategy.field.addSkuHint')} value={skuInput}
                  aria-invalid={skuErr} onChange={(e) => { setSkuInput(e.target.value); setSkuErr(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSku(); } }} />
                <Button variant="secondary" onClick={addSku}>{t('strategy.field.addSku')}</Button>
              </div>
              {skuErr && <p role="alert" className="mb-2 text-xs text-critical">{t('catalog.detail.notFound')}</p>}
              {draft.skuIds.length === 0 ? (
                <p className="text-sm text-muted">{t('strategy.field.noSkus')}</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {draft.skuIds.map((s) => (
                    <li key={s} className="tabular flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs">
                      {s}
                      <button type="button" aria-label={t('strategy.field.removeSku', { sku: s })} onClick={() => set({ skuIds: draft.skuIds.filter((x) => x !== s) })}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {issues.filter((i) => STEP_OF[i.code] === 1).map((i) => (
              <p key={i.code} role="alert" className={cn('text-sm', i.severity === 'blocker' ? 'text-critical' : 'text-warn')}>{issueText(i)}</p>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('strategy.field.minPrice')}>
              {(p) => <Input {...p} type="number" value={g.minPrice ?? ''} onChange={(e) => setG({ minPrice: numOrNull(e.target.value) })} />}
            </Field>
            <Field label={t('strategy.field.maxPrice')} error={issues.some((i) => i.code === 'min_ge_max') ? issueText({ severity: 'blocker', code: 'min_ge_max' }) : undefined}>
              {(p) => <Input {...p} type="number" value={g.maxPrice ?? ''} onChange={(e) => setG({ maxPrice: numOrNull(e.target.value) })} />}
            </Field>
            <Field label={t('strategy.field.maxChange')} error={issues.some((i) => i.code === 'change_range') ? issueText({ severity: 'blocker', code: 'change_range' }) : undefined}>
              {(p) => <Input {...p} type="number" value={g.maxChangePercent} onChange={(e) => setG({ maxChangePercent: Number(e.target.value) })} />}
            </Field>
            <Field label={t('strategy.field.threshold')} error={issues.some((i) => i.code === 'threshold_range') ? issueText({ severity: 'blocker', code: 'threshold_range' }) : undefined}>
              {(p) => <Input {...p} type="number" value={g.autoApproveThreshold} onChange={(e) => setG({ autoApproveThreshold: Number(e.target.value) })} />}
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={g.mapEnforced} onChange={(e) => setG({ mapEnforced: e.target.checked })} />
              {t('strategy.field.map')}
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="mb-1 text-sm font-semibold">{t('strategy.review.title')}</h2>
              <p className="text-sm"><strong>{draft.name || '—'}</strong></p>
              <p className="mt-2 text-sm text-muted">{summary}</p>
              {g.minPrice !== null && g.maxPrice !== null && (
                <p className="mt-1 text-xs text-faint"><PriceValue value={g.minPrice} /> – <PriceValue value={g.maxPrice} /></p>
              )}
            </div>
            {issues.length > 0 && (
              <ul className="flex flex-col gap-1" aria-label={t('strategy.issue.warning')}>
                {issues.map((i) => (
                  <li key={i.code} role="alert" className={cn('rounded-input px-3 py-2 text-sm', i.severity === 'blocker' ? 'bg-critical-soft text-critical' : 'bg-warn-soft text-warn')}>
                    <strong>{i.severity === 'blocker' ? t('strategy.issue.blocker') : t('strategy.issue.warning')}:</strong> {issueText(i)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>{t('strategy.action.back')}</Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={stepBlocked(step)} onClick={() => setStep(step + 1)}>{t('strategy.action.next')}</Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {can('strategy.create') && <Button variant="secondary" onClick={() => finish('draft')}>{t('strategy.action.saveDraft')}</Button>}
              {can('strategy.create') && status !== 'active' && !can('strategy.activate') && (
                <Button disabled={hasBlocker(issues)} onClick={() => finish('submit')}>{t('strategy.action.submit')}</Button>
              )}
              {can('strategy.activate') && status !== 'active' && (
                <Button disabled={hasBlocker(issues)} onClick={() => finish('activate')}>{t('strategy.action.activate')}</Button>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
