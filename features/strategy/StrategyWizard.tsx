'use client';

import { Check, TriangleAlert } from 'lucide-react';
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
import type { RuleConditionField, StrategyObjective } from '@/lib/ontology';
import { useRules, useSkuList, useStrategies, useStrategyHistory } from '@/lib/queries';
import {
  emptyDraft, hasBlocker, overlapSkus, toDraft, validateDraft, type Issue, type IssueCode, type StrategyDraft,
} from '@/lib/strategy-rules';
import { GuardrailPreview } from './GuardrailPreview';
import { useCatalogSelectionStore, useSessionStore, useStrategyDraftStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

const OBJECTIVES: StrategyObjective[] = ['maximize_margin', 'maximize_revenue', 'match_competitor', 'clear_inventory'];
const STEPS = ['objective', 'scope', 'guardrail', 'rules', 'review'] as const;
const SIGNAL_FIELDS: RuleConditionField[] = ['competitor_gap_pct', 'margin_pct', 'stock_units', 'days_since_change'];
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
      <Wizard key={existing?.updatedAt ?? 'new'} strategyId={strategyId} initial={existing ? toDraft(existing) : null}
        status={existing?.status ?? null} expectedUpdatedAt={existing?.updatedAt ?? null} />
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

function Wizard({ strategyId, initial, status, expectedUpdatedAt }: {
  strategyId: string | null; initial: StrategyDraft | null; status: string | null; expectedUpdatedAt: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const can = useCan();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const strategies = useStrategies().data;
  const products = useSkuList().data;
  const rules = useRules().data;
  const selection = useCatalogSelectionStore((s) => s.skuIds);
  const key = strategyId ?? 'new';
  const stored = useStrategyDraftStore.getState().drafts[key];

  const [draft, setDraft] = useState<StrategyDraft>(() => stored?.draft ?? initial ?? emptyDraft(selection));
  const [step, setStep] = useState(stored?.step ?? 0);
  const [restored] = useState(!!stored);
  const [skuInput, setSkuInput] = useState('');
  const [skuErr, setSkuErr] = useState(false);
  // Set when the user jumps from the review step to fix one section: offers a one-click return.
  const [fromReview, setFromReview] = useState(false);
  // Set when the stored strategy changed since the wizard opened — reload or overwrite.
  const [conflict, setConflict] = useState(false);
  const [conflictMode, setConflictMode] = useState<'draft' | 'submit' | 'activate'>('draft');

  // Autosave to the local draft store on every change.
  useEffect(() => { useStrategyDraftStore.getState().setDraft(key, { draft, step }); }, [key, draft, step]);

  const issues = useMemo(() => validateDraft(draft, strategies, products, strategyId), [draft, strategies, products, strategyId]);
  const overlaps = useMemo(() => overlapSkus(draft, strategies, products, strategyId), [draft, strategies, products, strategyId]);
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

  const finish = (mode: 'draft' | 'submit' | 'activate', force = false) => {
    if (mode !== 'draft' && hasBlocker(issues)) { toast(t('strategy.err.invalid')); return; }
    const saved = saveStrategy(user, draft, strategyId, { expectedUpdatedAt: force ? undefined : (expectedUpdatedAt ?? undefined) });
    if (!saved.ok && saved.error === 'conflict') { setConflict(true); setConflictMode(mode); return; }
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
  const guardrailText = t('strategy.list.guardrail', {
    change: g.maxChangePercent,
    threshold: g.autoApproveThreshold,
    map: g.mapEnforced ? t('strategy.list.map') : '',
  });
  const rulesText = t('strategy.rules.summary', {
    rules: draft.ruleIds.length,
    signals: draft.signals.length === 0 ? t('strategy.rules.allSignals') : draft.signals.length,
  });
  const stepSummaries = [
    draft.name || '—',
    scopeText,
    guardrailText,
    rulesText,
    '—',
  ];
  const go = (i: number, review = false) => { setStep(i); setFromReview(review); };
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
      {conflict && (
        <div role="alert" className="mb-3 rounded-card border border-warn bg-warn-soft p-3 text-xs">
          <p className="font-medium text-warn">{t('strategy.conflict.title')}</p>
          <p className="mt-0.5 text-muted">{t('strategy.conflict.desc')}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => {
              const latest = strategies.find((s) => s.id === strategyId);
              if (latest) setDraft(toDraft(latest));
              setConflict(false);
            }}>{t('strategy.conflict.reload')}</Button>
            <Button size="sm" variant="secondary" onClick={() => { setConflict(false); finish(conflictMode, true); }}>
              {t('strategy.conflict.overwrite')}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[17rem_1fr]">
        <nav aria-label={t('strategy.step.progress', { n: step + 1, total: STEPS.length })} className="min-w-0 rounded-card border border-line bg-surface p-3 shadow-e1 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
            {STEPS.map((s, i) => {
              const blocked = stepBlocked(i);
              const done = i < step && !blocked;
              return (
                <li key={s} className="lg:border-l lg:border-line lg:first:border-transparent" aria-current={i === step ? 'step' : undefined}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-input px-3 py-2 text-left transition-colors duration-fast',
                      i === step ? 'bg-brand-soft text-brand' : 'text-fg hover:bg-subtle',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                        i === step ? 'border-brand bg-brand text-brand-fg' : done ? 'border-up bg-up-soft text-up' : blocked ? 'border-critical bg-critical-soft text-critical' : 'border-line text-muted',
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : blocked ? <TriangleAlert className="size-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t(`strategy.step.${s}`)}</span>
                      <span className={cn('block truncate text-xs', i === step ? 'text-brand' : 'text-faint')}>{stepSummaries[i]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="min-w-0 rounded-card border border-line bg-surface p-5 shadow-e1">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field label={t('strategy.field.name')} error={stepBlocked(0) && draft.name === '' ? issueText({ severity: 'blocker', code: 'name_required' }) : undefined}>
              {(p) => <Input {...p} value={draft.name} onChange={(e) => set({ name: e.target.value })} />}
            </Field>
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-muted">{t('strategy.objective.label')}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            {overlaps.length > 0 && (
              <div className="rounded-input border border-warn/40 bg-warn-soft p-3 text-xs">
                <p className="mb-1.5 font-medium text-warn">{t('strategy.overlap.title')}</p>
                <ul className="flex flex-col gap-1.5">
                  {overlaps.map((o) => (
                    <li key={o.strategy.id}>
                      <span className="font-medium">{o.strategy.name}:</span>{' '}
                      <span className="tabular">
                        {o.skus.slice(0, 8).join(', ')}
                        {o.skus.length > 8 && ` +${o.skus.length - 8}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <GuardrailPreview draft={draft} products={products} />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-muted">{t('strategy.rules.signalsLabel')}</legend>
              <p className="mb-2 text-xs text-faint">{t('strategy.rules.signalsHint')}</p>
              <div className="flex flex-wrap gap-1.5">
                {SIGNAL_FIELDS.map((f) => (
                  <label key={f} className="flex items-center gap-1.5 rounded-input border border-line px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.signals.includes(f)}
                      onChange={(e) => set({ signals: e.target.checked ? [...draft.signals, f] : draft.signals.filter((x) => x !== f) })}
                    />
                    {t(`rules.when.field.${f}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-muted">{t('strategy.rules.rulesLabel')}</legend>
              <p className="mb-2 text-xs text-faint">{t('strategy.rules.rulesHint')}</p>
              {rules.length === 0 ? (
                <p className="text-sm text-muted">{t('strategy.rules.noRules')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {rules.map((r) => (
                    <li key={r.id}>
                      <label className="flex items-center gap-2 rounded-input border border-line px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.ruleIds.includes(r.id)}
                          onChange={(e) => set({ ruleIds: e.target.checked ? [...draft.ruleIds, r.id] : draft.ruleIds.filter((x) => x !== r.id) })}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{r.name}</span>
                          <span className="ml-1.5 text-xs text-faint">{r.id} · {t(`common.status.${r.status}`)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            <p className="rounded-input bg-info-soft px-3 py-2 text-xs text-info">{t('strategy.rules.effect')}</p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">{t('strategy.review.title')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                { i: 0, title: t('strategy.step.objective'), body: <><strong>{draft.name || '—'}</strong><br />{t(`strategy.objective.${draft.objective}`)}</> },
                { i: 1, title: t('strategy.step.scope'), body: scopeText },
                { i: 2, title: t('strategy.step.guardrail'), body: <>{guardrailText}{g.minPrice !== null && g.maxPrice !== null && <><br /><PriceValue value={g.minPrice} /> – <PriceValue value={g.maxPrice} /></>}</> },
                { i: 3, title: t('strategy.step.rules'), body: rulesText },
              ]).map((sec) => (
                <section key={sec.i} className="rounded-input border border-line p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{sec.title}</h3>
                    <Button size="sm" variant="ghost" onClick={() => go(sec.i, true)}>{t('strategy.action.edit')}</Button>
                  </div>
                  <p className="text-sm">{sec.body}</p>
                </section>
              ))}
            </div>
            <p className="text-sm text-muted">{summary}</p>
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
          <Button variant="secondary" disabled={step === 0} onClick={() => go(step - 1)}>{t('strategy.action.back')}</Button>
          {fromReview && step < STEPS.length - 1 ? (
            <Button disabled={stepBlocked(step)} onClick={() => go(STEPS.length - 1)}>{t('strategy.action.backToReview')}</Button>
          ) : step < STEPS.length - 1 ? (
            <Button disabled={stepBlocked(step)} onClick={() => go(step + 1)}>{t('strategy.action.next')}</Button>
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
      </div>
    </>
  );
}
