'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { undoDecision } from '@/lib/actions/recommendation';
import { useTranslation } from '@/lib/i18n';
import { useToastStore, useUndoStore } from '@/lib/stores';

/** Info toasts plus undo toasts for staged recommendation decisions (10s window). */
export function ToastHost() {
  const { t } = useTranslation();
  const staged = useUndoStore((s) => s.staged);
  const toasts = useToastStore((s) => s.toasts);
  const [now, setNow] = useState(() => Date.now());
  const stagedList = Object.values(staged);

  useEffect(() => {
    if (stagedList.length === 0) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [stagedList.length]);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-20 right-4 z-50 flex max-w-sm flex-col gap-2 md:bottom-4">
      {stagedList.map((d) => (
        <div key={d.recId} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 text-sm shadow-lg">
          <span className="flex-1">{t(`recommendations.toast.${d.to}`, { id: d.recId })} · {Math.max(0, Math.ceil((d.expiresAt - now) / 1000))}s</span>
          <Button size="sm" variant="secondary" onClick={() => undoDecision(d.recId)}>{t('recommendations.action.undo')}</Button>
        </div>
      ))}
      {toasts.map((x) => (
        <div key={x.id} className="rounded-card border border-line bg-surface p-3 text-sm shadow-lg">{x.message}</div>
      ))}
    </div>
  );
}
