import { create } from 'zustand';
import type { DataSource, DelegationGrant, Experiment, ExperimentStatus, OverrideRequest, OverrideRequestStatus } from '../ontology';

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

interface ExperimentState {
  items: Experiment[];
  hydrate: (items: Experiment[]) => void;
  upsert: (e: Experiment) => void;
  /** Valid transitions: draft → ready/running/cancelled, ready → running, running → completed/concluded, completed → concluded, concluded → archived (MESTA-EXP-004). */
  transition: (id: string, to: ExperimentStatus) => boolean;
  reset: () => void;
}

const EXP_NEXT: Record<ExperimentStatus, ExperimentStatus[]> = {
  // 'ready' is an explicit review gate; direct start stays allowed for back-compat.
  draft: ['ready', 'running', 'cancelled'],
  ready: ['running', 'cancelled'],
  // 'completed' records that the run window closed; conclude stays direct for back-compat.
  running: ['completed', 'concluded', 'cancelled'],
  completed: ['concluded'],
  concluded: ['archived'],
  archived: [],
  cancelled: [],
};

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  items: [],
  hydrate: (items) => set({ items }),
  upsert: (e) => set((s) => {
    const i = s.items.findIndex((x) => x.id === e.id);
    return { items: i === -1 ? [e, ...s.items] : s.items.map((x) => (x.id === e.id ? e : x)) };
  }),
  transition: (id, to) => {
    const e = get().items.find((x) => x.id === id);
    if (!e || !EXP_NEXT[e.status].includes(to)) return false;
    const at = new Date().toISOString();
    set((s) => ({
      items: s.items.map((x) => (x.id === id ? {
        ...x, status: to,
        startedAt: to === 'running' ? at : x.startedAt,
        endedAt: to === 'completed' || to === 'concluded' || to === 'cancelled' ? at : x.endedAt,
      } : x)),
    }));
    return true;
  },
  reset: () => set({ items: [] }),
}));

interface DelegationState {
  grants: DelegationGrant[];
  add: (g: DelegationGrant) => void;
  revoke: (id: string) => boolean;
  reset: () => void;
}

export const useDelegationStore = create<DelegationState>((set, get) => ({
  grants: [],
  add: (g) => set((s) => ({ grants: [g, ...s.grants.filter((x) => x.toUserId !== g.toUserId)] })),
  revoke: (id) => {
    if (!get().grants.some((g) => g.id === id)) return false;
    set((s) => ({ grants: s.grants.filter((g) => g.id !== id) }));
    return true;
  },
  reset: () => set({ grants: [] }),
}));

/** Live grant for a user, honouring expiry. */
export function activeGrantFor(userId: string, now = Date.now()): DelegationGrant | null {
  return useDelegationStore.getState().grants.find((g) => g.toUserId === userId && new Date(g.until).getTime() > now) ?? null;
}
