'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { PermissionDeniedState } from '@/components/ds/states';
import { useCan } from '@/lib/hooks';
import { actionForPath } from '@/lib/rbac';

export const useGuardStore = create<{ denied: boolean; setDenied: (v: boolean) => void }>((set) => ({
  denied: false,
  setDenied: (denied) => set({ denied }),
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
      useGuardStore.getState().setDenied(true);
      router.replace('/overview');
    }
  }, [allowed, router]);

  return allowed ? <>{children}</> : <PermissionDeniedState />;
}
