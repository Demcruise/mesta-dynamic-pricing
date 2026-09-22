import { Suspense } from 'react';
import { SimulationPage } from '@/features/simulation/SimulationPage';

export default async function Page({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  return (
    <Suspense>
      <SimulationPage scenarioId={decodeURIComponent(scenarioId)} />
    </Suspense>
  );
}
