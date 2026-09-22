'use client';

import { useMemo, useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { ActionSummary, DocsLink, RecoveryNotice } from '@/components/ds/trust';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { bulkApprove, bulkEligibility } from '@/lib/actions/recommendation';
import { useTranslation } from '@/lib/i18n';
import type { Recommendation } from '@/lib/ontology';
import { useSessionStore, useToastStore } from '@/lib/stores';

export function BulkDialog({ open, onClose, recs }: { open: boolean; onClose: () => void; recs: Recommendation[] }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} title={t('recommendations.dialog.bulkTitle')} className="max-w-lg">
      {open && <Body recs={recs} onClose={onClose} />}
    </Dialog>
  );
}

function Body({ recs, onClose }: { recs: Recommendation[]; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [threshold, setThreshold] = useState('85');
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const min = Math.min(100, Math.max(0, Number(threshold) || 0));
  const plan = useMemo(() => bulkEligibility(recs, min), [recs, min]);
  const stale = plan.excluded.filter((e) => e.reason === 'stale').length;
  const breach = plan.excluded.length - stale;

  const chosen = plan.eligible.filter((r) => !deselected.has(r.id));
  const impact = chosen.reduce((s, r) => s + r.projectedMarginImpact, 0);
  const toggle = (id: string) =>
    setDeselected((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const confirm = () => {
    const r = bulkApprove(user, recs, min, new Set(chosen.map((x) => x.id)));
    if (!r.ok) { toast(t(`recommendations.err.${r.error}`)); return; }
    toast(t('recommendations.toast.bulk', { n: r.count }));
    onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label={t('recommendations.dialog.threshold')}>
        {(p) => <Input {...p} type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} />}
      </Field>
      <div aria-live="polite" className="rounded-input bg-subtle p-3 text-sm">
        {chosen.length === 0 ? (
          <p>{t('recommendations.dialog.none')}</p>
        ) : (
          <>
            <p className="font-medium">{t('recommendations.dialog.targets', { n: chosen.length })}</p>
            <p className="text-muted">{t('recommendations.dialog.impact')}: <PriceValue value={impact} /></p>
          </>
        )}
        {plan.excluded.length > 0 && <p className="mt-1 text-xs text-warn">{t('recommendations.dialog.excluded', { n: plan.excluded.length, stale, breach })}</p>}
      </div>
      {plan.eligible.length > 0 && (
        <fieldset className="rounded-input border border-line">
          <legend className="sr-only">{t('recommendations.dialog.checklist')}</legend>
          <ul className="max-h-56 divide-y divide-line overflow-auto text-xs">
            {plan.eligible.map((r) => {
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
      {plan.excluded.length > 0 && (
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
      <RecoveryNotice>{t('recommendations.dialog.bulkImmediate')} <DocsLink href="/audit">{t('common.action.viewAudit')}</DocsLink></RecoveryNotice>
      <ActionSummary
        consequence={
          <>
            {t('recommendations.dialog.targetsShort', { n: chosen.length })} · {t('recommendations.dialog.impact')} <PriceValue value={impact} />
            {plan.excluded.length > 0 && <> · {t('recommendations.dialog.excludedShort', { n: plan.excluded.length })}</>}
          </>
        }
        action={
          <>
            <Button variant="secondary" onClick={onClose}>{t('recommendations.action.cancel')}</Button>
            <Button disabled={chosen.length === 0} onClick={confirm}>{t('recommendations.dialog.confirmBulk', { n: chosen.length })}</Button>
          </>
        }
      />
    </div>
  );
}
