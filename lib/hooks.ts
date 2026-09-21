'use client';

import { can, type Action } from './rbac';
import { useSessionStore } from './stores/session';

/** Runtime permission check for the current mock user. Use in handlers too, not only for visibility. */
export function useCan() {
  const role = useSessionStore((s) => s.user.role);
  return (action: Action) => can(role, action);
}
