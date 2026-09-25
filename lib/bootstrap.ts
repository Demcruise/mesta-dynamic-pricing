import {
  applySeedDeployments, generateAnomalies, generateAudit, generateCompetitors, generateDataSources,
  generateDeployments, generateExperiments, generateOverrideRequests, generateProducts, generateRecommendations,
  generateRules, generateStrategies,
} from './mock-data';
import { cancelAllDecisionTimers } from './actions/recommendation';
import { cancelAllSyncTimers } from './actions/ops';
import {
  useAuditStore, useCatalogSelectionStore, useDataSourceStore, useDelegationStore, useDeploymentStore,
  useExperimentStore, useMonitoringStore, useNotificationStore, useOverrideRequestStore, useProductCatalogStore,
  useRecommendationStore, useScenarioStore, useStrategyStore,
} from './stores';
import { usePublishJobStore } from './stores/publish';
import { useAuthStore } from './stores/auth';
import { useRuleStore } from './stores/rule';
import { expireStaleRecommendations } from './actions/recommendation';
import { promoteScheduledStrategies } from './actions/strategy';
import { expirePublishWindows } from './actions/deployment';

export const DEFAULT_PRODUCT_COUNT = 500;
export const STRESS_PRODUCT_COUNT = 5000;

let bootstrapped = false;

export interface BootstrapOptions {
  productCount?: number;
  force?: boolean;
}

/**
 * Seeds every store from ONE product list. Idempotent: a second call is a no-op
 * (unless `force`), and every hydrate() replaces rather than appends.
 */
export function bootstrapMestaData({ productCount = DEFAULT_PRODUCT_COUNT, force = false }: BootstrapOptions = {}) {
  if (bootstrapped && !force) return;
  const products = generateProducts(productCount);
  const generated = generateRecommendations(products, Math.min(60, Math.max(10, Math.floor(productCount / 8))));
  const approved = generated.filter((r) => r.status === 'approved').length;
  const seeded = applySeedDeployments(products, generated, Math.min(6, Math.ceil(approved / 2)));
  const recs = seeded.recs;
  const expSeed = generateExperiments(seeded.products);
  useProductCatalogStore.getState().hydrate(seeded.products, generateCompetitors(seeded.products), [...seeded.priceEvents, ...expSeed.priceEvents]);
  useRecommendationStore.getState().hydrate(recs);
  const deploymentSeed = generateDeployments(recs);
  useDeploymentStore.getState().hydrate(deploymentSeed.records);
  usePublishJobStore.getState().hydrate(deploymentSeed.jobs);
  useMonitoringStore.getState().hydrate(generateAnomalies(seeded.products), [...seeded.outcomes, ...expSeed.outcomes]);
  useExperimentStore.getState().hydrate(expSeed.experiments);
  useDelegationStore.getState().reset();
  useStrategyStore.getState().hydrate(generateStrategies());
  useRuleStore.getState().hydrate(generateRules());
  // Auth events (sign-in happens before seeding) are part of the same audit trail (AUTH-20).
  useAuditStore.getState().hydrate([...useAuthStore.getState().events, ...generateAudit(recs)].sort((x, y) => y.timestamp.localeCompare(x.timestamp)));
  useDataSourceStore.getState().hydrate(generateDataSources());
  useOverrideRequestStore.getState().hydrate(generateOverrideRequests(seeded.products));
  expireStaleRecommendations();
  promoteScheduledStrategies();
  expirePublishWindows();
  useNotificationStore.getState().reset();
  useScenarioStore.getState().reset();
  cancelAllDecisionTimers();
  cancelAllSyncTimers();
  useCatalogSelectionStore.getState().clear();
  bootstrapped = true;
}

export function resetMestaData(opts: BootstrapOptions = {}) {
  bootstrapped = false;
  bootstrapMestaData({ ...opts, force: true });
}

export function isBootstrapped() {
  return bootstrapped;
}
