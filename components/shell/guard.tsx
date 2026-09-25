'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { create } from 'zustand';
import { PermissionDeniedState } from '@/components/ds/states';
import { recordAuthEvent } from '@/lib/auth/api';
import { useCan } from '@/lib/hooks';
import { actionForPath } from '@/lib/rbac';
import { useSessionStore } from '@/lib/stores';

export const useGuardStore = create<{
  deniedFrom: string | null;
  deny: (path: string) => void;
  clearDenied: () => void;
}>((set) => ({
  deniedFrom: null,
  deny: (deniedFrom) => set({ deniedFrom }),
  clearDenied: () => set({ deniedFrom: null }),
}));

/**
 * Route-level authorization (AUTH-26). A route the role may not open renders the unauthorized
 * state instead of the page — no handler on the page can fire — and the denial is audited once
 * per visit. The frontend check is presentation only; the backend remains the authority.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const can = useCan();
  const user = useSessionStore((s) => s.user);
  const action = actionForPath(pathname);
  const allowed = action === null || can(action);
  const logged = useRef<string | null>(null);

  useEffect(() => {
    if (allowed || logged.current === pathname) return;
    logged.current = pathname;
    recordAuthEvent('auth_access_denied', { actorId: user.userId, actorRole: user.role, entityId: user.userId, note: `${pathname} (${action})` });
  }, [allowed, pathname, action, user]);

  return allowed ? <>{children}</> : <PermissionDeniedState action={action ?? undefined} />;
}
