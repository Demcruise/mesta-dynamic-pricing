import { create } from 'zustand';
import type { Strategy, StrategyStatus } from '../ontology';
import type { TransitionResult } from './recommendation';

const ALLOWED: Record<StrategyStatus, StrategyStatus[]> = {
  draft: ['pending_manager_approval', 'archived'],
  pending_manager_approval: ['active', 'draft', 'archived'], // reject → back to draft
  active: ['archived'],
  archived: [],
};

export function canTransitionStrategy(from: StrategyStatus, to: StrategyStatus) {
  return ALLOWED[from].includes(to);
}

interface StrategyState {
  items: Strategy[];
  hydrate: (items: Strategy[]) => void;
  upsert: (s: Strategy) => void;
  transition: (id: string, to: StrategyStatus) => TransitionResult;
  reset: () => void;
}

export const useStrategyStore = create<StrategyState>((set, get) => ({
  items: [],
  hydrate: (items) => set({ items }),
  upsert: (s) =>
    set((st) => ({
      items: st.items.some((x) => x.id === s.id) ? st.items.map((x) => (x.id === s.id ? s : x)) : [s, ...st.items],
    })),
  transition: (id, to) => {
    const s = get().items.find((x) => x.id === id);
    if (!s) return { ok: false, error: 'not_found' };
    if (!canTransitionStrategy(s.status, to)) return { ok: false, error: `invalid_transition:${s.status}->${to}` };
    set((st) => ({
      items: st.items.map((x) => (x.id === id ? { ...x, status: to, updatedAt: new Date().toISOString() } : x)),
    }));
    return { ok: true };
  },
  reset: () => set({ items: [] }),
}));
