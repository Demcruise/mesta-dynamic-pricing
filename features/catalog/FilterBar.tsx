'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, inputCls } from '@/components/ui/field';
import { CATEGORIES } from '@/lib/categories';
import { useTranslation } from '@/lib/i18n';
import { activeFilterCount, type CatalogFilters } from './filters';
import { pillCls } from '@/components/ds/Pill';

function MultiSelect<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <details className="relative shrink-0 max-sm:static max-sm:w-full">
      {/* UI-FIX-001: 6px label → chevron, 12px chevron → edge, content-width control. */}
      <summary className={cn(inputCls, 'flex w-auto cursor-pointer list-none items-center gap-1.5 whitespace-nowrap pr-3 max-sm:w-full max-sm:justify-between [&::-webkit-details-marker]:hidden')}>
        <span className="flex items-center">{label}{value.length > 0 && <span className={`ml-1.5 ${pillCls('brand', 'sm')}`}>{value.length}</span>}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </summary>
      <fieldset className="glass absolute left-0 top-11 z-20 min-w-44 rounded-card border border-line p-2 shadow-e3 max-sm:static max-sm:mt-1 max-sm:w-full">
        <legend className="sr-only">{label}</legend>
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm transition-colors duration-fast hover:bg-subtle">
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
    // CATALOG-UI-001: one flex row for all seven controls. Search is the flexible field, selects keep
    // their content width, and the two gap inputs are one unit so they only ever wrap together.
    <div className="mb-3 flex flex-wrap items-center gap-2" role="search">
      <Input
        type="search"
        aria-label={t('catalog.search')}
        placeholder={t('catalog.search')}
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        className="min-w-40 flex-1 basis-44 sm:max-w-72"
      />
      <MultiSelect label={t('catalog.filter.category')} value={filters.category} onChange={(category) => set({ category })}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      <MultiSelect label={t('catalog.filter.elasticity')} value={filters.elasticity} onChange={(elasticity) => set({ elasticity })}
        options={(['inelastic', 'moderate', 'elastic'] as const).map((v) => ({ value: v, label: t(`catalog.elasticity.${v}`) }))} />
      <MultiSelect label={t('catalog.filter.margin')} value={filters.margin} onChange={(margin) => set({ margin })}
        options={(['healthy', 'thin', 'critical'] as const).map((v) => ({ value: v, label: t(`catalog.health.${v}`) }))} />
      <MultiSelect label={t('catalog.filter.stock')} value={filters.stock} onChange={(stock) => set({ stock })}
        options={(['in_stock', 'low_stock', 'out_of_stock'] as const).map((v) => ({ value: v, label: t(`catalog.stock.${v}`) }))} />
      <span className="flex shrink-0 items-center gap-2">
        <Input type="number" aria-label={t('catalog.filter.gapMin')} placeholder={t('catalog.filter.gapMin')} className="tabular w-32"
          value={filters.gapMin ?? ''} onChange={numChange('gapMin')} />
        <Input type="number" aria-label={t('catalog.filter.gapMax')} placeholder={t('catalog.filter.gapMax')} className="tabular w-32"
          value={filters.gapMax ?? ''} onChange={numChange('gapMax')} />
      </span>

      {count > 0 && (
        <>
          <span className={pillCls('brand')} aria-live="polite">
            {t('catalog.filter.count', { n: count })}
          </span>
          <Button variant="ghost" onClick={onClear}>{t('common.state.clearFilters')}</Button>
        </>
      )}
    </div>
  );
}
