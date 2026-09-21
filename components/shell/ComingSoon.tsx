'use client';

import { EmptyState, PageHeader } from '@/components/ds/states';
import { useTranslation } from '@/lib/i18n';

export function ComingSoon({ pageKey }: { pageKey: 'overview' | 'strategy' | 'simulation' | 'recommendations' | 'deployment' | 'monitoring' | 'audit' }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(`common.page.${pageKey}`)} />
      <EmptyState title={t('common.page.comingSoon')} />
    </>
  );
}
