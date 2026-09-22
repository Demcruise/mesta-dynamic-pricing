import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SeverityChip } from '@/components/ds/SeverityChip';
import { StatusBadge, StatusIcon } from '@/components/ds/StatusBadge';
import { StatusChip } from '@/components/ds/StatusChip';
import { ExecutionTimeline, FreshnessBadge, JobProgress, SyncStatus } from '@/components/ds/system-status';
import { ActionSummary, ConsequencePreview, DocsLink, MetricDefinition, RecoveryNotice } from '@/components/ds/trust';
import { resetMestaData } from '@/lib/bootstrap';
import { useUiStore } from '@/lib/stores';

beforeEach(() => {
  resetMestaData({ productCount: 10 });
  useUiStore.getState().setLocale('en');
});
afterEach(cleanup);

describe('StatusBadge (unified vocabulary)', () => {
  it('renders icon + translated label for extended workflow/execution states', () => {
    render(<>
      <StatusBadge status="draft" /><StatusBadge status="scheduled" /><StatusBadge status="in_flight" />
      <StatusBadge status="rolled_back" /><StatusBadge status="conflicted" /><StatusBadge status="delayed" />
    </>);
    for (const text of ['Draft', 'Scheduled', 'In flight', 'Rolled back', 'Conflicted', 'Delayed']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('honours a domain label override', () => {
    render(<StatusBadge status="synced" label="Deployed" />);
    expect(screen.getByText('Deployed')).toBeInTheDocument();
  });

  it('keeps StatusChip and SeverityChip working as domain aliases', () => {
    render(<><StatusChip status="approved" /><SeverityChip s="critical" /></>);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('StatusIcon renders the mapped icon without a text label', () => {
    const { container } = render(<StatusIcon status="failed" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container).not.toHaveTextContent(/failed/i);
  });

  it('marks running states with a spinning loader icon', () => {
    const { container } = render(<StatusBadge status="publishing" />);
    expect(container.querySelector('svg.animate-spin')).toBeTruthy();
  });
});

describe('trust components', () => {
  it('ActionSummary renders the consequence adjacent to the action', () => {
    render(<ActionSummary consequence="12 SKUs · +2.1% margin" action={<button>Approve</button>} />);
    expect(screen.getByText('12 SKUs · +2.1% margin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('ConsequencePreview renders label/value rows with tone', () => {
    render(<ConsequencePreview items={[
      { label: 'Current price', value: 'Rp125.000' },
      { label: 'New price', value: 'Rp118.000', tone: 'down' },
    ]} />);
    expect(screen.getByText('Current price')).toBeInTheDocument();
    expect(screen.getByText('Rp118.000')).toBeInTheDocument();
  });

  it('RecoveryNotice renders the recovery path', () => {
    render(<RecoveryNotice>Retry re-runs this channel only.</RecoveryNotice>);
    expect(screen.getByText('Retry re-runs this channel only.')).toBeInTheDocument();
  });

  it('DocsLink renders a navigable link', () => {
    render(<DocsLink href="/audit">View audit trail</DocsLink>);
    expect(screen.getByRole('link', { name: 'View audit trail' })).toHaveAttribute('href', '/audit');
  });

  it('MetricDefinition exposes a named disclosure trigger and its rows', () => {
    const { container } = render(
      <MetricDefinition label="About pending approvals" definition="Recommendations waiting for a decision." rows={[{ label: 'Scope', value: 'All stores' }]} />,
    );
    expect(container.querySelector('summary[aria-label="About pending approvals"]')).toBeTruthy();
    expect(screen.getByText('Recommendations waiting for a decision.')).toBeInTheDocument();
    expect(screen.getByText('All stores')).toBeInTheDocument();
  });
});

describe('system-status primitives', () => {
  it('JobProgress is a labelled determinate progressbar', () => {
    render(<JobProgress done={3} total={4} label="Channels synced" />);
    const bar = screen.getByRole('progressbar', { name: 'Channels synced' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('3/4 · 75%')).toBeInTheDocument();
  });

  it('JobProgress handles a zero denominator', () => {
    render(<JobProgress done={0} total={0} label="Empty job" />);
    expect(screen.getByText('0/0 · 0%')).toBeInTheDocument();
  });

  it('FreshnessBadge renders relative time and the never-state', () => {
    render(<>
      <FreshnessBadge at={new Date(Date.now() - 5 * 60_000).toISOString()} />
      <FreshnessBadge at={null} />
    </>);
    expect(screen.getByText(/Updated .*ago/i)).toBeInTheDocument();
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('FreshnessBadge honours a label override', () => {
    render(<FreshnessBadge at={new Date().toISOString()} label="Competitor data 2h ago" />);
    expect(screen.getByText('Competitor data 2h ago')).toBeInTheDocument();
  });

  it('SyncStatus delegates to the unified badge', () => {
    render(<SyncStatus status="delayed" />);
    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });

  it('ExecutionTimeline renders an ordered list with a labelled region', () => {
    render(<ExecutionTimeline ariaLabel="Execution history" steps={[
      { id: 'a', label: 'Deployment triggered', status: 'queued' },
      { id: 'b', label: 'Channel synced', status: 'synced', detail: 'POS' },
      { id: 'c', label: 'Retry scheduled', status: 'in_flight' },
    ]} />);
    expect(screen.getByRole('list', { name: 'Execution history' })).toBeInTheDocument();
    expect(screen.getByText('Deployment triggered')).toBeInTheDocument();
    expect(screen.getByText('POS')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
