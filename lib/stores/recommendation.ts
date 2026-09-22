import { create } from 'zustand';
import type { Recommendation, RecommendationStatus } from '../ontology';

export type TransitionResult = { ok: true } | { ok: false; error: string };

const ALLOWED: Record<RecommendationStatus, RecommendationStatus[]> = {
  pending: ['approved', 'rejected', 'adjusted'],
  approved: [],
  rejected: [],
  adjusted: [],
};

export function canTransition(from: RecommendationStatus, to: RecommendationStatus) {
  return ALLOWED[from].includes(to);
}

interface RecommendationState {
  items: Recommendation[];
  hydrate: (items: Recommendation[]) => void;
  add: (r: Recommendation) => void;
  decide: (id: string, to: Exclude<RecommendationStatus, 'pending'>, opts?: { note?: string; proposedPrice?: number }) => TransitionResult;
  markDeployed: (id: string) => TransitionResult;
  reset: () => void;
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  items: [],
  hydrate: (items) => set({ items }),
  add: (r) => set((s) => (s.items.some((x) => x.id === r.id) ? s : { items: [r, ...s.items] })),
  decide: (id, to, opts = {}) => {
    const rec = get().items.find((x) => x.id === id);
    if (!rec) return { ok: false, error: 'not_found' };
    if (!canTransition(rec.status, to)) return { ok: false, error: `invalid_transition:${rec.status}->${to}` };
    if ((to === 'rejected' || to === 'adjusted') && !opts.note?.trim()) return { ok: false, error: 'note_required' };
    if (to === 'adjusted' && opts.proposedPrice == null) return { ok: false, error: 'price_required' };
    set((s) => ({
      items: s.items.map((x) =>
        x.id === id
          ? {
              ...x,
              status: to,
              decidedAt: new Date().toISOString(),
              decisionNote: opts.note?.trim() ?? null,
              proposedPrice: to === 'adjusted' ? (opts.proposedPrice as number) : x.proposedPrice,
            }
          : x,
      ),
    }));
    return { ok: true };
  },
  markDeployed: (id) => {
    const rec = get().items.find((x) => x.id === id);
    if (!rec) return { ok: false, error: 'not_found' };
    if (rec.status !== 'approved' && rec.status !== 'adjusted') return { ok: false, error: 'not_approved' };
    set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, deployed: true } : x)) }));
    return { ok: true };
  },
  reset: () => set({ items: [] }),
}));
