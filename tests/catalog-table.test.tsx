import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogTable } from '@/features/catalog/CatalogTable';
import { applyFilters, EMPTY_FILTERS, sortProducts } from '@/features/catalog/filters';
import { generateProducts } from '@/lib/mock-data';
import { useSessionStore, useUiStore } from '@/lib/stores';

/** jsdom has no layout; give the scroll container a fixed 600px viewport so the virtualizer can window rows. */
beforeAll(() => {
  const rect = { width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect as DOMRect);
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 900 });
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  useUiStore.getState().setLocale('en');
  useSessionStore.getState().setRole('analyst');
});
afterEach(cleanup);

const noop = () => {};
const props = (rows: ReturnType<typeof generateProducts>) => ({
  rows, rowHeight: 44, selected: new Set<string>(), pendingSkus: new Set<string>(), sort: 'sku' as const, dir: 'asc' as const,
  onSort: noop, onToggle: noop, onToggleAll: noop, onOverride: noop,
});

describe('virtualised catalog table', () => {
  const products = generateProducts(5000);

  it('renders only the visible window for 5,000 SKUs', () => {
    render(<CatalogTable {...props(products)} />);
    const rendered = document.querySelectorAll('tbody tr[data-row-index]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(60);
    expect(screen.getByRole('link', { name: 'SKU-1000' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'SKU-5999' })).toBeNull();
  });

  it('shows the filtered subset, respects sort and keeps selection semantics', () => {
    const rows = sortProducts(applyFilters(products, { ...EMPTY_FILTERS, category: ['Dairy'] }), 'price', 'desc');
    const { rerender } = render(<CatalogTable {...props(rows)} />);
    const cats = [...document.querySelectorAll('tbody tr[data-row-index] td:nth-child(4)')].map((c) => c.textContent);
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((c) => c === 'Dairy')).toBe(true);
    expect(screen.getByRole('link', { name: rows[0]!.sku })).toBeInTheDocument();

    const toggled: string[] = [];
    rerender(<CatalogTable {...props(rows)} selected={new Set([rows[0]!.sku])} onToggle={(s) => toggled.push(s)} />);
    const first = document.querySelector('tbody tr[data-row-index="0"]') as HTMLElement;
    expect(within(first).getByRole('checkbox')).toBeChecked();
    fireEvent.click(within(first).getByRole('checkbox'));
    expect(toggled).toEqual([rows[0]!.sku]);
  });

  it('exposes sortable column headers with aria-sort and hides write actions from ops leads', () => {
    render(<CatalogTable {...props(products)} sort="price" dir="desc" />);
    expect(screen.getByRole('columnheader', { name: /Price/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: /Product/ })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getAllByRole('button', { name: /^Override price SKU-/ }).length).toBeGreaterThan(0);
    cleanup();
    useSessionStore.getState().setRole('ops_lead');
    render(<CatalogTable {...props(products)} />);
    expect(screen.queryByRole('button', { name: /^Override price SKU-/ })).toBeNull();
  });
});
