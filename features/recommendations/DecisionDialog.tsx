'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { stageDecision } from '@/lib/actions/recommendation';
import { checkPrice } from '@/lib/guardrails';
import { useTranslation } from '@/lib/i18n';
import type { Product, Recommendation } from '@/lib/ontology';
import { useSessionStore, useStrategyStore, useToastStore } from '@/lib/stores';

export type DialogMode = 'reject' | 'adjust' | null;

export function DecisionDialog({ rec, product, mode, onClose }: {
  rec: Recommendation; product: Product | undefined; mode: DialogMode; onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={mode !== null} onClose={onClose} title={t(mode === 'adjust' ? 'recommendations.dialog.adjustTitle' : 'recommendations.dialog.rejectTitle')}>
      {mode && <Form key={mode} rec={rec} product={product} mode={mode} onClose={onClose} />}
    </Dialog>
  );
}

function Form({ rec, product, mode, onClose }: { rec: Recommendation; product: Product | undefined; mode: 'reject' | 'adjust'; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(String(rec.proposedPrice));
  const [submitted, setSubmitted] = useState(false);

  const strategy = rec.strategyId ? useStrategyStore.getState().items.find((s) => s.id === rec.strategyId) ?? null : null;
  const priceCheck = mode === 'adjust' && product ? checkPrice(product, strategy, Number(price)) : 'ok';
  const noteErr = note.trim() ? undefined : t('recommendations.err.note_required');
  const priceErr = priceCheck === 'ok' ? undefined : t(`recommendations.err.${priceCheck}`);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (noteErr || priceErr) return;
    const r = stageDecision(user, rec.id, mode === 'adjust' ? 'adjusted' : 'rejected', { note, proposedPrice: Number(price) });
    if (!r.ok) { toast(t(`recommendations.err.${r.error}`)); return; }
    onClose();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <p className="tabular text-sm text-muted">{rec.id} · {rec.sku}</p>
      {mode === 'adjust' && (
        <Field label={t('recommendations.dialog.newPrice')} error={submitted ? priceErr : undefined}>
          {(p) => <Input {...p} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />}
        </Field>
      )}
      <Field label={t('recommendations.dialog.note')} error={submitted ? noteErr : undefined}>
        {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('recommendations.action.cancel')}</Button>
        <Button type="submit" variant={mode === 'reject' ? 'destructive' : 'primary'}>{t('recommendations.action.confirm')}</Button>
      </div>
    </form>
  );
}
