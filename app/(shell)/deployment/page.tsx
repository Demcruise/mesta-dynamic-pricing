import { Suspense } from 'react';
import { DeploymentPage } from '@/features/deployment/DeploymentPage';

export default function Page() {
  return (
    <Suspense>
      <DeploymentPage />
    </Suspense>
  );
}
