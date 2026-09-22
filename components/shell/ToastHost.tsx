'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { undoDecision } from '@/lib/actions/recommendation';
import { useTranslation } from '@/lib/i18n';
import { UNDO_WINDOW_MS, useToastStore, useUndoStore } from '@/lib/stores';

const R = 8;
const CIRC = 2 * Math.PI * R;

/** Remaining-time ring for the undo countdown. */
function UndoRing({ expiresAt, now }: { expiresAt: number; now: number }) {
  const left = Math.max(0, expiresAt - now);
  const frac = left / UNDO_WINDOW_MS;
  const secs = Math.ceil(left / 1000);
  return (
    <span className="relative grid size-6 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 20 20" className="absolute inset-0 -rotate-90">
        <circle cx="10" cy="10" r={R} fill="none" className="stroke-line" strokeWidth="2" />
        <circle
          cx="10" cy="10" r={R} fill="none" strokeWidth="2" strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-base ease-standard motion-reduce:transition-none"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - frac)}
        />
      </svg>
      <span className="tabular text-[9px] font-semibold text-muted">{secs}</span>
    </span>
  );
}

/** Info toasts plus undo toasts for staged recommendation decisions (10s window). */
export function ToastHost() {
  const { t } = useTranslation();
  const staged = useUndoStore((s) => s.staged);
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const [now, setNow] = useState(() => Date.now());
  const stagedList = Object.values(staged);

  useEffect(() => {
    if (stagedList.length === 0) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [stagedList.length]);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-20 right-4 z-50 flex max-w-sm flex-col gap-2 md:bottom-4">
      {stagedList.map((d) => (
        <div key={d.recId} className="glass flex items-center gap-3 rounded-card border border-line p-3 text-sm shadow-e3">
          <UndoRing expiresAt={d.expiresAt} now={now} />
          <span className="flex-1">
            {t(`recommendations.toast.${d.to}`, { id: d.recId })}
            <span className="sr-only"> · {Math.max(0, Math.ceil((d.expiresAt - now) / 1000))}s</span>
          </span>
          <Button size="sm" variant="secondary" onClick={() => undoDecision(d.recId)}>{t('recommendations.action.undo')}</Button>
        </div>
      ))}
      {toasts.map((x) => (
        <div key={x.id} className="glass flex animate-drawer-in items-center gap-2 rounded-card border border-line p-3 text-sm shadow-e3">
          <span className="flex-1">{x.href ? <Link href={x.href} className="text-brand hover:underline">{x.message}</Link> : x.message}</span>
          <button type="button" aria-label={t('common.notify.dismiss')} onClick={() => dismiss(x.id)} className="grid size-5 shrink-0 place-items-center rounded text-faint transition-colors duration-fast hover:bg-subtle hover:text-fg">×</button>
        </div>
      ))}
    </div>
  );
}
