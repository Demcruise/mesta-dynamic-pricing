import { create } from 'zustand';
import type { Channel, DeploymentRecord } from '../ontology';

export const CHANNELS: Channel[] = ['pos', 'ecommerce', 'marketplace_a', 'marketplace_b'];

interface DeploymentState {
  records: DeploymentRecord[];
  hydrate: (records: DeploymentRecord[]) => void;
  /** Creates one pending record per channel; no-op for a recommendation that already has records. */
  createFor: (recommendationId: string, sku: string) => DeploymentRecord[];
  patch: (id: string, patch: Partial<DeploymentRecord>) => void;
  reset: () => void;
}

export const useDeploymentStore = create<DeploymentState>((set, get) => ({
  records: [],
  hydrate: (records) => set({ records }),
  createFor: (recommendationId, sku) => {
    if (get().records.some((r) => r.recommendationId === recommendationId)) return [];
    const now = new Date().toISOString();
    const created = CHANNELS.map<DeploymentRecord>((channel) => ({
      id: `DEP-${recommendationId}-${channel}`, recommendationId, sku, channel, status: 'pending',
      retryCount: 0, errorReason: null, updatedAt: now,
    }));
    set((s) => ({ records: [...s.records, ...created] }));
    return created;
  },
  patch: (id, p) =>
    set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...p, updatedAt: new Date().toISOString() } : r)) })),
  reset: () => set({ records: [] }),
}));
