export type CsvCell = string | number | null | undefined;

const esc = (v: CsvCell) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCsv<T>(headers: string[], rows: T[], cells: (row: T) => CsvCell[]): string {
  return [headers, ...rows.map((r) => cells(r))].map((r) => r.map(esc).join(',')).join('\n');
}

/** Trigger a browser download for generated CSV content. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
