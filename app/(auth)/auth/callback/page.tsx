import { Suspense } from 'react';
import { CallbackPage } from '@/features/auth/FlowPages';

export default function Page() {
  return (
    <Suspense>
      <CallbackPage />
    </Suspense>
  );
}
