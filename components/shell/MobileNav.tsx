'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RoleGate } from './RoleGate';
import { isActive, NAV } from './nav';

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('common.nav.mobile')}
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden"
    >
      {NAV.filter((n) => n.mobile).map(({ href, key, icon: Icon, action }) => {
        const active = isActive(pathname, href);
        return (
          <RoleGate key={href} action={action}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs',
                active ? 'text-brand' : 'text-muted',
              )}
            >
              <Icon className="size-5" aria-hidden />
              {t(`common.nav.${key}`)}
            </Link>
          </RoleGate>
        );
      })}
    </nav>
  );
}
