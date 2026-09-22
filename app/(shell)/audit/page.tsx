import { Suspense } from 'react';
import { AuditPage } from '@/features/audit/AuditPage';

export default function Page() {
  return (
    <Suspense>
      <AuditPage />
    </Suspense>
  );
}
