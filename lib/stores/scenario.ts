import { create } from 'zustand';
import type { Scenario } from '../ontology';

interface ScenarioState {
  items: Scenario[];
  seq: number;
  /** Creates (no id) or updates a saved scenario draft. Sent scenarios are immutable. */
  save: (input: Pick<Scenario, 'sku' | 'strategyId' | 'proposedPrice' | 'ownerId'> & { id?: string | null }) => Scenario | null;
  markSent: (id: string, recommendationId: string) => boolean;
  reset: () => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  items: [],
  seq: 0,
  save: ({ id, ...rest }) => {
    const now = new Date().toISOString();
    const existing = id ? get().items.find((s) => s.id === id) : undefined;
    if (existing) {
      if (existing.recommendationId) return null;
      const next = { ...existing, ...rest, updatedAt: now };
      set((s) => ({ items: s.items.map((x) => (x.id === existing.id ? next : x)) }));
      return next;
    }
    const seq = get().seq + 1;
    const created: Scenario = { id: `SCN-${1000 + seq}`, ...rest, createdAt: now, updatedAt: now, recommendationId: null };
    set((s) => ({ items: [created, ...s.items], seq }));
    return created;
  },
  markSent: (id, recommendationId) => {
    const sc = get().items.find((s) => s.id === id);
    if (!sc || sc.recommendationId) return false;
    set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, recommendationId } : x)) }));
    return true;
  },
  reset: () => set({ items: [], seq: 0 }),
}));
