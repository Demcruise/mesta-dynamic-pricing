import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageSkeleton } from '@/components/ds/PageSkeleton';
import { EmptyState, KpiCard } from '@/components/ds/states';
import { useNotificationStore, useSessionStore, useToastStore } from '@/lib/stores';
import { useCountUp } from '@/lib/use-count-up';

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [], queued: [] });
  useNotificationStore.getState().reset();
  useSessionStore.getState().setRole('analyst');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function Probe({ value, enabled = true }: { value: number; enabled?: boolean }) {
  const shown = useCountUp(value, enabled);
  return <span data-testid="v">{shown}</span>;
}

describe('useCountUp', () => {
  it('shows the initial value without animating', () => {
    render(<Probe value={42} />);
    expect(screen.getByTestId('v')).toHaveTextContent('42');
  });

  it('animates toward a new value and lands within 400ms', () => {
    const { rerender } = render(<Probe value={0} />);
    rerender(<Probe value={100} />);
    act(() => { vi.advanceTimersByTime(180); });
    const mid = Number(screen.getByTestId('v').textContent);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByTestId('v')).toHaveTextContent('100');
  });

  it('snaps instantly under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { rerender } = render(<Probe value={0} />);
    rerender(<Probe value={100} />);
    expect(screen.getByTestId('v')).toHaveTextContent('100');
  });

  it('snaps instantly when disabled', () => {
    const { rerender } = render(<Probe value={0} enabled={false} />);
    rerender(<Probe value={55} enabled={false} />);
    expect(screen.getByTestId('v')).toHaveTextContent('55');
  });
});

describe('toast queue', () => {
  it('caps visible toasts at three and queues the rest', () => {
    act(() => { for (let i = 0; i < 5; i++) useToastStore.getState().push(`m${i}`); });
    const s = useToastStore.getState();
    expect(s.toasts).toHaveLength(3);
    expect(s.queued).toHaveLength(2);
  });

  it('promotes a queued toast when a visible one is dismissed', () => {
    act(() => { for (let i = 0; i < 4; i++) useToastStore.getState().push(`m${i}`); });
    const queued = useToastStore.getState().queued[0]!;
    act(() => useToastStore.getState().dismiss(useToastStore.getState().toasts[0]!.id));
    const s = useToastStore.getState();
    expect(s.toasts).toHaveLength(3);
    expect(s.toasts.some((x) => x.id === queued.id)).toBe(true);
    expect(s.queued).toHaveLength(0);
  });

  it('auto-dismiss promotes queued toasts after the TTL', () => {
    act(() => { for (let i = 0; i < 4; i++) useToastStore.getState().push(`m${i}`); });
    act(() => { vi.advanceTimersByTime(5100); });
    const s = useToastStore.getState();
    expect(s.toasts).toHaveLength(1);
    expect(s.queued).toHaveLength(0);
  });

  it('mirrors every toast into the notification centre with a literal message', () => {
    act(() => useToastStore.getState().push('Deployed SKU-1', { href: '/catalog/SKU-1' }));
    const items = useNotificationStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]!.message).toBe('Deployed SKU-1');
    expect(items[0]!.href).toBe('/catalog/SKU-1');
    expect(items[0]!.targetRole).toBe('analyst');
    expect(items[0]!.read).toBe(false);
  });

  it('survives toast expiry — the notification remains after the toast is gone', () => {
    act(() => useToastStore.getState().push('ephemeral'));
    act(() => { vi.advanceTimersByTime(5100); });
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(useNotificationStore.getState().items).toHaveLength(1);
  });
});

describe('EmptyState variants', () => {
  it('renders title and action for every variant', () => {
    for (const variant of ['empty', 'filter', 'caughtUp'] as const) {
      const { unmount } = render(<EmptyState variant={variant} title={`t-${variant}`} action={{ label: 'Go', onClick: () => {} }} />);
      expect(screen.getByText(`t-${variant}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('KpiCard count-up', () => {
  it('animates numeric values through the formatter', () => {
    const { rerender } = render(<KpiCard label="Margin" value={0} format={(n) => `${n.toFixed(0)}%`} />);
    rerender(<KpiCard label="Margin" value={50} format={(n) => `${n.toFixed(0)}%`} />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('PageSkeleton', () => {
  it('renders an accessible status placeholder', () => {
    render(<PageSkeleton variant="table" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
