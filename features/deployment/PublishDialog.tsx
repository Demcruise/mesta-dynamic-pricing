'use client';

import { Ban, Check, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { ActionSummary, DocsLink, RecoveryNotice } from '@/components/ds/trust';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, inputCls } from '@/components/ui/field';
import { createPublishJob, preflight } from '@/lib/actions/deployment';
import { useTranslation } from '@/lib/i18n';
import type { Channel, Recommendation } from '@/lib/ontology';
import { CHANNELS } from '@/lib/stores/deployment';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

/** The three Indonesian operating zones — stored as an IANA-style label on the job. */
const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'];

/**
 * Publish decision surface: preflight checklist + now/schedule choice + consequence
 * and recovery statements next to the CTA (enterprise EXEC-001/002, TR-001).
 */
export function PublishDialog({ rec, onClose }: { rec: Recommendation | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={rec !== null} onClose={onClose} title={t('deployment.publish.title')}>
      {rec && <Body key={rec.id} rec={rec} onClose={onClose} />}
    </Dialog>
  );
}

function Body({ rec, onClose }: { rec: Recommendation; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [at, setAt] = useState('');
  const [until, setUntil] = useState('');
  const [tz, setTz] = useState(TIMEZONES[0]);
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const checks = useMemo(() => preflight(rec.id), [rec.id]);
  const blocked = checks.some((c) => c.severity === 'block' && !c.ok);
  const confirm = () => {
    const r = createPublishJob(user, rec.id, {
      ...(mode === 'schedule' && at ? { scheduledFor: at } : {}),
      channels, timezone: tz, ...(until ? { effectiveUntil: until } : {}),
    });
    if (!r.ok) { toast(t(`deployment.err.${r.error}`)); return; }
    toast(t(mode === 'schedule' && at ? 'deployment.toast.scheduled' : 'deployment.toast.started', { id: rec.id }));
    onClose();
  };
  const toggleChannel = (c: Channel) =>
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        <span className="tabular">{rec.sku}</span> · <PriceValue value={rec.currentPrice} /> → <PriceValue value={rec.proposedPrice} />
      </p>
      <ul aria-label={t('deployment.publish.preflight')} className="flex flex-col gap-1 rounded-input border border-line p-3 text-sm">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2">
            {c.ok ? (
              <Check className="size-3.5 shrink-0 text-up" aria-hidden />
            ) : c.severity === 'block' ? (
              <Ban className="size-3.5 shrink-0 text-down" aria-hidden />
            ) : (
              <TriangleAlert className="size-3.5 shrink-0 text-warn" aria-hidden />
            )}
            <span className={cn(!c.ok && (c.severity === 'block' ? 'text-down' : 'text-warn'))}>
              {t(`deployment.publish.check.${c.key}`)}
            </span>
          </li>
        ))}
      </ul>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('deployment.publish.when')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="publish-when" checked={mode === 'now'} onChange={() => setMode('now')} />
          {t('deployment.publish.now')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="publish-when" checked={mode === 'schedule'} onChange={() => setMode('schedule')} />
          {t('deployment.publish.schedule')}
        </label>
        {mode === 'schedule' && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('deployment.publish.at')}>
              {(p) => <Input {...p} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={cn(inputCls, 'w-auto')} />}
            </Field>
            <Field label={t('deployment.publish.timezone')}>
              {(p) => (
                <select {...p} className={cn(inputCls, 'w-auto')} value={tz} onChange={(e) => setTz(e.target.value)}>
                  {TIMEZONES.map((z) => <option key={z} value={z}>{z.replace('Asia/', '')}</option>)}
                </select>
              )}
            </Field>
          </div>
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-muted">{t('deployment.publish.channels')}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {CHANNELS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChannel(c)} />
              {t(`common.channel.${c}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t('deployment.publish.effectiveUntil')}>
        {(p) => <Input {...p} type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={cn(inputCls, 'w-auto')} />}
      </Field>
      <p className="text-xs text-faint">{t('deployment.publish.untilHint')}</p>
      <RecoveryNotice>
        {t('deployment.publish.recovery')} <DocsLink href="/audit">{t('common.action.viewAudit')}</DocsLink>
      </RecoveryNotice>
      <ActionSummary
        consequence={t('deployment.publish.consequence', { n: channels.length, sku: rec.sku })}
        action={
          <>
            <Button variant="secondary" onClick={onClose}>{t('recommendations.action.cancel')}</Button>
            <Button disabled={blocked || channels.length === 0 || (mode === 'schedule' && !at)} onClick={confirm}>
              {mode === 'schedule' ? t('deployment.publish.scheduleCta') : t('deployment.publish.nowCta')}
            </Button>
          </>
        }
      />
    </div>
  );
}
