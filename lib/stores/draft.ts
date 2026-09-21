import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StrategyDraft } from '../strategy-rules';

export interface StoredDraft { draft: StrategyDraft; step: number }

interface DraftState {
  drafts: Record<string, StoredDraft>; // key: 'new' or strategy id
  setDraft: (key: string, value: StoredDraft) => void;
  clearDraft: (key: string) => void;
}

/** Wizard autosave. skipHydration: Providers rehydrates after mount to avoid SSR mismatch. */
export const useStrategyDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (key, value) => set((s) => ({ drafts: { ...s.drafts, [key]: value } })),
      clearDraft: (key) =>
        set((s) => {
          const { [key]: _drop, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'mesta-strategy-drafts', skipHydration: true },
  ),
);
