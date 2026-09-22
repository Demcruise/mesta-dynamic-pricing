import { create } from 'zustand';
import type { Rule } from '../ontology';

interface RuleState {
  items: Rule[];
  hydrate: (items: Rule[]) => void;
  upsert: (rule: Rule) => void;
  patch: (id: string, patch: Partial<Rule>) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useRuleStore = create<RuleState>((set) => ({
  items: [],
  hydrate: (items) => set({ items }),
  upsert: (rule) =>
    set((s) => ({ items: s.items.some((r) => r.id === rule.id) ? s.items.map((r) => (r.id === rule.id ? rule : r)) : [rule, ...s.items] })),
  patch: (id, p) => set((s) => ({ items: s.items.map((r) => (r.id === id ? { ...r, ...p, updatedAt: new Date().toISOString() } : r)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((r) => r.id !== id) })),
  reset: () => set({ items: [] }),
}));
