import { StrategyWizard } from '@/features/strategy/StrategyWizard';

export default async function Page({ params }: { params: Promise<{ strategyId: string }> }) {
  const { strategyId } = await params;
  return <StrategyWizard strategyId={decodeURIComponent(strategyId)} />;
}
