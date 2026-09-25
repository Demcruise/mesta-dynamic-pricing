import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Action } from '../rbac';
import type { AuditEvent, Role } from '../ontology';

/**
 * AUTH-06.1 — the established Mesta session. Identity, tenant, workspace, role and the resolved
 * permission set, plus timestamps. No tokens: the IdP response is validated and discarded by the
 * auth service, so nothing credential-like ever reaches client storage.
 */
export interface AuthSession {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  role: Role;
  permissions: Action[];
  identityProvider: string;
  sessionCreatedAt: string;
  sessionExpiry: string;
}

interface AuthState {
  session: AuthSession | null;
  /** Sessions revoked by an administrator — a revoked id can never be used again. */
  revoked: string[];
  /**
   * Auth audit events. Sign-in happens before the demo data (and its audit store) is seeded, so
   * the events are kept here and merged into the audit log on bootstrap.
   */
  events: AuditEvent[];
  setSession: (s: AuthSession | null) => void;
  extend: (expiry: string) => void;
  revoke: (sessionId: string) => void;
  pushEvent: (e: AuditEvent) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      revoked: [],
      events: [],
      setSession: (session) => set({ session }),
      extend: (sessionExpiry) => set((s) => (s.session ? { session: { ...s.session, sessionExpiry } } : s)),
      revoke: (sessionId) => set((s) => ({ revoked: [...new Set([...s.revoked, sessionId])], session: s.session?.sessionId === sessionId ? null : s.session })),
      pushEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 200) })),
    }),
    { name: 'mesta-auth', version: 1 },
  ),
);

/** A session is valid when present, unexpired and not revoked. */
export function isSessionValid(s: AuthSession | null, revoked: string[], now = Date.now()): s is AuthSession {
  return !!s && new Date(s.sessionExpiry).getTime() > now && !revoked.includes(s.sessionId);
}
