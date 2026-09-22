'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { PermissionDeniedState } from '@/components/ds/states';
import { useCan } from '@/lib/hooks';
import { actionForPath } from '@/lib/rbac';

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
 * Blocks direct navigation to routes the role may not open: renders the denied
 * state (never the page, so no handler can fire) and redirects to /overview.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const can = useCan();
  const action = actionForPath(pathname);
  const allowed = action === null || can(action);

  useEffect(() => {
    if (!allowed) {
      useGuardStore.getState().deny(pathname);
      router.replace('/overview');
    }
  }, [allowed, pathname, router]);

  return allowed ? <>{children}</> : <PermissionDeniedState />;
}
