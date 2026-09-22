'use client';

import { Columns3 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface Props {
  columns: { id: string; header: string }[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}

/** Toolbar menu listing every hideable column as a checkbox. */
export function ColumnVisibilityMenu({ columns, hidden, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <details className="relative">
      <summary
        aria-label={t('common.table.columns')}
        title={t('common.table.columns')}
        className="grid size-9 cursor-pointer list-none place-items-center rounded-input text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg"
      >
        <Columns3 className="size-4" aria-hidden />
      </summary>
      <fieldset className="glass absolute right-0 top-10 z-20 min-w-44 rounded-card border border-line p-2 shadow-e3">
        <legend className="sr-only">{t('common.table.columns')}</legend>
        {columns.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-2 py-1 text-sm hover:bg-subtle">
            <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => onToggle(c.id)} />
            {c.header}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
