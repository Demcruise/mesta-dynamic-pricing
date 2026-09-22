'use client';

import { useCallback } from 'react';
import type { Locale } from '../format';
import { useUiStore } from '../stores/ui';
import idCommon from './id/common.json';
import idCatalog from './id/catalog.json';
import idStrategy from './id/strategy.json';
import idSimulation from './id/simulation.json';
import idRecommendations from './id/recommendations.json';
import enCommon from './en/common.json';
import enCatalog from './en/catalog.json';
import enStrategy from './en/strategy.json';
import enSimulation from './en/simulation.json';
import enRecommendations from './en/recommendations.json';
import idDeployment from './id/deployment.json';
import idMonitoring from './id/monitoring.json';
import idAudit from './id/audit.json';
import idOverview from './id/overview.json';
import enDeployment from './en/deployment.json';
import enMonitoring from './en/monitoring.json';
import enAudit from './en/audit.json';
import enOverview from './en/overview.json';

/** One file per namespace per locale; add new namespaces here. */
export const messages = {
  id: { common: idCommon, catalog: idCatalog, strategy: idStrategy, simulation: idSimulation, recommendations: idRecommendations, deployment: idDeployment, monitoring: idMonitoring, audit: idAudit, overview: idOverview },
  en: { common: enCommon, catalog: enCatalog, strategy: enStrategy, simulation: enSimulation, recommendations: enRecommendations, deployment: enDeployment, monitoring: enMonitoring, audit: enAudit, overview: enOverview },
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
