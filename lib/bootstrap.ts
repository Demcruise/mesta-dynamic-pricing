import {
  applySeedDeployments, generateAnomalies, generateAudit, generateCompetitors, generateDeployments,
  generateProducts, generateRecommendations, generateStrategies,
} from './mock-data';
import { cancelAllDecisionTimers } from './actions/recommendation';
import {
  useAuditStore, useCatalogSelectionStore, useDeploymentStore, useMonitoringStore, useNotificationStore,
  useProductCatalogStore, useRecommendationStore, useScenarioStore, useStrategyStore,
} from './stores';

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
  useProductCatalogStore.getState().hydrate(seeded.products, generateCompetitors(seeded.products), seeded.priceEvents);
  useRecommendationStore.getState().hydrate(recs);
  useDeploymentStore.getState().hydrate(generateDeployments(recs));
  useMonitoringStore.getState().hydrate(generateAnomalies(seeded.products), seeded.outcomes);
  useStrategyStore.getState().hydrate(generateStrategies());
  useAuditStore.getState().hydrate(generateAudit(recs));
  useNotificationStore.getState().reset();
  useScenarioStore.getState().reset();
  cancelAllDecisionTimers();
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
