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
  /** Previous versions per strategy id, newest last. Written on every edit. */
  history: Record<string, Strategy[]>;
  hydrate: (items: Strategy[]) => void;
  upsert: (s: Strategy) => void;
  /** Restores the guardrail/scope/name of a stored version while keeping current status. */
  rollback: (id: string, versionIndex: number) => TransitionResult;
  transition: (id: string, to: StrategyStatus) => TransitionResult;
  reset: () => void;
}

export const useStrategyStore = create<StrategyState>((set, get) => ({
  items: [],
  history: {},
  hydrate: (items) => set({ items, history: {} }),
  upsert: (s) =>
    set((st) => {
      const prev = st.items.find((x) => x.id === s.id);
      return {
        items: prev ? st.items.map((x) => (x.id === s.id ? s : x)) : [s, ...st.items],
        history: prev ? { ...st.history, [s.id]: [...(st.history[s.id] ?? []), prev] } : st.history,
      };
    }),
  rollback: (id, versionIndex) => {
    const cur = get().items.find((x) => x.id === id);
    const version = get().history[id]?.[versionIndex];
    if (!cur || !version) return { ok: false, error: 'not_found' };
    if (cur.status === 'archived') return { ok: false, error: 'archived' };
    get().upsert({
      ...cur, name: version.name, objective: version.objective, skuIds: version.skuIds,
      categories: version.categories, guardrail: version.guardrail, updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  },
  transition: (id, to) => {
    const s = get().items.find((x) => x.id === id);
    if (!s) return { ok: false, error: 'not_found' };
    if (!canTransitionStrategy(s.status, to)) return { ok: false, error: `invalid_transition:${s.status}->${to}` };
    set((st) => ({
      items: st.items.map((x) => (x.id === id ? { ...x, status: to, updatedAt: new Date().toISOString() } : x)),
    }));
    return { ok: true };
  },
  reset: () => set({ items: [], history: {} }),
}));
