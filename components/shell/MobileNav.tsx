'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useDeploymentRecords, useRecommendations } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { RoleGate } from './RoleGate';
import { isActive, NAV, type NavItem } from './nav';

const DOT_CLS: Record<NonNullable<NavItem['badge']>, string> = {
  pendingRecommendations: 'bg-warn',
  failedDeployments: 'bg-down',
};

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const recs = useRecommendations();
  const deployments = useDeploymentRecords();
  const counts = {
    pendingRecommendations: recs.data.filter((r) => r.status === 'pending').length,
    failedDeployments: deployments.data.filter((r) => r.status === 'failed').length,
  };

  return (
    <nav
      aria-label={t('common.nav.mobile')}
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden"
    >
      {NAV.filter((n) => n.mobile).map(({ href, key, icon: Icon, action, badge }) => {
        const active = isActive(pathname, href);
        const count = badge ? counts[badge] : 0;
        const link = (
          <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-fast',
              active ? 'text-brand' : 'text-muted',
            )}
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden />
              {count > 0 && badge && <span className={cn('absolute -right-1 -top-1 size-2 rounded-full', DOT_CLS[badge])} aria-hidden />}
            </span>
            {t(`common.nav.${key}`)}
          </Link>
        );
        return action ? <RoleGate key={href} action={action}>{link}</RoleGate> : <Fragment key={href}>{link}</Fragment>;
      })}
    </nav>
  );
}
