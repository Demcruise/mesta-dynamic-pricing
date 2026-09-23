import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Action } from '../rbac';
import type { Role } from '../ontology';

export type PolicyKey = `${Role}:${Action}`;

interface PolicyState {
  /**
   * Local overrides on top of the code-owned PERMISSIONS matrix (GOV-003).
   * Persisted per-browser; `can()` consults this map. Honest scope: it governs
   * this demo workspace only — real policy still lives in lib/rbac.ts.
   */
  overrides: Partial<Record<PolicyKey, boolean>>;
  set: (key: PolicyKey, allowed: boolean | undefined) => void;
  resetAll: () => void;
}

export const usePolicyStore = create<PolicyState>()(
  persist(
    (set) => ({
      overrides: {},
      set: (key, allowed) =>
        set((s) => {
          const next = { ...s.overrides };
          if (allowed === undefined) delete next[key];
          else next[key] = allowed;
          return { overrides: next };
        }),
      resetAll: () => set({ overrides: {} }),
    }),
    { name: 'mesta-policy', skipHydration: true },
  ),
);
