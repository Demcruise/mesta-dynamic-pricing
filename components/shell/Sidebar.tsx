'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { useUiStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { RoleGate } from './RoleGate';
import { isActive, NAV } from './nav';

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  // Below lg the sidebar is always icon-only (tablet); at lg+ the user can collapse it.
  const labelCls = collapsed ? 'hidden' : 'hidden lg:inline';

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface md:flex',
        collapsed ? 'w-14' : 'w-14 lg:w-56',
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 font-semibold">
        <span className="grid size-6 place-items-center rounded bg-brand text-xs text-brand-fg" aria-hidden>M</span>
        <span className={labelCls}>{t('common.app.name')}</span>
      </div>
      <nav aria-label={t('common.nav.primary')} className="flex-1 px-2 py-2">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, key, icon: Icon, action }) => {
            const active = isActive(pathname, href);
            return (
              <RoleGate key={href} action={action}>
                <li>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    title={t(`common.nav.${key}`)}
                    className={cn(
                      'flex h-9 items-center gap-3 rounded-input px-2.5 text-sm',
                      active ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-subtle hover:text-fg',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className={labelCls}>{t(`common.nav.${key}`)}</span>
                  </Link>
                </li>
              </RoleGate>
            );
          })}
        </ul>
      </nav>
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="m-2 hidden h-9 items-center justify-center rounded-input text-muted hover:bg-subtle lg:flex"
      >
        {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
      </button>
    </aside>
  );
}
