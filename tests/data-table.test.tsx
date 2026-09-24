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

interface GRow { id: string; name: string; grp: string }
const gRows: GRow[] = [
  { id: 'A-1', name: 'Alpha', grp: 'x' },
  { id: 'B-2', name: 'Beta', grp: 'y' },
  { id: 'C-3', name: 'Gamma', grp: 'x' },
];
const gColumns: DataColumn<GRow>[] = [
  { id: 'id', header: 'ID', required: true, cell: (r) => r.id },
  { id: 'name', header: 'Name', defaultWidth: 200, cell: (r) => r.name },
];

describe('MestaDataTable — Wave H: resize + grouping', () => {
  it('resizable renders a keyboard-usable separator per column and persists widths', () => {
    render(
      <MestaDataTable tableId="rz" caption="T" columns={gColumns} rows={gRows} getRowId={(r) => r.id} resizable />,
    );
    const sep = screen.getByRole('separator', { name: 'Resize column Name' });
    expect(sep).toHaveAttribute('aria-valuenow', '200');
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(sep).toHaveAttribute('aria-valuenow', '216');
    expect(JSON.parse(localStorage.getItem('mesta-colw-rz') ?? '{}')).toEqual({ name: 216 });
    fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    expect(sep).toHaveAttribute('aria-valuenow', '184');
    // double-click resets to the column default
    fireEvent.doubleClick(sep);
    expect(sep).toHaveAttribute('aria-valuenow', '200');
    expect(JSON.parse(localStorage.getItem('mesta-colw-rz') ?? '{}')).toEqual({});
  });

  it('non-resizable tables render no separators and no colgroup', () => {
    render(
      <MestaDataTable tableId="nr" caption="T" columns={gColumns} rows={gRows} getRowId={(r) => r.id} />,
    );
    expect(screen.queryByRole('separator')).toBeNull();
    expect(document.querySelector('colgroup')).toBeNull();
  });

  it('group select reorders rows and inserts labelled group headers', () => {
    render(
      <MestaDataTable
        tableId="gp" caption="T" columns={gColumns} rows={gRows} getRowId={(r) => r.id}
        groups={[{ id: 'grp', label: 'Bucket', value: (r) => r.grp }]}
      />,
    );
    const sel = screen.getByLabelText('Group by');
    fireEvent.change(sel, { target: { value: 'grp' } });
    const trs = screen.getAllByRole('row');
    const text = trs.map((tr) => tr.textContent ?? '');
    // header row, then group 'x' header, A-1, C-3, group 'y' header, B-2
    expect(text[1]).toContain('x');
    expect(text[1]).toContain('2');
    expect(text[4]).toContain('y');
    expect(text.indexOf(text.find((s) => s.includes('C-3'))!)).toBeLessThan(text.indexOf(text.find((s) => s.includes('B-2'))!));
    expect(localStorage.getItem('mesta-group-gp')).toBe('grp');
    // clearing the select restores original order
    fireEvent.change(sel, { target: { value: '' } });
    const rows2 = screen.getAllByRole('row').map((tr) => tr.textContent ?? '');
    expect(rows2.findIndex((s) => s.includes('B-2'))).toBeLessThan(rows2.findIndex((s) => s.includes('C-3')));
  });

  it('group select is hidden when the table is virtualized', () => {
    render(
      <MestaDataTable
        tableId="gv" caption="T" columns={gColumns} rows={gRows} getRowId={(r) => r.id}
        virtualize groups={[{ id: 'grp', label: 'Bucket', value: (r) => r.grp }]}
      />,
    );
    expect(screen.queryByLabelText('Group by')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
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

  it('pins the first column when stickyFirst is set (TABLE-001)', () => {
    render(
      <MestaDataTable
        tableId="sticky"
        caption="Sticky table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        stickyFirst
      />,
    );
    const head = screen.getByRole('columnheader', { name: 'ID' });
    expect(head.className).toContain('sticky');
    expect(head.className).toContain('left-0');
    // The second column is not pinned.
    expect(screen.getByRole('columnheader', { name: 'Name' }).className).not.toContain('sticky');
  });

  it('reports additive sort clicks and renders priority badges for multi-sort', () => {
    const clicks: [string, boolean | undefined][] = [];
    const { rerender } = render(
      <MestaDataTable
        tableId="multi"
        caption="Multi-sort table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={{ key: 'id', dir: 'asc', levels: [{ key: 'name', dir: 'desc' }], onSort: (k, additive) => clicks.push([k, additive]) }}
      />,
    );
    // Shift-click adds a level; a plain click does not.
    fireEvent.click(screen.getByRole('button', { name: /Name/ }), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: /ID/ }));
    expect(clicks).toEqual([['name', true], ['id', false]]);

    // Both active levels show a priority badge.
    expect(screen.getByLabelText('Sort priority 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort priority 2')).toBeInTheDocument();

    // A single-level sort renders no badges.
    rerender(
      <MestaDataTable
        tableId="multi"
        caption="Multi-sort table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={{ key: 'id', dir: 'asc', onSort: () => {} }}
      />,
    );
    expect(screen.queryByLabelText('Sort priority 1')).toBeNull();
  });
});
