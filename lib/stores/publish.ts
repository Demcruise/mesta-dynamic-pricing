import { create } from 'zustand';
import type { DeploymentRecord, PublishJob, PublishJobStatus } from '../ontology';

interface PublishJobState {
  jobs: PublishJob[];
  hydrate: (jobs: PublishJob[]) => void;
  add: (j: PublishJob) => void;
  patch: (id: string, patch: Partial<PublishJob>) => void;
  reset: () => void;
}

export const usePublishJobStore = create<PublishJobState>((set) => ({
  jobs: [],
  hydrate: (jobs) => set({ jobs }),
  add: (j) => set((s) => ({ jobs: [j, ...s.jobs] })),
  patch: (id, p) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p, updatedAt: new Date().toISOString() } : j)) })),
  reset: () => set({ jobs: [] }),
}));

/**
 * Derived job status — terminal states (cancelled/rolled_back) are stored, everything
 * else is computed from the channel records so the job can never disagree with them.
 * 'scheduled' survives only while no record has progressed.
 */
export function jobStatusOf(job: PublishJob, records: DeploymentRecord[]): PublishJobStatus {
  if (job.status === 'cancelled' || job.status === 'rolled_back') return job.status;
  const rs = records.filter((r) => r.jobId === job.id);
  if (rs.length === 0) return job.status;
  if (rs.some((r) => r.status === 'in_flight')) return 'publishing';
  if (rs.every((r) => r.status === 'synced')) return 'published';
  if (rs.every((r) => r.status === 'failed' || r.status === 'cancelled')) return 'failed';
  if (rs.some((r) => r.status === 'failed' || r.status === 'rolled_back')) return 'partial';
  return job.status === 'scheduled' ? 'scheduled' : 'publishing';
}
