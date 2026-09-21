import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeedbackEntry } from '../ontology';

interface FeedbackState {
  items: FeedbackEntry[];
  add: (message: string, page: string) => void;
}

/** Frontend-only feedback inbox kept in local storage. */
export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set) => ({
      items: [],
      add: (message, page) =>
        set((s) => ({ items: [...s.items, { id: `FB-${s.items.length + 1}`, message, page, at: new Date().toISOString() }] })),
    }),
    { name: 'mesta-feedback', skipHydration: true },
  ),
);
