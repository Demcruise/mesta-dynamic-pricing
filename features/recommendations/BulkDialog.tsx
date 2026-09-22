'use client';

import { useMemo, useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
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
  const min = Math.min(100, Math.max(0, Number(threshold) || 0));
  const plan = useMemo(() => bulkEligibility(recs, min), [recs, min]);
  const stale = plan.excluded.filter((e) => e.reason === 'stale').length;
  const breach = plan.excluded.length - stale;

  const confirm = () => {
    const r = bulkApprove(user, recs, min);
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
        {plan.eligible.length === 0 ? (
          <p>{t('recommendations.dialog.none')}</p>
        ) : (
          <>
            <p className="font-medium">{t('recommendations.dialog.targets', { n: plan.eligible.length })}</p>
            <p className="text-muted">{t('recommendations.dialog.impact')}: <PriceValue value={plan.impact} /></p>
          </>
        )}
        {plan.excluded.length > 0 && <p className="mt-1 text-xs text-warn">{t('recommendations.dialog.excluded', { n: plan.excluded.length, stale, breach })}</p>}
      </div>
      {plan.eligible.length > 0 && (
        <ul className="max-h-40 overflow-auto text-xs text-muted">
          {plan.eligible.map((r) => <li key={r.id} className="tabular">{r.id} · {r.sku} · {r.confidence}%</li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('recommendations.action.cancel')}</Button>
        <Button disabled={plan.eligible.length === 0} onClick={confirm}>{t('recommendations.dialog.confirmBulk', { n: plan.eligible.length })}</Button>
      </div>
    </div>
  );
}
