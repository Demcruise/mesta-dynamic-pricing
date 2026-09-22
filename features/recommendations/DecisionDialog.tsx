'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { ConsequencePreview } from '@/components/ds/trust';
import { escalateRecommendation, requestChanges, stageDecision } from '@/lib/actions/recommendation';
import { checkPrice } from '@/lib/guardrails';
import { formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product, Recommendation } from '@/lib/ontology';
import { useSessionStore, useStrategyStore, useToastStore } from '@/lib/stores';

export type DialogMode = 'reject' | 'adjust' | 'request' | 'escalate' | null;

const TITLES: Record<NonNullable<DialogMode>, string> = {
  adjust: 'recommendations.dialog.adjustTitle',
  reject: 'recommendations.dialog.rejectTitle',
  request: 'recommendations.dialog.requestTitle',
  escalate: 'recommendations.dialog.escalateTitle',
};

export function DecisionDialog({ rec, product, mode, onClose }: {
  rec: Recommendation; product: Product | undefined; mode: DialogMode; onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={mode !== null} onClose={onClose} title={t(mode ? TITLES[mode] : '')}>
      {mode && <Form key={mode} rec={rec} product={product} mode={mode} onClose={onClose} />}
    </Dialog>
  );
}

function Form({ rec, product, mode, onClose }: { rec: Recommendation; product: Product | undefined; mode: NonNullable<DialogMode>; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(String(rec.proposedPrice));
  const [submitted, setSubmitted] = useState(false);

  const strategy = rec.strategyId ? useStrategyStore.getState().items.find((s) => s.id === rec.strategyId) ?? null : null;
  const priceNum = Number(price);
  const priceCheck = mode === 'adjust' && product ? checkPrice(product, strategy, priceNum) : 'ok';
  const deltaPct = mode === 'adjust' && Number.isFinite(priceNum) && rec.currentPrice > 0
    ? ((priceNum - rec.currentPrice) / rec.currentPrice) * 100
    : null;
  const noteErr = note.trim() ? undefined : t('recommendations.err.note_required');
  const priceErr = priceCheck === 'ok' ? undefined : t(`recommendations.err.${priceCheck}`);
  // Escalation note is optional context; request/reject/adjust all require one.
  const noteRequired = mode !== 'escalate';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if ((noteRequired && noteErr) || priceErr) return;
    const r = mode === 'request' ? requestChanges(user, rec.id, note)
      : mode === 'escalate' ? escalateRecommendation(user, rec.id, note)
      : stageDecision(user, rec.id, mode === 'adjust' ? 'adjusted' : 'rejected', { note, proposedPrice: Number(price) });
    if (!r.ok) { toast(t(`recommendations.err.${r.error}`)); return; }
    onClose();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <p className="tabular text-sm text-muted">{rec.id} · {rec.sku}</p>
      {mode === 'adjust' && (
        <>
          <Field label={t('recommendations.dialog.newPrice')} error={submitted ? priceErr : undefined}>
            {(p) => <Input {...p} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />}
          </Field>
          {Number.isFinite(priceNum) && priceNum > 0 && deltaPct !== null && (
            <ConsequencePreview
              items={[
                { label: t('recommendations.decision.priceMove'), value: `${formatPrice(rec.currentPrice, locale)} → ${formatPrice(priceNum, locale)}` },
                {
                  label: t('recommendations.dialog.delta'),
                  value: `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
                  tone: priceCheck === 'ok' ? 'default' : 'warn',
                },
              ]}
            />
          )}
        </>
      )}
      <Field label={t(mode === 'escalate' ? 'recommendations.dialog.noteOptional' : 'recommendations.dialog.note')} error={submitted && noteRequired ? noteErr : undefined}>
        {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('recommendations.action.cancel')}</Button>
        <Button type="submit" variant={mode === 'reject' ? 'destructive' : 'primary'}>{t('recommendations.action.confirm')}</Button>
      </div>
    </form>
  );
}
