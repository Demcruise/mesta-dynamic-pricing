'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { useNotifications } from '@/lib/queries';
import { groupNotifications, useNotificationStore, useSessionStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const role = user.role;
  const all = useNotifications().data;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const mine = useMemo(
    () => all.filter((n) => (n.targetRole === 'all' || n.targetRole === role) && !(n.snoozedUntil && new Date(n.snoozedUntil) > new Date())),
    [all, role],
  );
  const unread = mine.filter((n) => !n.read).length;
  const groups = useMemo(() => groupNotifications(mine), [mine]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" aria-label={`${t('common.a11y.notifications')}${unread ? ` (${unread})` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="relative">
          <Bell className="size-4" aria-hidden />
          {unread > 0 && <span className="tabular absolute -right-2 -top-2 rounded-full bg-down px-1 text-[10px] font-semibold text-brand-fg">{unread}</span>}
        </span>
      </Button>
      {open && (
        <div className="glass absolute right-0 top-10 z-40 w-80 rounded-card border border-line p-3 shadow-e3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('common.notify.title')}</h2>
            {unread > 0 && <button type="button" className="text-xs text-brand underline" onClick={() => useNotificationStore.getState().markAllRead(role)}>{t('common.notify.markAll')}</button>}
          </div>
          {groups.length === 0 ? <p className="text-sm text-muted">{t('common.notify.empty')}</p> : (
            <ul className="max-h-72 divide-y divide-line overflow-auto text-sm">
              {groups.map(({ groupKey, latest, count }) => (
                <li key={groupKey} className={cn('py-2', latest.read && 'text-muted')}>
                  {latest.href ? (
                    <Link href={latest.href} onClick={() => { useNotificationStore.getState().markRead(latest.id); setOpen(false); }} className="hover:underline">
                      {latest.message ?? t(latest.messageKey, latest.params)}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => useNotificationStore.getState().markRead(latest.id)} className="text-left">
                      {latest.message ?? t(latest.messageKey, latest.params)}
                    </button>
                  )}
                  {count > 1 && <span className="ml-2 rounded-full bg-subtle px-1.5 text-xs">{t('common.notify.grouped', { n: count })}</span>}
                  {/* AL-004: acknowledge / snooze / escalate, plus unread + deep link above. */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {latest.acknowledged ? (
                      <span className="rounded-full bg-up-soft px-1.5 py-0.5 text-up">{t('common.notify.acknowledged')}</span>
                    ) : (
                      <button type="button" className="text-brand hover:underline" onClick={() => useNotificationStore.getState().acknowledge(latest.id)}>
                        {t('common.notify.acknowledge')}
                      </button>
                    )}
                    <button type="button" className="text-muted hover:underline" onClick={() => useNotificationStore.getState().snooze(latest.id, new Date(Date.now() + 3_600_000).toISOString())}>
                      {t('common.notify.snooze')}
                    </button>
                    {latest.escalated ? (
                      <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-warn">{t('common.notify.escalated')}</span>
                    ) : (
                      <button type="button" className="text-muted hover:underline" onClick={() => useNotificationStore.getState().escalate(latest.id, user)}>
                        {t('common.notify.escalate')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
