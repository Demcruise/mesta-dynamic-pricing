'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { CommandMenu } from './CommandMenu';
import { FeedbackDialog } from './FeedbackDialog';
import { GlossaryDialog } from './Glossary';
import { RouteGuard, useGuardStore } from './guard';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { ToastHost } from './ToastHost';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const deniedFrom = useGuardStore((s) => s.deniedFrom);
  const clearDenied = useGuardStore((s) => s.clearDenied);
  const pathname = usePathname();
  // The notice belongs to the /overview redirect landing; clear it once the user navigates on.
  useEffect(() => {
    if (deniedFrom && pathname !== deniedFrom && pathname !== '/overview') clearDenied();
  }, [pathname, deniedFrom, clearDenied]);
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
        {deniedFrom && pathname === '/overview' && (
          <div role="status" className="flex items-center justify-between gap-3 bg-warn-soft px-4 py-2 text-sm text-warn">
            <span>{t('common.perm.notice')}</span>
            <Button size="sm" variant="secondary" onClick={clearDenied}>{t('common.perm.dismiss')}</Button>
          </div>
        )}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
      <MobileNav />
      <CommandMenu />
      <ToastHost />
      <FeedbackDialog />
      <GlossaryDialog />
    </div>
  );
}
