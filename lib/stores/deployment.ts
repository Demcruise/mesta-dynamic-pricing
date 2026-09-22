import { create } from 'zustand';
import type { Channel, DeploymentRecord } from '../ontology';

export const CHANNELS: Channel[] = ['pos', 'ecommerce', 'marketplace_a', 'marketplace_b'];

interface DeploymentState {
  records: DeploymentRecord[];
  hydrate: (records: DeploymentRecord[]) => void;
  /** Creates one pending record per channel under a publish job; no-op for a job that already has records. */
  createFor: (recommendationId: string, sku: string, jobId: string) => DeploymentRecord[];
  patch: (id: string, patch: Partial<DeploymentRecord>) => void;
  reset: () => void;
}

export const useDeploymentStore = create<DeploymentState>((set, get) => ({
  records: [],
  hydrate: (records) => set({ records }),
  createFor: (recommendationId, sku, jobId) => {
    if (get().records.some((r) => r.jobId === jobId)) return [];
    const now = new Date().toISOString();
    const created = CHANNELS.map<DeploymentRecord>((channel) => ({
      id: `DEP-${recommendationId}-${channel}`, recommendationId, jobId, sku, channel, status: 'pending',
      retryCount: 0, errorReason: null, updatedAt: now,
    }));
    set((s) => ({ records: [...s.records, ...created] }));
    return created;
  },
  patch: (id, p) =>
    set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...p, updatedAt: new Date().toISOString() } : r)) })),
  reset: () => set({ records: [] }),
}));
