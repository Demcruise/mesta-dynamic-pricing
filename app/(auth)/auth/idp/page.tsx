import { Suspense } from 'react';
import { IdpPage } from '@/features/auth/FlowPages';

export default function Page() {
  return (
    <Suspense>
      <IdpPage />
    </Suspense>
  );
}
