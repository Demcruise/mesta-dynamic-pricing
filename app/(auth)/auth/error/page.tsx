import { Suspense } from 'react';
import { AuthErrorPage } from '@/features/auth/FlowPages';

export default function Page() {
  return (
    <Suspense>
      <AuthErrorPage />
    </Suspense>
  );
}
