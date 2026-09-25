import { Suspense } from 'react';
import { WorkspacesPage } from '@/features/auth/FlowPages';

export default function Page() {
  return (
    <Suspense>
      <WorkspacesPage />
    </Suspense>
  );
}
