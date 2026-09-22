import { Suspense } from 'react';
import { SimulationPage } from '@/features/simulation/SimulationPage';

export default function Page() {
  return (
    <Suspense>
      <SimulationPage />
    </Suspense>
  );
}
