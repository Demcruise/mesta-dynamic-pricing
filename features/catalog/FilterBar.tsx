'use client';

import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, inputCls } from '@/components/ui/field';
import { CATEGORIES } from '@/lib/categories';
import { useTranslation } from '@/lib/i18n';
import { activeFilterCount, type CatalogFilters } from './filters';

function MultiSelect<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <details className="relative max-sm:static max-sm:w-full">
      <summary className={`${inputCls} flex cursor-pointer list-none items-center justify-between gap-2 whitespace-nowrap`}>
        <span>{label}{value.length > 0 && <span className="ml-1 rounded bg-brand-soft px-1 text-xs text-brand">{value.length}</span>}</span>
        <ChevronDown className="size-3.5" aria-hidden />
      </summary>
      <fieldset className="glass absolute left-0 top-10 z-20 min-w-44 rounded-card border border-line p-2 shadow-e3 max-sm:static max-sm:mt-1 max-sm:w-full">
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

interface Props {
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
  onClear: () => void;
}

export function FilterBar({ filters, onChange, onClear }: Props) {
  const { t } = useTranslation();
  const count = activeFilterCount(filters);
  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch });

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
      <Input type="number" aria-label={t('catalog.filter.gapMin')} placeholder={t('catalog.filter.gapMin')} className="tabular w-28"
        value={filters.gapMin ?? ''} onChange={numChange('gapMin')} />
      <Input type="number" aria-label={t('catalog.filter.gapMax')} placeholder={t('catalog.filter.gapMax')} className="tabular w-28"
        value={filters.gapMax ?? ''} onChange={numChange('gapMax')} />

      {count > 0 && (
        <>
          <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand" aria-live="polite">
            {t('catalog.filter.count', { n: count })}
          </span>
          <Button variant="ghost" onClick={onClear}>{t('common.state.clearFilters')}</Button>
        </>
      )}
    </div>
  );
}
