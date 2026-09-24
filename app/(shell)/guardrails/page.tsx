import { Suspense } from 'react';
import { GuardrailsPage } from '@/features/guardrails/GuardrailsPage';

export default function Page() {
  return (
    <Suspense>
      <GuardrailsPage />
    </Suspense>
  );
}
