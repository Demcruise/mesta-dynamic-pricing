'use client';

import { ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useDeploymentRecords, useRecommendations } from '@/lib/queries';
import { useSessionStore, useUiStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { DevRoleSelect } from './DevRoleSelect';
import { RoleGate } from './RoleGate';
import { isActive, NAV_SECTIONS, type NavItem } from './nav';

const isDev = process.env.NODE_ENV !== 'production';

const BADGE_CLS: Record<NonNullable<NavItem['badge']>, { chip: string; dot: string }> = {
  pendingRecommendations: { chip: 'bg-warn-soft text-warn', dot: 'bg-warn' },
  failedDeployments: { chip: 'bg-down-soft text-down', dot: 'bg-down' },
};

/** Live badge counts sourced from the real stores, not copy. */
function useBadgeCounts() {
  const recs = useRecommendations();
  const deployments = useDeploymentRecords();
  return {
    pendingRecommendations: recs.data.filter((r) => r.status === 'pending').length,
    failedDeployments: deployments.data.filter((r) => r.status === 'failed').length,
  };
}

const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

function ProfileCard({ labelCls }: { labelCls: string }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // WCAG 2.5.3: the accessible name must contain the visible label. The avatar
  // initials and the name/role spans are adjacent text nodes, so axe compares
  // against their exact concatenation — build the name from the same pieces.
  const identity = `${initials(user.name)}${user.name}${t(`common.role.${user.role}`)}`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative border-t border-line p-2">
      <button
        type="button"
        aria-label={`${identity} — ${t('common.a11y.profile')}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('common.a11y.profile')}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-input p-1.5 text-left transition-colors duration-fast hover:bg-subtle"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand" aria-hidden>
          {initials(user.name)}
        </span>
        <span className={cn('min-w-0 flex-1 overflow-hidden', labelCls)}>
          <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
          <span className="block truncate text-xs text-muted">{t(`common.role.${user.role}`)}</span>
        </span>
        <ChevronsUpDown className={cn('size-3.5 shrink-0 text-faint', labelCls)} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="glass absolute inset-x-2 bottom-full z-40 mb-1 rounded-card border border-line p-3 shadow-e3">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="mb-2 text-xs text-muted">{t(`common.role.${user.role}`)}</p>
          {isDev && <DevRoleSelect />}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const badges = useBadgeCounts();
  // Below lg the sidebar is always icon-only (tablet); at lg+ the user can collapse it.
  const rail = collapsed;
  const labelCls = rail ? 'hidden' : 'hidden lg:inline';

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-base ease-standard md:flex',
        rail ? 'w-14' : 'w-14 lg:w-56',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={t(collapsed ? 'common.a11y.expandSidebar' : 'common.a11y.collapseSidebar')}
        className="absolute -right-3 top-16 z-10 hidden size-6 place-items-center rounded-full border border-line bg-surface text-muted shadow-e1 transition-colors duration-fast hover:bg-subtle hover:text-fg lg:grid"
      >
        {collapsed ? <PanelLeftOpen className="size-3.5" aria-hidden /> : <PanelLeftClose className="size-3.5" aria-hidden />}
      </button>

      <div className="flex h-14 shrink-0 items-center gap-2 px-4 font-semibold">
        <span className="grid size-6 shrink-0 place-items-center rounded bg-brand text-xs text-brand-fg" aria-hidden>M</span>
        <span className={labelCls}>{t('common.app.name')}</span>
      </div>

      <nav aria-label={t('common.nav.primary')} className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.key} className={cn(si > 0 && 'mt-3 border-t border-line pt-3')}>
            <p aria-hidden={rail || undefined} className={cn('truncate px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint', labelCls)}>
              {t(`common.nav.section.${section.key}`)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map(({ href, key, icon: Icon, action, badge }) => {
                const active = isActive(pathname, href);
                const count = badge ? badges[badge] : 0;
                const item = (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      title={t(`common.nav.${key}`)}
                      className={cn(
                        'relative flex h-9 items-center gap-3 rounded-input px-2.5 text-sm transition-colors duration-fast',
                        active ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-subtle hover:text-fg',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className={cn('truncate', labelCls)}>{t(`common.nav.${key}`)}</span>
                      {count > 0 && badge && (
                        <>
                          <span className={cn('tabular ml-auto rounded-full px-1.5 text-xs font-medium', BADGE_CLS[badge].chip, labelCls)}>
                            {count}
                          </span>
                          <span className={cn('absolute right-1.5 top-1.5 size-2 rounded-full', BADGE_CLS[badge].dot, rail ? '' : 'lg:hidden')} aria-hidden />
                        </>
                      )}
                    </Link>
                  </li>
                );
                return action ? <RoleGate key={href} action={action}>{item}</RoleGate> : item;
              })}
            </ul>
          </div>
        ))}
      </nav>

      <ProfileCard labelCls={labelCls} />
    </aside>
  );
}
