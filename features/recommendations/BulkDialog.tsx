'use client';

import { useMemo, useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { ActionSummary, DocsLink, RecoveryNotice } from '@/components/ds/trust';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { bulkApprove, bulkEligibility, bulkEscalate, bulkReject } from '@/lib/actions/recommendation';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Recommendation } from '@/lib/ontology';
import { useSessionStore, useToastStore, useUndoStore } from '@/lib/stores';

type Mode = 'approve' | 'reject' | 'escalate';

/** §17 bulk ops: approve (confidence-gated), reject and escalate (note-driven) over the filtered queue. */
export function BulkDialog({ open, onClose, recs, preselected }: {
  open: boolean; onClose: () => void; recs: Recommendation[];
  /** Table-view selection: only these ids start checked (still eligibility-filtered inside). */
  preselected?: Set<string>;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} title={t('recommendations.dialog.bulkTitle')} className="max-w-lg">
      {open && <Body recs={recs} preselected={preselected} onClose={onClose} />}
    </Dialog>
  );
}

function Body({ recs, preselected, onClose }: { recs: Recommendation[]; preselected?: Set<string>; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const staged = useUndoStore((s) => s.staged);
  const can = useCan();
  const modes: Mode[] = can('recommendation.bulk_approve') ? ['approve', 'reject', 'escalate'] : ['reject', 'escalate'];
  const [mode, setMode] = useState<Mode>(modes[0]!);
  const [threshold, setThreshold] = useState('85');
  const [note, setNote] = useState('');
  const [deselected, setDeselected] = useState<Set<string>>(() =>
    preselected ? new Set(recs.filter((r) => !preselected.has(r.id)).map((r) => r.id)) : new Set());
  const min = Math.min(100, Math.max(0, Number(threshold) || 0));
  const plan = useMemo(() => bulkEligibility(recs, min, user), [recs, min, user]);
  const stale = plan.excluded.filter((e) => e.reason === 'stale').length;
  const breach = plan.excluded.filter((e) => e.reason === 'breach').length;
  const chain = plan.excluded.filter((e) => e.reason === 'chain').length;

  // Reject/escalate don't need health gates — every decidable, unstaged rec is eligible.
  const decidable = useMemo(
    () => recs.filter((r) => (r.status === 'pending' || r.status === 'escalated') && !staged[r.id]),
    [recs, staged],
  );
  const pool = mode === 'approve' ? plan.eligible : decidable;
  const chosen = pool.filter((r) => !deselected.has(r.id));
  const impact = chosen.reduce((s, r) => s + r.projectedMarginImpact, 0);
  const noteMissing = (mode === 'reject' || mode === 'escalate') && !note.trim();
  const toggle = (id: string) =>
    setDeselected((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const confirm = () => {
    const ids = new Set(chosen.map((x) => x.id));
    if (mode === 'approve') {
      const r = bulkApprove(user, recs, min, ids);
      if (!r.ok) { toast(t(`recommendations.err.${r.error}`)); return; }
      toast(t('recommendations.toast.bulk', { n: r.count }));
    } else if (mode === 'reject') {
      const r = bulkReject(user, chosen, note);
      if (!r.ok) { toast(t(`recommendations.err.${r.error}`)); return; }
      toast(t('recommendations.toast.bulkRejected', { n: r.count }));
    } else {
      const r = bulkEscalate(user, chosen, note);
      if (!r.ok) { toast(t(`recommendations.err.${r.error}`)); return; }
      toast(t('recommendations.toast.bulkEscalated', { n: r.count }));
    }
    onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t('recommendations.dialog.mode')} className="flex gap-1">
        {modes.map((m) => (
          <Button key={m} size="sm" variant={mode === m ? 'selected' : 'secondary'} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {t(`recommendations.dialog.mode_${m}`)}
          </Button>
        ))}
      </div>

      {mode === 'approve' ? (
        <Field label={t('recommendations.dialog.threshold')}>
          {(p) => <Input {...p} type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} />}
        </Field>
      ) : (
        <>
          <Field label={t('recommendations.dialog.bulkNote')}>
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <p className="-mt-2 text-xs text-faint">{t('recommendations.dialog.bulkNoteHint')}</p>
        </>
      )}

      <div aria-live="polite" className="rounded-input bg-subtle p-3 text-sm">
        {chosen.length === 0 ? (
          <p>{t('recommendations.dialog.none')}</p>
        ) : (
          <>
            <p className="font-medium">{t('recommendations.dialog.targets', { n: chosen.length })}</p>
            <p className="text-muted">{t('recommendations.dialog.impact')}: <PriceValue value={impact} /></p>
          </>
        )}
        {mode === 'approve' && plan.excluded.length > 0 && (
          <p className="mt-1 text-xs text-warn">{t('recommendations.dialog.excluded', { n: plan.excluded.length, stale, breach, chain })}</p>
        )}
      </div>
      {pool.length > 0 && (
        <fieldset className="rounded-input border border-line">
          <legend className="sr-only">{t('recommendations.dialog.checklist')}</legend>
          <ul className="max-h-56 divide-y divide-line overflow-auto text-xs">
            {pool.map((r) => {
              const on = !deselected.has(r.id);
              return (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors duration-fast hover:bg-subtle">
                    <input type="checkbox" checked={on} onChange={() => toggle(r.id)} />
                    <span className="tabular font-medium">{r.id}</span>
                    <span className="tabular text-muted">{r.sku}</span>
                    <span className="tabular ml-auto text-muted">{r.confidence}%</span>
                    <PriceValue value={r.projectedMarginImpact} muted />
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
      {mode === 'approve' && plan.excluded.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">{t('recommendations.dialog.excludedList', { n: plan.excluded.length })}</summary>
          <ul className="mt-1 flex flex-col gap-1 pl-4">
            {plan.excluded.map(({ rec, reason }) => (
              <li key={rec.id} className="tabular">
                {rec.id} · {rec.sku} · <span className="text-warn">{t(`recommendations.dialog.reason.${reason}`)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <RecoveryNotice>
        {mode === 'approve' ? t('recommendations.dialog.bulkImmediate') : t('recommendations.dialog.bulkImmediateOther')}
        {' '}<DocsLink href="/audit">{t('common.action.viewAudit')}</DocsLink>
      </RecoveryNotice>
      <ActionSummary
        consequence={
          <>
            {t('recommendations.dialog.targetsShort', { n: chosen.length })} · {t('recommendations.dialog.impact')} <PriceValue value={impact} />
            {mode === 'approve' && plan.excluded.length > 0 && <> · {t('recommendations.dialog.excludedShort', { n: plan.excluded.length })}</>}
          </>
        }
        action={
          <>
            <Button variant="secondary" onClick={onClose}>{t('recommendations.action.cancel')}</Button>
            <Button disabled={chosen.length === 0 || noteMissing} onClick={confirm}>
              {t(`recommendations.dialog.confirmBulk_${mode}`, { n: chosen.length })}
            </Button>
          </>
        }
      />
    </div>
  );
}
