'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { bootstrapMestaData, STRESS_PRODUCT_COUNT } from '@/lib/bootstrap';
import { useTranslation } from '@/lib/i18n';
import {
  useAuditStore, useNotificationStore, useProductCatalogStore, useRecommendationStore,
  useDeploymentStore, useFeedbackStore, useMonitoringStore, useScenarioStore, useStrategyDraftStore, useStrategyStore, useUiStore,
} from '@/lib/stores';
import { useDevStore } from '@/lib/stores/dev';
import { usePublishJobStore } from '@/lib/stores/publish';
import { useRuleStore } from '@/lib/stores/rule';

/** Any store write invalidates its query domain, so hooks never go stale. */
function subscribeQueryInvalidation(qc: QueryClient) {
  const inv = (d: string) => () => void qc.invalidateQueries({ queryKey: [d] });
  const unsubs = [
    useProductCatalogStore.subscribe(inv('sku')),
    useRecommendationStore.subscribe(inv('recommendation')),
    useStrategyStore.subscribe(inv('strategy')),
    useAuditStore.subscribe(inv('audit')),
    useScenarioStore.subscribe(inv('scenario')),
    useDeploymentStore.subscribe(inv('deployment')),
    usePublishJobStore.subscribe(inv('deployment')),
    useRuleStore.subscribe(inv('rule')),
    useMonitoringStore.subscribe(inv('anomaly')),
    useMonitoringStore.subscribe(inv('sku')),
    useNotificationStore.subscribe(inv('notification')),
    useDevStore.subscribe(() => void qc.invalidateQueries()),
  ];
  return () => unsubs.forEach((u) => u());
}

function BootstrapProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const density = useUiStore((s) => s.density);
  const locale = useUiStore((s) => s.locale);

  useEffect(() => {
    // Hydrate persisted UI prefs and demo data only after mount → no SSR mismatch.
    void Promise.all([useUiStore.persist.rehydrate(), useStrategyDraftStore.persist.rehydrate(), useFeedbackStore.persist.rehydrate()]).then(() => {
      const stress = new URLSearchParams(window.location.search).get('skus');
      bootstrapMestaData(stress === String(STRESS_PRODUCT_COUNT) ? { productCount: STRESS_PRODUCT_COUNT } : {});
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.dataset.density = density;
    el.lang = locale;
  }, [theme, density, locale]);

  if (!ready) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center text-sm text-muted">
        {t('common.app.bootstrapping')}
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => subscribeQueryInvalidation(client), [client]);
  return (
    <QueryClientProvider client={client}>
      <BootstrapProvider>{children}</BootstrapProvider>
    </QueryClientProvider>
  );
}
