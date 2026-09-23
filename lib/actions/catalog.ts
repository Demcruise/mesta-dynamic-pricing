import { checkPrice, governingStrategy } from '../guardrails';
import type { Product, UserSession } from '../ontology';
import { can } from '../rbac';
import { useAuditStore, useOverrideRequestStore, useProductCatalogStore, useStrategyStore } from '../stores';
import { fail, ok, type Result } from './result';
import { track } from '../telemetry';

export interface BulkEditRow {
  sku: string;
  name: string;
  currentPrice: number;
  newPrice: number;
  check: ReturnType<typeof checkPrice>;
}

/** Previews a uniform delta% across SKUs — every row is guardrail-checked up front. */
export function bulkPricePreview(skus: string[], deltaPct: number): BulkEditRow[] {
  const cat = useProductCatalogStore.getState();
  const strategies = useStrategyStore.getState().items;
  return skus.map((sku) => {
    const p = cat.products.find((x) => x.sku === sku);
    if (!p) return { sku, name: sku, currentPrice: 0, newPrice: 0, check: 'invalid' as const };
    const newPrice = Math.round((p.price * (1 + deltaPct / 100)) / 100) * 100;
    return { sku, name: p.name, currentPrice: p.price, newPrice, check: checkPrice(p, governingStrategy(p, strategies), newPrice) };
  });
}

/**
 * Applies a bulk price edit (§17 bulk ops). Managers apply passing rows directly with
 * price events + audit; analysts raise one override request per passing row instead.
 * Failing rows are never touched — the caller shows the preview first.
 */
export function bulkPriceEdit(user: UserSession, skus: string[], deltaPct: number, reason: string) {
  if (!can(user.role, 'catalog.override_price')) return fail('forbidden');
  if (!reason.trim()) return fail('note_required');
  const rows = bulkPricePreview(skus, deltaPct);
  const cat = useProductCatalogStore.getState();
  const asManager = user.role === 'manager';
  let applied = 0;
  let requested = 0;
  const blocked: string[] = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    if (row.check !== 'ok') { blocked.push(row.sku); continue; }
    if (asManager) {
      if (!cat.applyPrice(row.sku, row.newPrice, 'manual_override')) { blocked.push(row.sku); continue; }
      applied++;
      useAuditStore.getState().record({
        type: 'manual_override', actorId: user.userId, actorRole: user.role, entityType: 'product', entityId: row.sku,
        sku: row.sku, source: 'ui', note: `bulk edit ${deltaPct}%: ${reason}`,
        snapshot: { oldPrice: row.currentPrice, newPrice: row.newPrice },
      });
    } else {
      useOverrideRequestStore.getState().add({
        id: `OVR-${Date.now().toString(36)}-${row.sku}`, sku: row.sku, requestedPrice: row.newPrice,
        reason: `bulk edit ${deltaPct}%: ${reason}`, status: 'pending', requestedBy: user.userId,
        createdAt: now, decidedBy: null, decidedAt: null, decisionNote: null,
      });
      useAuditStore.getState().record({
        type: 'override_request', actorId: user.userId, actorRole: user.role, entityType: 'override',
        entityId: row.sku, sku: row.sku, source: 'ui', note: `bulk edit ${deltaPct}%`,
        snapshot: { oldPrice: row.currentPrice, newPrice: row.newPrice },
      });
      requested++;
    }
  }
  track('bulk_price_edit', { n: skus.length, applied, requested });
  return { ok: true as const, applied, requested, blocked };
}

/** §17 assign: adds SKUs to a strategy's governed set (deduped), audited per strategy. */
export function bulkAssignStrategy(user: UserSession, strategyId: string, skus: string[]): Result {
  if (!can(user.role, 'catalog.apply_strategy')) return fail('forbidden');
  const store = useStrategyStore.getState();
  const s = store.items.find((x) => x.id === strategyId);
  if (!s) return fail('not_found');
  const merged = [...new Set([...s.skuIds, ...skus])];
  if (merged.length === s.skuIds.length) return ok();
  store.upsert({ ...s, skuIds: merged, updatedAt: new Date().toISOString() });
  useAuditStore.getState().record({
    type: 'strategy_save', actorId: user.userId, actorRole: user.role, entityType: 'strategy',
    entityId: strategyId, sku: null, source: 'ui', note: `bulk assign ${skus.length} SKU(s)`,
  });
  track('bulk_assign_strategy', { strategyId, n: skus.length });
  return ok();
}
