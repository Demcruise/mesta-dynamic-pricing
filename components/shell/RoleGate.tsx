'use client';

import type { ReactNode } from 'react';
import { useCan } from '@/lib/hooks';
import type { Action } from '@/lib/rbac';

interface Props {
  action: Action;
  children: ReactNode;
  /** hide (default) removes children; disable renders them inert. */
  mode?: 'hide' | 'disable';
  fallback?: ReactNode;
}

export function RoleGate({ action, children, mode = 'hide', fallback = null }: Props) {
  const can = useCan();
  if (can(action)) return <>{children}</>;
  if (mode === 'disable') {
    return (
      <fieldset disabled inert aria-disabled className="contents opacity-50">
        {children}
      </fieldset>
    );
  }
  return <>{fallback}</>;
}
