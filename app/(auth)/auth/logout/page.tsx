import { Suspense } from 'react';
import { LogoutPage } from '@/features/auth/FlowPages';

export default function Page() {
  return (
    <Suspense>
      <LogoutPage />
    </Suspense>
  );
}
