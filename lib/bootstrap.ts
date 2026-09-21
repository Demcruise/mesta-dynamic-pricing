import {
  generateAudit, generateCompetitors, generateProducts, generateRecommendations, generateStrategies,
} from './mock-data';
import {
  useAuditStore, useCatalogSelectionStore, useNotificationStore, useProductCatalogStore,
  useRecommendationStore, useStrategyStore,
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
  const recs = generateRecommendations(products, Math.min(60, Math.max(10, Math.floor(productCount / 8))));
  useProductCatalogStore.getState().hydrate(products, generateCompetitors(products));
  useRecommendationStore.getState().hydrate(recs);
  useStrategyStore.getState().hydrate(generateStrategies());
  useAuditStore.getState().hydrate(generateAudit(recs));
  useNotificationStore.getState().reset();
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
