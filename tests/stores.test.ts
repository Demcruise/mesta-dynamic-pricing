import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapMestaData, resetMestaData } from '@/lib/bootstrap';
import { PERMISSIONS, ROLES, can, type Action } from '@/lib/rbac';
import {
  groupNotifications, useNotificationStore, useProductCatalogStore, useRecommendationStore, useStrategyStore,
} from '@/lib/stores';

beforeEach(() => resetMestaData({ productCount: 100 }));

describe('bootstrap', () => {
  it('is idempotent: second call does not reseed or duplicate', () => {
    const before = useProductCatalogStore.getState().products;
    const recCount = useRecommendationStore.getState().items.length;
    bootstrapMestaData({ productCount: 100 });
    bootstrapMestaData({ productCount: 100 });
    expect(useProductCatalogStore.getState().products).toBe(before);
    expect(useProductCatalogStore.getState().products).toHaveLength(100);
    expect(useRecommendationStore.getState().items).toHaveLength(recCount);
  });

  it('hydrate replaces rather than appends', () => {
    const { products, competitors, hydrate } = useProductCatalogStore.getState();
    hydrate(products, competitors);
    hydrate(products, competitors);
    expect(useProductCatalogStore.getState().products).toHaveLength(100);
  });

  it('uses one SKU list: every recommendation SKU exists in catalog with same price', () => {
    const skus = new Map(useProductCatalogStore.getState().products.map((p) => [p.sku, p.price]));
    for (const r of useRecommendationStore.getState().items) expect(skus.get(r.sku)).toBe(r.currentPrice);
  });
});

describe('recommendation transitions', () => {
  const pending = () => useRecommendationStore.getState().items.find((r) => r.status === 'pending')!;

  it('approves a pending recommendation', () => {
    const r = pending();
    expect(useRecommendationStore.getState().decide(r.id, 'approved')).toEqual({ ok: true });
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.status).toBe('approved');
  });

  it('rejects invalid transition and leaves state unchanged', () => {
    const r = pending();
    useRecommendationStore.getState().decide(r.id, 'approved');
    const res = useRecommendationStore.getState().decide(r.id, 'rejected', { note: 'x' });
    expect(res.ok).toBe(false);
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.status).toBe('approved');
  });

  it('requires note for reject and adjust', () => {
    const r = pending();
    expect(useRecommendationStore.getState().decide(r.id, 'rejected')).toEqual({ ok: false, error: 'note_required' });
    expect(useRecommendationStore.getState().decide(r.id, 'adjusted', { note: 'n' }).ok).toBe(false);
    expect(useRecommendationStore.getState().items.find((x) => x.id === r.id)?.status).toBe('pending');
  });

  it('deploys only after approval', () => {
    const r = pending();
    expect(useRecommendationStore.getState().markDeployed(r.id).ok).toBe(false);
    useRecommendationStore.getState().decide(r.id, 'approved');
    expect(useRecommendationStore.getState().markDeployed(r.id).ok).toBe(true);
  });
});

describe('strategy transitions', () => {
  it('draft → pending → active is valid; draft → active is not', () => {
    const s = { ...useStrategyStore.getState().items[0]!, id: 'STR-T', status: 'draft' as const };
    useStrategyStore.getState().upsert(s);
    expect(useStrategyStore.getState().transition('STR-T', 'active').ok).toBe(false);
    expect(useStrategyStore.getState().transition('STR-T', 'pending_manager_approval').ok).toBe(true);
    expect(useStrategyStore.getState().transition('STR-T', 'active').ok).toBe(true);
    expect(useStrategyStore.getState().transition('STR-T', 'draft').ok).toBe(false);
  });
});

describe('catalog price guard', () => {
  it('rejects prices outside min/max without changing state', () => {
    const p = useProductCatalogStore.getState().products[0]!;
    expect(useProductCatalogStore.getState().applyPrice(p.sku, p.maxPrice + 1, 'manual_override')).toBe(false);
    expect(useProductCatalogStore.getState().products[0]!.price).toBe(p.price);
    expect(useProductCatalogStore.getState().applyPrice(p.sku, p.minPrice, 'manual_override')).toBe(true);
  });
});

describe('notification grouping', () => {
  it('collapses same groupKey with count', () => {
    const { push } = useNotificationStore.getState();
    push({ targetRole: 'all', groupKey: 'a', message: '1' });
    push({ targetRole: 'all', groupKey: 'a', message: '2' });
    push({ targetRole: 'all', groupKey: 'b', message: '3' });
    const g = groupNotifications(useNotificationStore.getState().items);
    expect(g).toHaveLength(2);
    expect(g.find((x) => x.groupKey === 'a')?.count).toBe(2);
  });
});

describe('rbac matrix', () => {
  const actions = Object.keys(PERMISSIONS) as Action[];
  it('every action allows at least one role and only known roles', () => {
    for (const a of actions) {
      const allowed = ROLES.filter((r) => can(r, a));
      expect(allowed.length).toBeGreaterThan(0);
    }
  });
  it('enforces key restrictions', () => {
    expect(can('analyst', 'recommendation.bulk_approve')).toBe(false);
    expect(can('manager', 'recommendation.bulk_approve')).toBe(true);
    expect(can('analyst', 'strategy.activate')).toBe(false);
    expect(can('ops_lead', 'catalog.override_price')).toBe(false);
    expect(can('compliance', 'catalog.override_price')).toBe(false);
    expect(can('ops_lead', 'deployment.execute')).toBe(true);
    expect(can('manager', 'deployment.execute')).toBe(false);
  });
});
