import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { explainBounds } from '@/lib/guardrails';
import { applyRounding, DEFAULT_CONFIG, diffSection, validateSection } from '@/lib/settings-config';
import { useUiStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

const product = { price: 49_300, minPrice: 44_500, maxPrice: 66_600, mapPrice: 45_400 };

describe('explainBounds (STRATEGY-008…016)', () => {
  it('intersects product, strategy, change window and MAP, naming the binding terms', () => {
    const b = explainBounds(product, { minPrice: 46_000, maxPrice: 60_000, mapEnforced: true, maxChangePercent: 0, autoApproveThreshold: 80 });
    expect(b.effectiveMin).toBe(46_000);
    expect(b.effectiveMax).toBe(60_000);
    expect(b.minBinding).toEqual(['strategy']);
    expect(b.maxBinding).toEqual(['strategy']);
    expect(b.state).toBe('within');
  });

  it('reports unset strategy limits as null, never 0', () => {
    const b = explainBounds(product, { minPrice: null, maxPrice: null, mapEnforced: false, maxChangePercent: 0, autoApproveThreshold: 80 });
    expect(b.strategyMin).toBeNull();
    expect(b.strategyMax).toBeNull();
    expect(b.effectiveMin).toBe(44_500);
    expect(b.minTerms.map((x) => x.source)).not.toContain('map');
  });

  it('flags equal and invalid ranges', () => {
    expect(explainBounds(product, { minPrice: 50_000, maxPrice: 50_000, mapEnforced: true, maxChangePercent: 0, autoApproveThreshold: 80 }).state).toBe('equal');
    expect(explainBounds(product, { minPrice: 62_000, maxPrice: 50_000, mapEnforced: true, maxChangePercent: 0, autoApproveThreshold: 80 }).state).toBe('invalid');
  });

  it('applies the change-per-cycle window around the current price', () => {
    const b = explainBounds(product, { minPrice: null, maxPrice: null, mapEnforced: true, maxChangePercent: 5, autoApproveThreshold: 80 });
    expect(b.changeMin).toBe(Math.ceil(49_300 * 0.95));
    expect(b.effectiveMax).toBe(Math.floor(49_300 * 1.05));
    expect(b.maxBinding).toEqual(['change']);
  });
});

describe('settings model (SET-007/032/038)', () => {
  it('shows the rounding transformation', () => {
    expect(applyRounding(49_287, 'nearest', 100, false)).toBe(49_300);
    expect(applyRounding(49_287, 'down', 100, false)).toBe(49_200);
    expect(applyRounding(49_287, 'nearest', 100, true)).toBe(49_900);
  });

  it('diffs to leaf paths and marks sensitive changes', () => {
    const next = { ...DEFAULT_CONFIG.approvals, tiers: DEFAULT_CONFIG.approvals.tiers.map((x, i) => (i === 0 ? { ...x, max: 150_000 } : x)), slaHours: 12 };
    const changes = diffSection('approvals', DEFAULT_CONFIG.approvals, next);
    expect(changes).toEqual(expect.arrayContaining([
      { path: 'approvals.tiers.0.max', from: 100_000, to: 150_000, sensitive: true },
      { path: 'approvals.slaHours', from: 24, to: 12, sensitive: false },
    ]));
  });

  it('validates with contextual rule codes', () => {
    const bad = { ...DEFAULT_CONFIG.approvals, tiers: [{ max: 2_000_000, role: 'analyst' as const }, { max: 1_000_000, role: 'manager' as const }, { max: null, role: 'approver' as const }] };
    expect(validateSection('approvals', bad)).toMatchObject({ 'tiers.1': 'tierOrder' });
    const fresh = { ...DEFAULT_CONFIG.data, freshness: { ...DEFAULT_CONFIG.data.freshness, inventory: { warn: 24, block: 6 } } };
    expect(validateSection('data', fresh)).toMatchObject({ 'freshness.inventory': 'blockAfterWarn' });
  });
});

describe('cn knows the Mesta type scale', () => {
  it('keeps a DS font size next to a text colour', () => {
    expect(cn('text-caption', 'text-muted')).toBe('text-caption text-muted');
    expect(cn('h-control-md', 'h-10')).toBe('h-10');
  });
});

describe('FilterTabs (ALERT-021, GUARDRAIL-026)', () => {
  beforeEach(() => useUiStore.getState().setLocale('en'));
  afterEach(cleanup);

  it('exposes tab semantics with counts, arrow-key selection and disabled empty tabs', () => {
    let value = 'all';
    const tabs = [{ value: 'all', label: 'All', count: 3 }, { value: 'critical', label: 'Critical', count: 2 }, { value: 'info', label: 'Info', count: 0 }, { value: 'warning', label: 'Warning', count: 1 }];
    const { rerender } = render(<FilterTabs label="Severity" value={value} onChange={(v) => { value = v; }} tabs={tabs} />);
    expect(screen.getByRole('tablist', { name: 'Severity' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Info/ })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('tab', { name: /All/ }), { key: 'ArrowRight' });
    expect(value).toBe('critical');
    rerender(<FilterTabs label="Severity" value={value} onChange={(v) => { value = v; }} tabs={tabs} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: /Critical/ }), { key: 'ArrowRight' });
    expect(value).toBe('warning'); // skips the disabled zero-count tab
  });
});
