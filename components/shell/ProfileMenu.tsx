'use client';

import { ArrowLeftRight, LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { workspaceCount, workspaceLabel } from '@/lib/auth/api';
import { useTranslation } from '@/lib/i18n';
import { useSessionStore } from '@/lib/stores';
import { useAuthStore } from '@/lib/stores/auth';
import { cn } from '@/lib/utils';
import { DevRoleSelect } from './DevRoleSelect';

const isDev = process.env.NODE_ENV !== 'production';
const item = 'flex h-9 w-full items-center gap-2.5 rounded-row px-2.5 text-left text-[13px] font-medium text-fg transition-colors duration-fast hover:bg-subtle';

/**
 * AUTH-14 profile menu: identity (name, role, workspace, IdP) → View profile, Switch workspace
 * (only with several memberships), Settings, Sign out. The dev-only role switcher stays below a
 * divider for local testing and is not part of the product.
 */
export function ProfileMenu({ onClose, className }: { onClose: () => void; className?: string }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const canSwitch = session ? workspaceCount(session.userId, session.organizationId) > 1 : false;
  return (
    <div role="menu" className={cn('glass rounded-card border border-line p-2 shadow-e3', className)}>
      <div className="px-2.5 pb-2 pt-1">
        <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
        <p className="truncate text-xs text-muted">{t(`common.role.${user.role}`)}</p>
        {session && <p className="mt-1 truncate text-xs text-faint" title={workspaceLabel(session.workspaceId)}>{workspaceLabel(session.workspaceId)}</p>}
        {session?.identityProvider && <p className="truncate text-xs text-faint">{t('auth.profile.signedInVia', { provider: session.identityProvider })}</p>}
      </div>
      <div className="border-t border-divider pt-1">
        <Link role="menuitem" href="/settings/preferences" onClick={onClose} className={item}><UserRound className="size-4 text-muted" aria-hidden />{t('auth.profile.view')}</Link>
        {canSwitch && <Link role="menuitem" href="/workspaces" onClick={onClose} className={item}><ArrowLeftRight className="size-4 text-muted" aria-hidden />{t('auth.profile.switch')}</Link>}
        <Link role="menuitem" href="/settings/general" onClick={onClose} className={item}><Settings className="size-4 text-muted" aria-hidden />{t('auth.profile.settings')}</Link>
        <Link role="menuitem" href="/auth/logout" onClick={onClose} className={cn(item, 'text-critical')}><LogOut className="size-4" aria-hidden />{t('auth.profile.signOut')}</Link>
      </div>
      {isDev && (
        <div className="mt-1 border-t border-divider px-2.5 pb-1 pt-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">{t('auth.profile.devRole')}</p>
          <DevRoleSelect />
        </div>
      )}
    </div>
  );
}
