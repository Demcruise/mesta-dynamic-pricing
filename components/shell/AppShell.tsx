'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { CommandMenu } from './CommandMenu';
import { RouteGuard, useGuardStore } from './guard';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { ToastHost } from './ToastHost';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const denied = useGuardStore((s) => s.denied);
  const setDenied = useGuardStore((s) => s.setDenied);
  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-brand px-3 py-2 text-brand-fg focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        {t('common.app.skip')}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {denied && (
          <div role="status" className="flex items-center justify-between gap-3 bg-warn-soft px-4 py-2 text-sm text-warn">
            <span>{t('common.perm.notice')}</span>
            <Button size="sm" variant="secondary" onClick={() => setDenied(false)}>{t('common.perm.dismiss')}</Button>
          </div>
        )}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
      <MobileNav />
      <CommandMenu />
      <ToastHost />
    </div>
  );
}
