'use client';

import { ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { ALL_STORES, buOf, ORG_NAME, regionOfStore, REGIONS, STORES_BY_REGION, type Region } from '@/lib/scope';
import { useUiStore } from '@/lib/stores';

/**
 * Context bar: the Org → BU → Region → Store slice every scoped page filters by.
 * Persisted in the ui store; choosing a store pins its region implicitly.
 */
export function ScopeSelector() {
  const { t } = useTranslation();
  const scope = useUiStore((s) => s.scope);
  const setScope = useUiStore((s) => s.setScope);
  const stores = scope.region ? STORES_BY_REGION[scope.region] : ALL_STORES;
  const bu = scope.region ? buOf(scope.region) : null;

  return (
    <div
      aria-label={t('common.scope.label')}
      className="flex items-center gap-1.5 overflow-x-auto border-b border-line bg-subtle px-4 py-1.5 text-xs text-muted md:px-6"
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      <span className="shrink-0 font-medium">{ORG_NAME}</span>
      <ChevronRight className="size-3 shrink-0 text-faint" aria-hidden />
      <span className="shrink-0 text-muted">{bu ?? t('common.scope.allBus')}</span>
      <ChevronRight className="size-3 shrink-0 text-faint" aria-hidden />
      <label className="sr-only" htmlFor="scope-region">{t('common.scope.region')}</label>
      <select
        id="scope-region"
        className="h-6 rounded-input border border-line bg-surface px-1.5 text-xs"
        value={scope.region ?? ''}
        onChange={(e) => setScope({ region: (e.target.value || null) as Region | null, store: null })}
      >
        <option value="">{t('common.scope.allRegions')}</option>
        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <ChevronRight className="size-3 shrink-0 text-faint" aria-hidden />
      <label className="sr-only" htmlFor="scope-store">{t('common.scope.store')}</label>
      <select
        id="scope-store"
        className="h-6 rounded-input border border-line bg-surface px-1.5 text-xs"
        value={scope.store ?? ''}
        onChange={(e) => {
          const store = e.target.value || null;
          setScope({ store, region: store ? regionOfStore(store) : scope.region });
        }}
      >
        <option value="">{scope.region ? t('common.scope.allStoresInRegion') : t('common.scope.allStores')}</option>
        {stores.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {(scope.region || scope.store) && (
        <button
          type="button"
          className="ml-1 shrink-0 text-brand transition-colors duration-fast hover:underline"
          onClick={() => setScope({ region: null, store: null })}
        >
          {t('common.scope.reset')}
        </button>
      )}
    </div>
  );
}
