'use client';

import { Bookmark, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

export interface SavedView {
  name: string;
  /** Serialized filter state — each table defines the format (URL query string). */
  query: string;
  /** Hidden column ids captured with the view. */
  hidden: string[];
}

export interface BuiltInView {
  id: string;
  label: string;
  query: string;
  hidden?: string[];
}

interface Props {
  tableId: string;
  /** Serialized current filters (empty string = no active filters worth saving). */
  currentQuery: string;
  hidden: string[];
  onApply: (view: { query: string; hidden: string[] }) => void;
  builtIns?: BuiltInView[];
  /** localStorage key of a legacy `[{name, query}]` preset list to migrate on first load. */
  legacyKey?: string;
}

const viewsKey = (tableId: string) => `mesta-views-${tableId}`;

function loadViews(tableId: string, legacyKey?: string): SavedView[] {
  try {
    const raw = localStorage.getItem(viewsKey(tableId));
    if (raw) return JSON.parse(raw) as SavedView[];
    if (legacyKey) {
      const legacy = JSON.parse(localStorage.getItem(legacyKey) ?? '[]') as { name: string; query: string }[];
      if (legacy.length) {
        const migrated = legacy.map((p) => ({ ...p, hidden: [] }));
        localStorage.setItem(viewsKey(tableId), JSON.stringify(migrated));
        localStorage.removeItem(legacyKey);
        return migrated;
      }
    }
  } catch { /* storage unavailable or corrupt */ }
  return [];
}

/** Saved-view dropdown: applies a filter query + column layout as one recallable unit. */
export function SavedViewMenu({ tableId, currentQuery, hidden, onApply, builtIns = [], legacyKey }: Props) {
  const { t } = useTranslation();
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState('');
  useEffect(() => setViews(loadViews(tableId, legacyKey)), [tableId, legacyKey]);

  const persist = (next: SavedView[]) => {
    setViews(next);
    try { localStorage.setItem(viewsKey(tableId), JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    persist([...views.filter((v) => v.name !== n), { name: n, query: currentQuery, hidden }]);
    setName('');
  };

  return (
    <details className="relative">
      <summary
        aria-label={t('common.table.views')}
        title={t('common.table.views')}
        className="grid size-9 cursor-pointer list-none place-items-center rounded-input text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg"
      >
        <Bookmark className="size-4" aria-hidden />
      </summary>
      <div className="glass absolute right-0 top-10 z-20 min-w-56 rounded-card border border-line p-2 shadow-e3">
        <ul className="flex flex-col">
          {builtIns.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onApply({ query: v.query, hidden: v.hidden ?? [] })}
                className="w-full rounded px-2 py-1.5 text-left text-sm transition-colors duration-fast hover:bg-subtle"
              >
                {v.label}
              </button>
            </li>
          ))}
          {views.map((v) => (
            <li key={v.name} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onApply(v)}
                className="flex-1 rounded px-2 py-1.5 text-left text-sm transition-colors duration-fast hover:bg-subtle"
              >
                {v.name}
              </button>
              <button
                type="button"
                aria-label={t('common.table.deleteView', { name: v.name })}
                onClick={() => persist(views.filter((x) => x.name !== v.name))}
                className="grid size-7 place-items-center rounded text-faint opacity-0 transition-opacity duration-fast hover:text-down focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {builtIns.length === 0 && views.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-faint">{t('common.table.noViews')}</li>
          )}
        </ul>
        <div className="mt-1 flex gap-1 border-t border-line pt-2">
          <input
            aria-label={t('common.table.viewName')}
            placeholder={t('common.table.viewName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-input border border-line bg-surface px-2 text-xs"
          />
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="h-8 rounded-input bg-brand px-2 text-xs font-medium text-brand-fg transition-colors duration-fast hover:opacity-90 disabled:opacity-40"
          >
            {t('common.table.saveView')}
          </button>
        </div>
      </div>
    </details>
  );
}
