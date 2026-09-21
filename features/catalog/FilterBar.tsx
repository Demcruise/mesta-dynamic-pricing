'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, inputCls } from '@/components/ui/field';
import { CATEGORIES } from '@/lib/categories';
import { useTranslation } from '@/lib/i18n';
import {
  activeFilterCount, BUILT_IN_PRESETS, parseFilters, type CatalogFilters, type FilterPreset,
} from './filters';

function MultiSelect<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <details className="relative max-sm:static max-sm:w-full">
      <summary className={`${inputCls} flex cursor-pointer list-none items-center justify-between gap-2 whitespace-nowrap`}>
        <span>{label}{value.length > 0 && <span className="ml-1 rounded bg-brand-soft px-1 text-xs text-brand">{value.length}</span>}</span>
        <ChevronDown className="size-3.5" aria-hidden />
      </summary>
      <fieldset className="absolute left-0 top-10 z-20 min-w-44 rounded-card border border-line bg-surface p-2 shadow-lg max-sm:static max-sm:mt-1 max-sm:w-full">
        <legend className="sr-only">{label}</legend>
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-subtle">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

const PRESET_KEY = 'mesta-catalog-presets';

function loadPresets(): FilterPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]') as FilterPreset[];
  } catch {
    return [];
  }
}

interface Props {
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
  onApplyQuery: (query: string) => void;
  onClear: () => void;
  currentQuery: string;
}

export function FilterBar({ filters, onChange, onApplyQuery, onClear, currentQuery }: Props) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [name, setName] = useState('');
  useEffect(() => setPresets(loadPresets()), []);
  const count = activeFilterCount(filters);
  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch });

  const save = () => {
    const n = name.trim();
    if (!n || !currentQuery) return;
    const next = [...presets.filter((p) => p.name !== n), { name: n, query: currentQuery }];
    setPresets(next);
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    setName('');
  };

  const numChange = (key: 'gapMin' | 'gapMax') => (e: React.ChangeEvent<HTMLInputElement>) =>
    set({ [key]: e.target.value === '' ? null : Number(e.target.value) } as Partial<CatalogFilters>);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="search">
      <Input
        type="search"
        aria-label={t('catalog.search')}
        placeholder={t('catalog.search')}
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        className="w-52"
      />
      <MultiSelect label={t('catalog.filter.category')} value={filters.category} onChange={(category) => set({ category })}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      <MultiSelect label={t('catalog.filter.elasticity')} value={filters.elasticity} onChange={(elasticity) => set({ elasticity })}
        options={(['inelastic', 'moderate', 'elastic'] as const).map((v) => ({ value: v, label: t(`catalog.elasticity.${v}`) }))} />
      <MultiSelect label={t('catalog.filter.margin')} value={filters.margin} onChange={(margin) => set({ margin })}
        options={(['healthy', 'thin', 'critical'] as const).map((v) => ({ value: v, label: t(`catalog.health.${v}`) }))} />
      <MultiSelect label={t('catalog.filter.stock')} value={filters.stock} onChange={(stock) => set({ stock })}
        options={(['in_stock', 'low_stock', 'out_of_stock'] as const).map((v) => ({ value: v, label: t(`catalog.stock.${v}`) }))} />
      <Input type="number" aria-label={t('catalog.filter.gapMin')} placeholder={t('catalog.filter.gapMin')} className="w-28"
        value={filters.gapMin ?? ''} onChange={numChange('gapMin')} />
      <Input type="number" aria-label={t('catalog.filter.gapMax')} placeholder={t('catalog.filter.gapMax')} className="w-28"
        value={filters.gapMax ?? ''} onChange={numChange('gapMax')} />

      <select
        aria-label={t('catalog.filter.presets')}
        className={`${inputCls} w-40`}
        value=""
        onChange={(e) => { if (e.target.value) onApplyQuery(e.target.value); }}
      >
        <option value="">{t('catalog.filter.presets')}</option>
        {BUILT_IN_PRESETS.map((p) => <option key={p.key} value={p.query}>{t(`catalog.filter.${p.key}`)}</option>)}
        {presets.map((p) => <option key={p.name} value={p.query}>{p.name}</option>)}
      </select>

      {count > 0 && (
        <>
          <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand" aria-live="polite">
            {t('catalog.filter.count', { n: count })}
          </span>
          <Input aria-label={t('catalog.filter.presetName')} placeholder={t('catalog.filter.presetName')} className="w-36"
            value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="secondary" size="md" onClick={save} disabled={!name.trim()}>{t('catalog.filter.savePreset')}</Button>
          <Button variant="ghost" onClick={onClear}>{t('common.state.clearFilters')}</Button>
        </>
      )}
    </div>
  );
}

export { parseFilters };
