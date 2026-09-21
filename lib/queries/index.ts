'use client';

import { useSessionStore } from '../stores/session';
import { useProductCatalogStore } from '../stores/catalog';
import { useRecommendationStore } from '../stores/recommendation';
import { useStrategyStore } from '../stores/strategy';
import { useAuditStore } from '../stores/audit';
import { can } from '../rbac';
import { keys, useItemQuery, useListQuery } from './core';

export * from './core';

export const useSkuList = () => useListQuery(keys.sku.list(), () => useProductCatalogStore.getState().products);
export const useSkuDetail = (sku: string) =>
  useItemQuery(keys.sku.detail(sku), () => useProductCatalogStore.getState().products.find((p) => p.sku === sku));

export const useCompetitorObservations = (sku: string) =>
  useListQuery(['sku', 'competitors', sku], () =>
    useProductCatalogStore.getState().competitors.filter((c) => c.sku === sku),
  );

export const useRecommendations = () =>
  useListQuery(keys.recommendation.list(), () => useRecommendationStore.getState().items);
export const useRecommendation = (id: string) =>
  useItemQuery(keys.recommendation.detail(id), () => useRecommendationStore.getState().items.find((r) => r.id === id));

export const useStrategies = () => useListQuery(keys.strategy.list(), () => useStrategyStore.getState().items);
export const useStrategy = (id: string) =>
  useItemQuery(keys.strategy.detail(id), () => useStrategyStore.getState().items.find((s) => s.id === id));

/**
 * Role filtering is enforced here in the selector, not in the UI:
 * manager/compliance see everything, analysts only their own actions or owned SKUs,
 * ops leads only deployment-related events.
 */
export const useAuditLog = () => {
  const user = useSessionStore((s) => s.user);
  return useListQuery(keys.audit.list(user.userId, user.role), () => {
    const all = useAuditStore.getState().events;
    if (can(user.role, 'audit.view_all')) return all;
    if (user.role === 'ops_lead') return all.filter((e) => e.entityType === 'deployment');
    return all.filter((e) => e.actorId === user.userId || (e.sku !== null && user.ownedSkuIds.includes(e.sku)));
  });
};

// Placeholders for later epics: keep the hook surface stable so pages never touch stores directly.
export const useScenarios = () => useListQuery(keys.scenario.list(), () => []);
export const useDeploymentRecords = () => useListQuery(keys.deployment.list(), () => []);
export const useAnomalies = () => useListQuery(keys.anomaly.list(), () => []);
