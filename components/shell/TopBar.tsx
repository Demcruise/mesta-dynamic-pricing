'use client';

import { CircleHelp, Languages, Moon, Rows2, Rows4, Search, Sun, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { resetMestaData } from '@/lib/bootstrap';
import { useTranslation } from '@/lib/i18n';
import { useSessionStore, useUiStore } from '@/lib/stores';
import { Breadcrumbs } from './Breadcrumbs';
import { useCommandStore } from './command-store';
import { DevRoleSelect } from './DevRoleSelect';
import { useFeedbackDialog } from './FeedbackDialog';
import { useGlossaryStore } from './Glossary';
import { NotificationBell } from './NotificationBell';

const isDev = process.env.NODE_ENV !== 'production';

function UserMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useSessionStore((s) => s.user);

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
        <div role="menu" className="glass absolute right-0 top-10 z-40 w-56 rounded-card border border-line p-3 shadow-e3">
          <p className="mb-2 text-sm font-medium">{user.name}</p>
          {isDev && <div className="mb-2"><DevRoleSelect /></div>}
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
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);

  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface px-2 sm:gap-3 sm:px-4">
      <Breadcrumbs />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-input border border-line bg-bg px-3 text-left text-sm text-faint transition-colors duration-fast hover:border-line-strong md:max-w-xs"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t('common.cmd.open')}</span>
        <kbd className="hidden rounded border border-line px-1 text-xs sm:inline">Ctrl K</kbd>
        <kbd className="hidden rounded border border-line px-1 text-xs sm:inline">/</kbd>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          variant="ghost" size="icon"
          aria-label={`${t('common.user.theme')}: ${t(theme === 'light' ? 'common.user.light' : 'common.user.dark')}`}
          title={t(theme === 'light' ? 'common.user.dark' : 'common.user.light')}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
        </Button>
        <Button
          variant="ghost" size="sm"
          // WCAG 2.5.3: include the visible code ("EN"/"ID") in the accessible name.
          aria-label={`${t('common.user.language')}: ${locale.toUpperCase()}`}
          onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
        >
          <Languages className="size-4" aria-hidden />
          <span className="text-xs font-medium">{locale.toUpperCase()}</span>
        </Button>
        <Button
          variant={density === 'compact' ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={`${t('common.density.label')}: ${t(`common.density.${density}`)}`}
          aria-pressed={density === 'compact'}
          title={`${t('common.density.label')}: ${t(`common.density.${density}`)}`}
          onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
        >
          {density === 'compact' ? <Rows4 className="size-4" aria-hidden /> : <Rows2 className="size-4" aria-hidden />}
        </Button>
        <Button variant="ghost" size="icon" className="max-sm:hidden" aria-label={t('common.a11y.help')} onClick={() => useGlossaryStore.getState().show(null)}>
          <CircleHelp className="size-4" aria-hidden />
        </Button>
        <NotificationBell />
        <UserMenu />
      </div>
    </div>
  );
}
