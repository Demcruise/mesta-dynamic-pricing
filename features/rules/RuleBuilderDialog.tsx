'use client';

import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, inputCls } from '@/components/ui/field';
import { saveRule } from '@/lib/actions/rule';
import { CATEGORIES } from '@/lib/categories';
import { formatPrice, type Locale } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ConditionOp, Rule, RuleCondition, RuleConditionField, RuleFormulaKind, RuleStatus } from '@/lib/ontology';
import { useSkuList, useStrategies } from '@/lib/queries';
import { evaluateProduct, OPS } from '@/lib/rules';
import { REGIONS } from '@/lib/scope';
import { useRuleStore, useSessionStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { describeFormula } from './rule-format';

const FIELDS: RuleConditionField[] = ['competitor_gap_pct', 'margin_pct', 'stock_units', 'days_since_change'];
const KINDS: RuleFormulaKind[] = ['match_competitor', 'delta_percent', 'min_margin_pct'];
const STATUSES: RuleStatus[] = ['draft', 'active', 'paused'];

const chipCls = (on: boolean) => cn(
  'rounded-full border px-2.5 py-1 text-xs transition-colors duration-fast',
  on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:bg-subtle',
);

function ToggleChips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={selected.includes(o)} className={chipCls(selected.includes(o))} onClick={() => onToggle(o)}>{o}</button>
      ))}
    </div>
  );
}

function PreviewList({ draft, locale }: { draft: Rule; locale: Locale }) {
  const { t } = useTranslation();
  const products = useSkuList().data;
  const strategies = useStrategies().data;
  const preview = useMemo(() => {
    const asActive = { ...draft, status: 'active' as const };
    const now = Date.now();
    const hits = products.filter((p) => {
      const r = evaluateProduct(p, [asActive], strategies, products, now);
      return r.winner !== null && r.price !== p.price;
    }).map((p) => ({ sku: p.sku, from: p.price, to: evaluateProduct(p, [asActive], strategies, products, now).price ?? p.price }));
    return hits;
  }, [draft, products, strategies]);
  return (
    <div className="rounded-card border border-line bg-subtle p-3">
      <p className="text-xs font-medium text-muted">{t('rules.builder.previewTitle')} — {t('rules.table.matches', { n: preview.length, total: products.length })}</p>
      {preview.length === 0 ? (
        <p className="mt-1.5 text-xs text-faint">{t('rules.builder.previewEmpty')}</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5 text-xs">
          {preview.slice(0, 5).map((h) => (
            <li key={h.sku} className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-fg">{h.sku}</span>
              <span className="text-muted">{formatPrice(h.from, locale)} → <b className="text-fg">{formatPrice(h.to, locale)}</b></span>
            </li>
          ))}
          {preview.length > 5 && <li className="text-faint">+{preview.length - 5}…</li>}
        </ul>
      )}
    </div>
  );
}

export function RuleBuilderDialog({ rule, open, onClose }: { rule: Rule | null; open: boolean; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [draft, setDraft] = useState<Rule | null>(null);
  const [err, setErr] = useState('');
  // Set when the stored rule changed since the dialog opened — offers reload/overwrite.
  const [conflict, setConflict] = useState(false);
  // Two-step close: first attempt with unsaved edits asks for confirmation.
  const [discardConfirm, setDiscardConfirm] = useState(false);

  // Sync incoming rule → local draft whenever the dialog opens for a different rule.
  const current = open ? (draft ?? (rule ? { ...rule } : {
    id: `RULE-${Date.now().toString(36).toUpperCase()}`,
    name: '', status: 'draft' as RuleStatus, priority: 50, ownerId: user.userId, updatedAt: '',
    scope: { categories: [], regions: [], skus: [] },
    when: [{ field: 'competitor_gap_pct' as RuleConditionField, op: 'gt' as ConditionOp, value: 5 }],
    then: { kind: 'delta_percent' as RuleFormulaKind, value: -5 },
  })) : null;

  if (!open || !current) return null;
  const set = (patch: Partial<Rule>) => setDraft({ ...current, ...patch });
  const setWhen = (i: number, patch: Partial<RuleCondition>) =>
    set({ when: current.when.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const toggle = (list: 'categories' | 'regions', v: string) =>
    set({ scope: { ...current.scope, [list]: current.scope[list].includes(v) ? current.scope[list].filter((x) => x !== v) : [...current.scope[list], v] } });

  const save = (force = false) => {
    if (!current.name.trim() || current.when.length === 0) { setErr(t('rules.builder.validate')); return; }
    // current.updatedAt is the snapshot captured at open — a mismatch means a concurrent edit.
    const r = saveRule(user, current, { expectedUpdatedAt: force ? undefined : current.updatedAt });
    if (!r.ok && r.error === 'conflict') { setConflict(true); return; }
    if (r.ok) { toast(t('rules.builder.validated')); setDraft(null); setConflict(false); onClose(); }
    else setErr(t(`rules.err.${r.error}`));
  };

  const reload = () => {
    const latest = useRuleStore.getState().items.find((x) => x.id === current.id);
    if (latest) setDraft({ ...latest });
    setConflict(false);
  };

  // draft is only set after an edit — non-null means there are unsaved changes.
  const tryClose = () => {
    if (draft && !discardConfirm) { setDiscardConfirm(true); return; }
    setDraft(null); setConflict(false); setDiscardConfirm(false); onClose();
  };

  return (
    <Dialog open={open} onClose={tryClose} title={rule ? t('rules.builder.edit') : t('rules.builder.new')} className="max-w-2xl">
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pe-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('rules.builder.nameLabel')}>
            {(p) => <Input {...p} value={current.name} onChange={(e) => set({ name: e.target.value })} />}
          </Field>
          <Field label={t('rules.builder.priorityLabel')}>
            {(p) => <Input {...p} type="number" value={current.priority} onChange={(e) => set({ priority: Number(e.target.value) })} />}
          </Field>
          <Field label={t('rules.builder.statusLabel')}>
            {(p) => (
              <select {...p} className={inputCls} value={current.status} onChange={(e) => set({ status: e.target.value as RuleStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`rules.builder.status.${s}`)}</option>)}
              </select>
            )}
          </Field>
        </div>

        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-xs font-medium text-muted">{t('rules.table.scope')}</legend>
          <p className="mb-2 text-xs text-faint">{t('rules.scope.allWhenEmpty')}</p>
          <div className="flex flex-col gap-2.5">
            <div>
              <p className="mb-1 text-xs text-muted">{t('rules.scope.categoriesLabel')}</p>
              <ToggleChips options={CATEGORIES} selected={current.scope.categories} onToggle={(v) => toggle('categories', v)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">{t('rules.scope.regionsLabel')}</p>
              <ToggleChips options={REGIONS} selected={current.scope.regions} onToggle={(v) => toggle('regions', v)} />
            </div>
            <Field label={t('rules.scope.skusLabel')}>
              {(p) => (
                <Input {...p} value={current.scope.skus.join(', ')}
                  onChange={(e) => set({ scope: { ...current.scope, skus: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-xs font-medium text-muted">{t('rules.when.title')}</legend>
          <p className="mb-2 text-xs text-faint">{t('rules.when.hint')}</p>
          <div className="flex flex-col gap-2">
            {current.when.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-1.5">
                <select aria-label={t('rules.when.field')} className={inputCls} value={c.field}
                  onChange={(e) => setWhen(i, { field: e.target.value as RuleConditionField })}>
                  {FIELDS.map((f) => <option key={f} value={f}>{t(`rules.fields.${f}`)}</option>)}
                </select>
                <select aria-label={t('rules.when.op')} className={`${inputCls} w-16`} value={c.op}
                  onChange={(e) => setWhen(i, { op: e.target.value as ConditionOp })}>
                  {OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
                </select>
                <Input aria-label={t('rules.when.value')} type="number" className="w-24" value={c.value}
                  onChange={(e) => setWhen(i, { value: Number(e.target.value) })} />
                <Button variant="ghost" size="icon" aria-label={t('common.action.remove')} onClick={() => set({ when: current.when.filter((_, j) => j !== i) })}>
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" className="self-start" onClick={() => set({ when: [...current.when, { field: 'margin_pct', op: 'lt', value: 20 }] })}>
              <Plus className="size-3.5" aria-hidden /> {t('rules.when.add')}
            </Button>
          </div>
        </fieldset>

        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-xs font-medium text-muted">{t('rules.then.title')}</legend>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('rules.then.formula')}>
              {(p) => (
                <select {...p} className={`${inputCls} w-56`} value={current.then.kind}
                  onChange={(e) => set({ then: { ...current.then, kind: e.target.value as RuleFormulaKind } })}>
                  {KINDS.map((k) => <option key={k} value={k}>{t(`rules.kinds.${k}`)}</option>)}
                </select>
              )}
            </Field>
            <Input aria-label={t('rules.when.value')} type="number" className="w-24" value={current.then.value}
              onChange={(e) => set({ then: { ...current.then, value: Number(e.target.value) } })} />
          </div>
          <p className="mt-2 text-xs text-muted">{t('rules.then.preview', { v: describeFormula(current.then, t) })}</p>
        </fieldset>

        <PreviewList draft={current} locale={locale} />

        {conflict && (
          <div role="alert" className="rounded-card border border-warn bg-warn-soft p-3 text-xs">
            <p className="font-medium text-warn">{t('rules.editConflict.title')}</p>
            <p className="mt-0.5 text-muted">{t('rules.editConflict.desc')}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={reload}>{t('rules.editConflict.reload')}</Button>
              <Button size="sm" variant="secondary" onClick={() => { setConflict(false); save(true); }}>{t('rules.editConflict.overwrite')}</Button>
            </div>
          </div>
        )}
        {discardConfirm && (
          <div role="alert" className="rounded-card border border-warn bg-warn-soft p-3 text-xs">
            <p className="font-medium text-warn">{t('rules.discard.title')}</p>
            <p className="mt-0.5 text-muted">{t('rules.discard.desc')}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDiscardConfirm(false)}>{t('rules.discard.keep')}</Button>
              <Button size="sm" variant="secondary" onClick={() => { setDraft(null); setDiscardConfirm(false); setConflict(false); onClose(); }}>{t('rules.discard.confirm')}</Button>
            </div>
          </div>
        )}
        {err && <p role="alert" className="text-xs text-critical">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={tryClose}>{t('common.action.cancel')}</Button>
          <Button onClick={() => save()}>{t('rules.builder.save')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
