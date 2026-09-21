import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusChip } from '@/components/ds/StatusChip';
import { ToastHost } from '@/components/shell/ToastHost';
import { DecisionDialog } from '@/features/recommendations/DecisionDialog';
import { stageDecision, undoDecision } from '@/lib/actions/recommendation';
import { resetMestaData } from '@/lib/bootstrap';
import {
  useAuditStore, useProductCatalogStore, useRecommendationStore, useSessionStore, useUiStore, useUndoStore,
} from '@/lib/stores';

beforeEach(() => {
  vi.useFakeTimers();
  resetMestaData({ productCount: 100 });
  useSessionStore.getState().setRole('analyst');
  useUiStore.getState().setLocale('en');
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const pending = () => useRecommendationStore.getState().items.find((r) => r.status === 'pending')!;

describe('reject dialog', () => {
  it('blocks submit without a note and stages once a note is given', () => {
    const rec = pending();
    const product = useProductCatalogStore.getState().products.find((p) => p.sku === rec.sku);
    render(<DecisionDialog rec={rec} product={product} mode="reject" onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('alert')).toHaveTextContent('A note is required.');
    expect(useUndoStore.getState().staged[rec.id]).toBeUndefined();

    fireEvent.change(screen.getByLabelText('Note (required)'), { target: { value: 'stale competitor data' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(useUndoStore.getState().staged[rec.id]?.to).toBe('rejected');
  });
});

describe('undo toast', () => {
  it('shows a countdown and Undo cancels the decision without an audit event', () => {
    const rec = pending();
    const user = useSessionStore.getState().user;
    stageDecision(user, rec.id, 'approved');
    render(<ToastHost />);
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(useRecommendationStore.getState().items.find((r) => r.id === rec.id)?.status).toBe('pending');
    expect(useAuditStore.getState().events.some((e) => e.entityId === rec.id && e.actorId === user.userId)).toBe(false);
    expect(undoDecision(rec.id)).toEqual({ ok: false, error: 'not_staged' });
  });
});

describe('locale toggle', () => {
  it('re-renders translated labels without reload', () => {
    render(<StatusChip status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    act(() => useUiStore.getState().setLocale('id'));
    expect(screen.getByText('Disetujui')).toBeInTheDocument();
  });
});
