import { create } from 'zustand';
import type { DataSource, OverrideRequest, OverrideRequestStatus } from '../ontology';

interface DataSourceState {
  sources: DataSource[];
  hydrate: (sources: DataSource[]) => void;
  patch: (id: string, patch: Partial<DataSource>) => void;
  reset: () => void;
}

export const useDataSourceStore = create<DataSourceState>((set) => ({
  sources: [],
  hydrate: (sources) => set({ sources }),
  patch: (id, p) => set((s) => ({ sources: s.sources.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  reset: () => set({ sources: [] }),
}));

interface OverrideRequestState {
  requests: OverrideRequest[];
  hydrate: (requests: OverrideRequest[]) => void;
  add: (r: OverrideRequest) => void;
  /** Transitions a pending request; returns false on invalid state. */
  decide: (id: string, status: Exclude<OverrideRequestStatus, 'pending'>, by: string, note: string | null) => boolean;
  reset: () => void;
}

export const useOverrideRequestStore = create<OverrideRequestState>((set, get) => ({
  requests: [],
  hydrate: (requests) => set({ requests }),
  add: (r) => set((s) => ({ requests: [r, ...s.requests] })),
  decide: (id, status, by, note) => {
    const r = get().requests.find((x) => x.id === id);
    if (!r || r.status !== 'pending') return false;
    set((s) => ({
      requests: s.requests.map((x) =>
        x.id === id ? { ...x, status, decidedBy: by, decidedAt: new Date().toISOString(), decisionNote: note } : x,
      ),
    }));
    return true;
  },
  reset: () => set({ requests: [] }),
}));
