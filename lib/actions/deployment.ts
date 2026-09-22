import type { DeploymentRecord, PublishJob, Recommendation, UserSession } from '../ontology';
import { checkPrice } from '../guardrails';
import { project } from '../projection';
import { can } from '../rbac';
import {
  useAuditStore, useDeploymentStore, useMonitoringStore, useNotificationStore, useProductCatalogStore,
  usePublishJobStore, useRecommendationStore, useStrategyStore,
} from '../stores';
import { jobStatusOf } from '../stores/publish';
import { track } from '../telemetry';
import { fail, ok } from './result';

/** Simulated channel round-trip. */
export const DEPLOY_LATENCY_MS = 700;
/** Competitor observations older than this warn (not block) at publish preflight. */
export const STALE_OBS_MS = 48 * 3_600_000;

const records = () => useDeploymentStore.getState().records;
const jobs = () => usePublishJobStore.getState().jobs;
const findRecord = (id: string) => records().find((r) => r.id === id);
const findRec = (id: string) => useRecommendationStore.getState().items.find((r) => r.id === id);
const findJob = (id: string) => jobs().find((j) => j.id === id);

/** Deterministic demo failure: some channels fail their first attempt, retries succeed. */
export function willFail(r: Pick<DeploymentRecord, 'recommendationId' | 'channel' | 'retryCount'>): boolean {
  if (r.retryCount > 0) return false;
  let h = 0;
  for (const c of `${r.recommendationId}:${r.channel}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 4 === 0;
}

/** Keep the job's derived status in sync with its channel records. */
function syncJob(jobId: string) {
  const job = findJob(jobId);
  if (!job) return;
  const next = jobStatusOf(job, records());
  if (next !== job.status) usePublishJobStore.getState().patch(jobId, { status: next });
}

export interface PreflightCheck {
  key: 'approval' | 'guardrails' | 'freshness' | 'duplicate';
  /** 'block' prevents publish; 'warn' is surfaced but the job may proceed. */
  severity: 'block' | 'warn';
  ok: boolean;
  detail?: string;
}

/** Pre-publish checklist — every check is derivable from stored data, nothing invented. */
export function preflight(recId: string): PreflightCheck[] {
  const rec = findRec(recId);
  const product = rec && useProductCatalogStore.getState().products.find((p) => p.sku === rec.sku);
  const strategy = rec?.strategyId ? useStrategyStore.getState().items.find((s) => s.id === rec.strategyId) ?? null : null;
  const latestObs = rec
    ? useProductCatalogStore.getState().competitors.filter((c) => c.sku === rec.sku).map((c) => c.observedAt).sort().at(-1)
    : undefined;
  const obsAge = latestObs ? Date.now() - new Date(latestObs).getTime() : Number.POSITIVE_INFINITY;
  const active = jobs().some(
    (j) => j.recommendationId === recId && ['scheduled', 'publishing', 'partial', 'failed'].includes(jobStatusOf(j, records())),
  );
  return [
    { key: 'approval', severity: 'block', ok: !!rec && (rec.status === 'approved' || rec.status === 'adjusted') && !rec.deployed },
    { key: 'duplicate', severity: 'block', ok: !active },
    {
      key: 'guardrails', severity: 'warn',
      ok: !!product && !!rec && checkPrice(product, strategy, rec.proposedPrice) === 'ok',
    },
    { key: 'freshness', severity: 'warn', ok: Number.isFinite(obsAge) && obsAge <= STALE_OBS_MS },
  ];
}

function finalize(recId: string, user: UserSession) {
  const rec = findRec(recId);
  if (!rec || rec.deployed) return;
  const cat = useProductCatalogStore.getState();
  const product = cat.products.find((p) => p.sku === rec.sku);
  if (!product) return;
  const before = cat.priceEvents.length;
  if (!cat.applyPrice(rec.sku, rec.proposedPrice, 'deployment', rec.id)) {
    for (const r of records().filter((x) => x.recommendationId === recId && (x.status === 'pending' || x.status === 'in_flight'))) {
      useDeploymentStore.getState().patch(r.id, { status: 'failed', errorReason: 'Price outside product bounds' });
      syncJob(r.jobId);
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
  syncJob(rec.jobId);
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
      syncJob(rec.jobId);
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
    syncJob(rec.jobId);
    const all = records().filter((r) => r.recommendationId === rec.recommendationId);
    if (all.every((r) => r.status === 'synced')) finalize(rec.recommendationId, user);
  }, DEPLOY_LATENCY_MS);
  return ok();
}

/**
 * Creates the publish job for a recommendation. Immediate jobs start 'publishing' and
 * run every channel; scheduled jobs stay 'scheduled' until runScheduledJob promotes them
 * (the honest substitute for a backend clock in a frontend-only demo).
 */
export function createPublishJob(user: UserSession, recommendationId: string, opts: { scheduledFor?: string } = {}) {
  if (!can(user.role, 'deployment.execute')) return fail('forbidden');
  const rec = findRec(recommendationId);
  if (!rec) return fail('not_found');
  const checks = preflight(recommendationId);
  if (checks.some((c) => c.severity === 'block' && !c.ok)) return fail('preflight_blocked');
  const jobId = `PJ-${recommendationId}-${Date.now().toString(36)}`;
  const scheduled = opts.scheduledFor ? new Date(opts.scheduledFor).toISOString() : null;
  const now = new Date().toISOString();
  const job: PublishJob = {
    id: jobId, recommendationId, sku: rec.sku,
    status: scheduled ? 'scheduled' : 'publishing',
    scheduledFor: scheduled, createdBy: user.userId, createdAt: now, updatedAt: now,
  };
  usePublishJobStore.getState().add(job);
  const created = useDeploymentStore.getState().createFor(recommendationId, rec.sku, jobId);
  track('deployment_triggered', { recommendationId, scheduled: !!scheduled });
  if (scheduled) {
    useAuditStore.getState().record({
      type: 'publish_scheduled', actorId: user.userId, actorRole: user.role, entityType: 'deployment',
      entityId: recommendationId, sku: rec.sku, source: 'ui', note: scheduled,
    });
    return { ok: true as const, job };
  }
  created.forEach((r) => run(r.id, user));
  return { ok: true as const, job };
}

/** Promotes a scheduled job — the manual stand-in for the scheduler. */
export function runScheduledJob(user: UserSession, jobId: string) {
  if (!can(user.role, 'deployment.execute')) return fail('forbidden');
  const job = findJob(jobId);
  if (!job) return fail('not_found');
  if (job.status !== 'scheduled') return fail('locked');
  usePublishJobStore.getState().patch(jobId, { status: 'publishing' });
  for (const r of records().filter((x) => x.jobId === jobId && x.status === 'pending')) run(r.id, user);
  return ok();
}

export function cancelPublishJob(user: UserSession, jobId: string) {
  if (!can(user.role, 'deployment.execute')) return fail('forbidden');
  const job = findJob(jobId);
  if (!job) return fail('not_found');
  if (job.status !== 'scheduled') return fail('locked');
  for (const r of records().filter((x) => x.jobId === jobId && x.status === 'pending')) {
    useDeploymentStore.getState().patch(r.id, { status: 'cancelled' });
  }
  usePublishJobStore.getState().patch(jobId, { status: 'cancelled' });
  useAuditStore.getState().record({
    type: 'publish_cancelled', actorId: user.userId, actorRole: user.role, entityType: 'deployment',
    entityId: job.recommendationId, sku: job.sku, source: 'ui', note: null,
  });
  return ok();
}

/**
 * Rolls a published/partial job back: restores the pre-deploy price, rolls synced
 * channels back, cancels anything still queued. Restoring outside current bounds
 * fails closed — the job keeps its records and returns 'restore_bounds'.
 */
export function rollbackPublishJob(user: UserSession, jobId: string) {
  if (!can(user.role, 'deployment.execute')) return fail('forbidden');
  const job = findJob(jobId);
  if (!job) return fail('not_found');
  const status = jobStatusOf(job, records());
  if (status !== 'published' && status !== 'partial') return fail('not_rollbackable');
  const rec = findRec(job.recommendationId);
  if (!rec) return fail('not_found');
  const cat = useProductCatalogStore.getState();
  const product = cat.products.find((p) => p.sku === rec.sku);
  if (!product) return fail('not_found');
  const deployedPrice = product.price;
  if (product.price === rec.proposedPrice && !cat.applyPrice(rec.sku, rec.currentPrice, 'deployment', rec.id)) {
    return fail('restore_bounds');
  }
  for (const r of records().filter((x) => x.jobId === jobId)) {
    useDeploymentStore.getState().patch(r.id, {
      status: r.status === 'synced' ? 'rolled_back' : 'cancelled',
      errorReason: r.status === 'synced' ? null : r.errorReason,
    });
  }
  usePublishJobStore.getState().patch(jobId, { status: 'rolled_back' });
  useRecommendationStore.getState().markUndeployed(rec.id);
  useAuditStore.getState().record({
    type: 'deployment_rollback', actorId: user.userId, actorRole: user.role, entityType: 'deployment',
    entityId: rec.id, sku: rec.sku, source: 'ui', note: jobId,
    snapshot: { oldPrice: deployedPrice, newPrice: rec.currentPrice },
  });
  useNotificationStore.getState().push({
    targetRole: 'all', groupKey: 'deployment_rollback', messageKey: 'common.notify.rolledBack',
    params: { sku: rec.sku }, href: '/deployment',
  });
  track('deployment_rollback', { jobId });
  return ok();
}

/** Back-compat wrapper: publish immediately (job + channel fan-out in one call). */
export function triggerDeployment(user: UserSession, recommendationId: string) {
  return createPublishJob(user, recommendationId);
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

/** Re-exported for the Publish Center: the live status of a job given the record store. */
export function liveJobStatus(job: PublishJob): PublishJob['status'] {
  return jobStatusOf(job, records());
}
