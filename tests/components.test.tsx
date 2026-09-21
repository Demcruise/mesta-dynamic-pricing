import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { RoleGate } from '@/components/shell/RoleGate';
import { translate } from '@/lib/i18n';
import { useSessionStore, useUiStore } from '@/lib/stores';

beforeEach(() => {
  useSessionStore.getState().setRole('analyst');
  useUiStore.getState().setLocale('en');
});

describe('DeltaBadge', () => {
  it('pairs icon with direction label in aria-label', () => {
    render(<DeltaBadge value={0.05} />);
    expect(screen.getByLabelText(/Increase/)).toBeInTheDocument();
  });
  it('labels decreases and flat', () => {
    const { rerender } = render(<DeltaBadge value={-0.02} />);
    expect(screen.getByLabelText(/Decrease/)).toBeInTheDocument();
    rerender(<DeltaBadge value={0} />);
    expect(screen.getByLabelText(/No change/)).toBeInTheDocument();
  });
});

describe('RoleGate', () => {
  it('hides content the role may not use', () => {
    useSessionStore.getState().setRole('ops_lead');
    render(<RoleGate action="catalog.override_price"><button>Override</button></RoleGate>);
    expect(screen.queryByText('Override')).toBeNull();
  });
  it('renders content for allowed role and reacts to role change', () => {
    render(<RoleGate action="catalog.override_price"><button>Override</button></RoleGate>);
    expect(screen.getByText('Override')).toBeInTheDocument();
    act(() => useSessionStore.getState().setRole('compliance'));
    expect(screen.queryByText('Override')).toBeNull();
  });
  it('disable mode renders inert content', () => {
    useSessionStore.getState().setRole('compliance');
    render(<RoleGate action="catalog.override_price" mode="disable"><button>Override</button></RoleGate>);
    expect(screen.getByText('Override')).toBeDisabled();
  });
});

describe('locale', () => {
  it('translates and falls back to key for missing entries', () => {
    expect(translate('id', 'common.nav.catalog')).toBe('Katalog');
    expect(translate('en', 'common.nav.catalog')).toBe('Catalog');
    expect(translate('en', 'catalog.subtitle', { count: 2, total: 9 })).toBe('2 of 9 SKUs');
  });
  it('has identical key sets in id and en', async () => {
    const { messages } = await import('@/lib/i18n');
    const flat = (o: unknown, p = ''): string[] =>
      typeof o === 'object' && o ? Object.entries(o).flatMap(([k, v]) => flat(v, `${p}${k}.`)) : [p];
    expect(flat(messages.id).sort()).toEqual(flat(messages.en).sort());
  });
});
