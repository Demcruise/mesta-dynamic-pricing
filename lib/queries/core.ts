'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useDevStore } from '../stores/dev';

/** Query key convention: [domain, kind, ...params]. */
export const keys = {
  sku: { all: ['sku'] as const, list: () => ['sku', 'list'] as const, detail: (sku: string) => ['sku', 'detail', sku] as const },
  recommendation: { all: ['recommendation'] as const, list: () => ['recommendation', 'list'] as const, detail: (id: string) => ['recommendation', 'detail', id] as const },
  strategy: { all: ['strategy'] as const, list: () => ['strategy', 'list'] as const, detail: (id: string) => ['strategy', 'detail', id] as const },
  scenario: { all: ['scenario'] as const, list: () => ['scenario', 'list'] as const },
  deployment: { all: ['deployment'] as const, list: () => ['deployment', 'list'] as const },
  audit: { all: ['audit'] as const, list: (actor: string, role: string) => ['audit', 'list', actor, role] as const },
  anomaly: { all: ['anomaly'] as const, list: () => ['anomaly', 'list'] as const },
};

export interface ListResult<T> {
  data: T[];
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface ItemResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean; // not found
  error: Error | null;
  refetch: () => void;
}

/** Store-backed read that can be forced to fail for the demo error state. */
export function guard<T>(read: () => T): T {
  if (useDevStore.getState().failQueries) throw new Error('Simulated query failure');
  return read();
}

export function useListQuery<T>(queryKey: readonly unknown[], read: () => T[]): ListResult<T> {
  const q = useQuery({ queryKey, queryFn: () => guard(read), retry: false, staleTime: Infinity });
  const data = q.data ?? [];
  return {
    data,
    isLoading: q.isLoading,
    isError: q.isError,
    isEmpty: !q.isLoading && !q.isError && data.length === 0,
    error: q.error,
    refetch: () => void q.refetch(),
  };
}

export function useItemQuery<T>(queryKey: readonly unknown[], read: () => T | undefined): ItemResult<T> {
  const q = useQuery({ queryKey, queryFn: () => guard(() => read() ?? null), retry: false, staleTime: Infinity });
  const data = q.data ?? undefined;
  return {
    data,
    isLoading: q.isLoading,
    isError: q.isError,
    isEmpty: !q.isLoading && !q.isError && data === undefined,
    error: q.error,
    refetch: () => void q.refetch(),
  };
}

export type MestaDomain = 'sku' | 'recommendation' | 'strategy' | 'scenario' | 'deployment' | 'audit' | 'anomaly';

export function invalidateDomains(qc: QueryClient, domains: MestaDomain[]) {
  return Promise.all(domains.map((d) => qc.invalidateQueries({ queryKey: [d] })));
}

/** Call after a local write action to refresh dependent domains. */
export function useInvalidateMesta() {
  const qc = useQueryClient();
  return (...domains: MestaDomain[]) => invalidateDomains(qc, domains);
}

export { useMutation };
