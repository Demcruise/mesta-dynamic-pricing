'use client';

import { useCallback } from 'react';
import type { Locale } from '../format';
import { useUiStore } from '../stores/ui';
import idCommon from './id/common.json';
import idCatalog from './id/catalog.json';
import enCommon from './en/common.json';
import enCatalog from './en/catalog.json';

/** One file per namespace per locale; add new namespaces here. */
export const messages = {
  id: { common: idCommon, catalog: idCatalog },
  en: { common: enCommon, catalog: enCatalog },
} as const;

type Tree = { [k: string]: string | Tree };

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let node: string | Tree | undefined = messages[locale] as unknown as Tree;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') {
    if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key "${key}" (${locale})`);
    return key;
  }
  return vars ? node.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : node;
}

/** Keys are "namespace.path", e.g. t('common.nav.catalog'). */
export function useTranslation() {
  const locale = useUiStore((s) => s.locale);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  return { t, locale };
}
