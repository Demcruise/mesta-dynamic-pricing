import { create } from 'zustand';
import type { RecommendationStatus, Role } from '../ontology';

export const UNDO_WINDOW_MS = 10_000;

export interface StagedDecision {
  recId: string;
  to: Exclude<RecommendationStatus, 'pending'>;
  note: string | null;
  proposedPrice: number | null;
  actorId: string;
  actorRole: Role;
  expiresAt: number;
}

interface UndoState {
  staged: Record<string, StagedDecision>;
  stage: (d: StagedDecision) => void;
  unstage: (recId: string) => StagedDecision | undefined;
  reset: () => void;
}

/** Decisions wait here for 10s; only when committed do they reach the recommendation and audit stores. */
export const useUndoStore = create<UndoState>((set, get) => ({
  staged: {},
  stage: (d) => set((s) => ({ staged: { ...s.staged, [d.recId]: d } })),
  unstage: (recId) => {
    const d = get().staged[recId];
    if (!d) return undefined;
    set((s) => {
      const { [recId]: _drop, ...rest } = s.staged;
      return { staged: rest };
    });
    return d;
  },
  reset: () => set({ staged: {} }),
}));
