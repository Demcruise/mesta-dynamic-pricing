import { Suspense } from 'react';
import { AlertsPage } from '@/features/alerts/AlertsPage';

export default function Page() {
  return (
    <Suspense>
      <AlertsPage />
    </Suspense>
  );
}
