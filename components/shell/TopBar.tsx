'use client';

import { CircleHelp, Search, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { resetMestaData } from '@/lib/bootstrap';
import { useTranslation } from '@/lib/i18n';
import { ROLES } from '@/lib/rbac';
import { useSessionStore, useUiStore } from '@/lib/stores';
import { useCommandStore } from './command-store';
import { useFeedbackDialog } from './FeedbackDialog';
import { useGlossaryStore } from './Glossary';
import { NotificationBell } from './NotificationBell';
import type { Role } from '@/lib/ontology';

const isDev = process.env.NODE_ENV !== 'production';

function UserMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useSessionStore((s) => s.user);
  const { locale, setLocale, theme, setTheme } = useUiStore();

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
      <Button variant="ghost" size="icon" aria-label={t('common.user.menu')} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <User className="size-4" aria-hidden />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-40 w-56 rounded-card border border-line bg-surface p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">{user.name}</p>
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>{t('common.user.language')}</span>
            <div className="flex gap-1">
              {(['id', 'en'] as const).map((l) => (
                <Button key={l} size="sm" variant={locale === l ? 'primary' : 'secondary'} aria-pressed={locale === l} onClick={() => setLocale(l)}>
                  {l.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>{t('common.user.theme')}</span>
            <Button size="sm" variant="secondary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {t(theme === 'light' ? 'common.user.dark' : 'common.user.light')}
            </Button>
          </div>
          <Button size="sm" variant="secondary" className="mb-2 w-full sm:hidden" onClick={() => { useGlossaryStore.getState().show(null); setOpen(false); }}>
            {t('common.a11y.help')}
          </Button>
          <Button size="sm" variant="secondary" className="mb-2 w-full" onClick={() => { useFeedbackDialog.getState().setOpen(true); setOpen(false); }}>
            {t('common.a11y.feedback')}
          </Button>
          {isDev && (
            <Button size="sm" variant="secondary" className="w-full" onClick={() => { resetMestaData(); setOpen(false); }}>
              {t('common.user.resetDemo')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { t } = useTranslation();
  const setOpen = useCommandStore((s) => s.setOpen);
  const role = useSessionStore((s) => s.user.role);
  const setRole = useSessionStore((s) => s.setRole);

  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface px-2 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-input border border-line bg-bg px-3 text-left text-sm text-faint md:max-w-md"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 truncate">{t('common.cmd.open')}</span>
        <kbd className="hidden rounded border border-line px-1 text-xs sm:inline">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        {isDev && (
          <label className="flex items-center gap-1 text-xs text-muted">
            <span className="sr-only sm:not-sr-only">{t('common.role.switcher')}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-9 w-20 rounded-input border border-line bg-surface px-1 text-sm text-fg sm:w-auto sm:px-2"
            >
              {ROLES.map((r) => <option key={r} value={r}>{t(`common.role.${r}`)}</option>)}
            </select>
          </label>
        )}
        <Button variant="ghost" size="icon" className="max-sm:hidden" aria-label={t('common.a11y.help')} onClick={() => useGlossaryStore.getState().show(null)}>
          <CircleHelp className="size-4" aria-hidden />
        </Button>
        <NotificationBell />
        <UserMenu />
      </div>
    </div>
  );
}
