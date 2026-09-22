'use client';

import { useSessionStore } from '../stores/session';
import { useProductCatalogStore } from '../stores/catalog';
import { useRecommendationStore } from '../stores/recommendation';
import { useRuleStore } from '../stores/rule';
import { useStrategyStore } from '../stores/strategy';
import { useAuditStore } from '../stores/audit';
import { useScenarioStore } from '../stores/scenario';
import { useDeploymentStore } from '../stores/deployment';
import { usePublishJobStore } from '../stores/publish';
import { useMonitoringStore } from '../stores/monitoring';
import { useDataSourceStore, useDelegationStore, useExperimentStore, useOverrideRequestStore } from '../stores/ops';
import { useNotificationStore } from '../stores/notification';
import { useUiStore } from '../stores/ui';
import { selectAuditForUser } from '../audit-scope';
import { inScope, inScopeSkus } from '../scope';
import { useMemo } from 'react';
import { keys, useItemQuery, useListQuery } from './core';

export * from './core';

export const useSkuList = () => useListQuery(keys.sku.list(), () => useProductCatalogStore.getState().products);

/** Products in the current Org → Region → Store scope (ui store). Unscoped = whole org. */
export const useScopedSkuList = () => {
  const scope = useUiStore((s) => s.scope);
  const all = useSkuList();
  const data = useMemo(() => all.data.filter((p) => inScope(p, scope)), [all.data, scope]);
  return { ...all, data };
};

/** In-scope SKU set — null when unscoped, so callers can skip filtering cheaply. */
export const useScopedSkuSet = (): Set<string> | null => {
  const scope = useUiStore((s) => s.scope);
  const products = useProductCatalogStore((s) => s.products);
  return useMemo(() => {
    if (!scope.region && !scope.store) return null;
    return new Set(products.filter((p) => inScope(p, scope)).map((p) => p.sku));
  }, [products, scope]);
};

/** Recommendations whose SKU is in scope — queue/overview/deploy consume this. */
export const useScopedRecommendations = () => {
  const scope = useUiStore((s) => s.scope);
  const all = useRecommendations();
  const products = useProductCatalogStore((s) => s.products);
  const map = useMemo(() => new Map(products.map((p) => [p.sku, p])), [products]);
  const data = useMemo(() => inScopeSkus(all.data, map, scope), [all.data, map, scope]);
  return { ...all, data };
};
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

export const useRules = () => useListQuery(keys.rule.list(), () => useRuleStore.getState().items);
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
  return useListQuery(keys.audit.list(user.userId, user.role), () => selectAuditForUser(useAuditStore.getState().events, user));
};

// Placeholders for later epics: keep the hook surface stable so pages never touch stores directly.
export const useScenarios = () => useListQuery(keys.scenario.list(), () => useScenarioStore.getState().items);
export const useScenario = (id: string) =>
  useItemQuery(['scenario', 'detail', id], () => useScenarioStore.getState().items.find((s) => s.id === id));
export const useDeploymentRecords = () => useListQuery(keys.deployment.list(), () => useDeploymentStore.getState().records);
export const usePublishJobs = () => useListQuery(['deployment', 'jobs'], () => usePublishJobStore.getState().jobs);
export const useAnomalies = () => useListQuery(keys.anomaly.list(), () => useMonitoringStore.getState().anomalies);
export const useOutcomes = () => useListQuery(['anomaly', 'outcomes'], () => useMonitoringStore.getState().outcomes);
export const usePriceEvents = () => useListQuery(['sku', 'priceEvents'], () => useProductCatalogStore.getState().priceEvents);
export const useNotifications = () => useListQuery(['notification', 'list'], () => useNotificationStore.getState().items);
export const useDataSources = () => useListQuery(['datasource', 'list'], () => useDataSourceStore.getState().sources);
export const useOverrideRequests = () => useListQuery(['override', 'list'], () => useOverrideRequestStore.getState().requests);
export const useExperiments = () => useListQuery(['experiment', 'list'], () => useExperimentStore.getState().items);
export const useDelegations = () => useListQuery(['delegation', 'list'], () => useDelegationStore.getState().grants);
export const useStrategyHistory = (id: string) => useListQuery(['strategy', 'history', id], () => useStrategyStore.getState().history[id] ?? []);
