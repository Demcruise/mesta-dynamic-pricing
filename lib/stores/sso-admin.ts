import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '../ontology';

/**
 * Administrator changes to the identity layer (AUTH-16/17/18), kept on top of the directory
 * defaults: IdP group → role mapping and fallback role per organization, and provisioning status
 * per user (deprovisioned users can no longer sign in). A backend would own these tables.
 */
interface SsoAdminState {
  groupRoles: Record<string, Record<string, Role>>;
  fallbackRole: Record<string, Role | null>;
  userStatus: Record<string, 'active' | 'disabled'>;
  setMapping: (orgId: string, mapping: Record<string, Role>, fallback: Role | null) => void;
  setUserStatus: (userId: string, status: 'active' | 'disabled') => void;
}

export const useSsoAdminStore = create<SsoAdminState>()(
  persist(
    (set) => ({
      groupRoles: {},
      fallbackRole: {},
      userStatus: {},
      setMapping: (orgId, mapping, fallback) => set((s) => ({ groupRoles: { ...s.groupRoles, [orgId]: mapping }, fallbackRole: { ...s.fallbackRole, [orgId]: fallback } })),
      setUserStatus: (userId, status) => set((s) => ({ userStatus: { ...s.userStatus, [userId]: status } })),
    }),
    { name: 'mesta-sso-admin', version: 1 },
  ),
);
