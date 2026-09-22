import type { DeploymentRecord, UserSession } from '../ontology';
import { project } from '../projection';
import { can } from '../rbac';
import {
  useAuditStore, useDeploymentStore, useMonitoringStore, useNotificationStore, useProductCatalogStore,
  useRecommendationStore,
} from '../stores';
import { track } from '../telemetry';
import { fail, ok } from './result';

/** Simulated channel round-trip. */
export const DEPLOY_LATENCY_MS = 700;

const records = () => useDeploymentStore.getState().records;
const findRecord = (id: string) => records().find((r) => r.id === id);

/** Deterministic demo failure: some channels fail their first attempt, retries succeed. */
export function willFail(r: Pick<DeploymentRecord, 'recommendationId' | 'channel' | 'retryCount'>): boolean {
  if (r.retryCount > 0) return false;
  let h = 0;
  for (const c of `${r.recommendationId}:${r.channel}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 4 === 0;
}

function finalize(recId: string, user: UserSession) {
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recId);
  if (!rec || rec.deployed) return;
  const cat = useProductCatalogStore.getState();
  const product = cat.products.find((p) => p.sku === rec.sku);
  if (!product) return;
  const before = cat.priceEvents.length;
  if (!cat.applyPrice(rec.sku, rec.proposedPrice, 'deployment', rec.id)) {
    for (const r of records().filter((x) => x.recommendationId === recId)) {
      useDeploymentStore.getState().patch(r.id, { status: 'failed', errorReason: 'Price outside product bounds' });
    }
    return;
  }
  const pe = useProductCatalogStore.getState().priceEvents[before];
  useRecommendationStore.getState().markDeployed(recId);
  const proj = project(product, rec.proposedPrice);
  const k = 0.9 + ((rec.confidence % 20) / 100);
  useMonitoringStore.getState().addOutcome({
    id: `OUT-${recId}`, sku: rec.sku, category: product.category, recommendationId: recId, priceEventId: pe?.id ?? null,
    forecast: { units: proj.units, revenue: proj.revenue, margin: proj.grossMargin },
    actual: { units: proj.units * k, revenue: proj.revenue * k, margin: proj.grossMargin * k }, at: new Date().toISOString(),
  });
  useAuditStore.getState().record({
    type: 'deployment_success', actorId: user.userId, actorRole: user.role, entityType: 'deployment', entityId: recId,
    sku: rec.sku, source: 'ui', note: null, snapshot: { oldPrice: product.price, newPrice: rec.proposedPrice },
  });
  useNotificationStore.getState().push({
    targetRole: 'all', groupKey: 'deployment_success', messageKey: 'common.notify.deployed', params: { sku: rec.sku }, href: '/deployment',
  });
}

function run(id: string, user: UserSession) {
  const rec = findRecord(id);
  if (!rec || (rec.status !== 'pending' && rec.status !== 'failed')) return fail('locked');
  const isRetry = rec.status === 'failed';
  const attempt = { ...rec, retryCount: isRetry ? rec.retryCount + 1 : rec.retryCount };
  useDeploymentStore.getState().patch(id, { status: 'in_flight', retryCount: attempt.retryCount, errorReason: null });
  if (isRetry) {
    useAuditStore.getState().record({
      type: 'deployment_retry', actorId: user.userId, actorRole: user.role, entityType: 'deployment',
      entityId: rec.recommendationId, sku: rec.sku, source: 'ui', note: rec.channel,
    });
  }
  setTimeout(() => {
    if (!findRecord(id)) return;
    if (willFail(attempt)) {
      useDeploymentStore.getState().patch(id, { status: 'failed', errorReason: 'Channel API timeout' });
      useAuditStore.getState().record({
        type: 'deployment_failure', actorId: user.userId, actorRole: user.role, entityType: 'deployment',
        entityId: rec.recommendationId, sku: rec.sku, source: 'system', note: rec.channel,
      });
      useNotificationStore.getState().push({
        targetRole: 'ops_lead', groupKey: 'deployment_failed', messageKey: 'common.notify.deployFailed',
        params: { sku: rec.sku, channel: rec.channel }, href: '/deployment?status=failed',
      });
      return;
    }
    useDeploymentStore.getState().patch(id, { status: 'synced' });
    const all = records().filter((r) => r.recommendationId === rec.recommendationId);
    if (all.every((r) => r.status === 'synced')) finalize(rec.recommendationId, user);
  }, DEPLOY_LATENCY_MS);
  return ok();
}

/** Ops lead only: fan a recommendation out to every channel. */
export function triggerDeployment(user: UserSession, recommendationId: string) {
  if (!can(user.role, 'deployment.execute')) return fail('forbidden');
  const rec = useRecommendationStore.getState().items.find((r) => r.id === recommendationId);
  if (!rec) return fail('not_found');
  if ((rec.status !== 'approved' && rec.status !== 'adjusted') || rec.deployed) return fail('not_deployable');
  useDeploymentStore.getState().createFor(recommendationId, rec.sku);
  const targets = records().filter((r) => r.recommendationId === recommendationId && r.status === 'pending');
  track('deployment_triggered', { recommendationId });
  targets.forEach((r) => run(r.id, user));
  return ok();
}

export function retryDeployment(user: UserSession, recordId: string) {
  if (!can(user.role, 'deployment.execute')) return fail('forbidden');
  const r = findRecord(recordId);
  if (!r) return fail('not_found');
  if (r.status !== 'failed') return fail('locked');
  return run(recordId, user);
}

/** Recommendations approved (or adjusted) that have not gone live yet. */
export function awaitingDeployment() {
  return useRecommendationStore.getState().items.filter((r) => (r.status === 'approved' || r.status === 'adjusted') && !r.deployed);
}
