import { Suspense } from 'react';
import { ExceptionsPage } from '@/features/exceptions/ExceptionsPage';

export default function Page() {
  return (
    <Suspense>
      <ExceptionsPage />
    </Suspense>
  );
}
