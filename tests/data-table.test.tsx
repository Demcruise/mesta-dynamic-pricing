import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { MestaDataTable, useColumnVisibility, type DataColumn } from '@/components/ds/table/DataTable';
import { SavedViewMenu } from '@/components/ds/table/SavedViewMenu';
import { useUiStore } from '@/lib/stores';

interface Row { id: string; name: string; qty: number }

const rows: Row[] = [
  { id: 'A-1', name: 'Alpha', qty: 3 },
  { id: 'B-2', name: 'Beta', qty: 7 },
];

const columns: DataColumn<Row>[] = [
  { id: 'id', header: 'ID', required: true, sortKey: 'id', cell: (r) => <span className="tabular">{r.id}</span> },
  { id: 'name', header: 'Name', sortKey: 'name', cell: (r) => r.name },
  { id: 'qty', header: 'Qty', align: 'right', cell: (r) => r.qty },
];

beforeEach(() => {
  localStorage.clear();
  useUiStore.getState().setLocale('en');
});
afterEach(cleanup);

function Table({ withVis = true }: { withVis?: boolean }) {
  const vis = useColumnVisibility('test');
  return (
    <MestaDataTable
      tableId="test"
      caption="Test table"
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      sort={{ key: 'id', dir: 'asc', onSort: () => {} }}
      visibility={withVis ? vis : undefined}
    />
  );
}

describe('MestaDataTable', () => {
  it('renders all columns by default', () => {
    render(<Table />);
    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Qty' })).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('hides a column via the visibility menu and persists it', () => {
    render(<Table />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Name' }));
    expect(screen.queryByRole('columnheader', { name: 'Name' })).toBeNull();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(JSON.parse(localStorage.getItem('mesta-cols-test') ?? '[]')).toEqual(['name']);
    // required columns are not offered in the menu
    expect(screen.queryByRole('checkbox', { name: 'ID' })).toBeNull();
  });

  it('renders without a toolbar when no visibility/csv/toolbar is given', () => {
    render(<Table withVis={false} />);
    expect(screen.queryByTitle('Columns')).toBeNull();
  });
});

describe('SavedViewMenu', () => {
  it('saves filter query + hidden columns as one view and applies it back', () => {
    const applied: { query: string; hidden: string[] }[] = [];
    function Harness() {
      const [hidden, setHidden] = useState<string[]>(['qty']);
      return (
        <SavedViewMenu
          tableId="test"
          currentQuery="mh=critical"
          hidden={hidden}
          onApply={(v) => { applied.push(v); setHidden(v.hidden); }}
        />
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'High-risk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(JSON.parse(localStorage.getItem('mesta-views-test') ?? '[]')).toEqual([
      { name: 'High-risk', query: 'mh=critical', hidden: ['qty'] },
    ]);

    // Applying the saved view emits the stored query + columns.
    fireEvent.click(screen.getByRole('button', { name: 'High-risk' }));
    expect(applied).toEqual([{ name: 'High-risk', query: 'mh=critical', hidden: ['qty'] }]);
  });

  it('migrates legacy filter presets on first load', () => {
    localStorage.setItem('legacy-presets', JSON.stringify([{ name: 'Old', query: 'q=x' }]));
    render(
      <SavedViewMenu tableId="legacy" currentQuery="" hidden={[]} onApply={() => {}} legacyKey="legacy-presets" />,
    );
    expect(screen.getByRole('button', { name: 'Old' })).toBeInTheDocument();
    expect(localStorage.getItem('legacy-presets')).toBeNull();
    expect(JSON.parse(localStorage.getItem('mesta-views-legacy') ?? '[]')).toEqual([{ name: 'Old', query: 'q=x', hidden: [] }]);
  });
});
