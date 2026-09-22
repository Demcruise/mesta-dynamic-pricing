import { describe, expect, it } from 'vitest';
import {
  activeFilterCount, applyFilters, computeKpis, EMPTY_FILTERS, parseFilters, serializeFilters, sortProducts,
} from '@/features/catalog/filters';
import { generateProducts } from '@/lib/mock-data';

const products = generateProducts(300);

describe('catalog filters', () => {
  it('round-trips through URL params', () => {
    const f = { ...EMPTY_FILTERS, q: 'teh', category: ['Beverages', 'Snacks'], margin: ['thin' as const], gapMin: -5, gapMax: 10, sort: 'price' as const, dir: 'desc' as const };
    expect(parseFilters(serializeFilters(f))).toEqual(f);
  });

  it('combines filters (AND) and counts dimensions', () => {
    const f = { ...EMPTY_FILTERS, category: ['Beverages'], stock: ['in_stock' as const] };
    const out = applyFilters(products, f);
    expect(out.every((p) => p.category === 'Beverages' && p.stockStatus === 'in_stock')).toBe(true);
    expect(activeFilterCount(f)).toBe(2);
  });

  it('KPIs follow the filtered dataset', () => {
    const all = computeKpis(products, new Set());
    const bev = applyFilters(products, { ...EMPTY_FILTERS, category: ['Beverages'] });
    const k = computeKpis(bev, new Set(bev.slice(0, 3).map((p) => p.sku)));
    expect(k.pendingAi).toBe(3);
    expect(k.avgMargin).not.toBe(all.avgMargin);
  });

  it('sorts numerically and stably', () => {
    const asc = sortProducts(products, 'price', 'asc');
    for (let i = 1; i < asc.length; i++) expect(asc[i]!.price).toBeGreaterThanOrEqual(asc[i - 1]!.price);
  });
});
