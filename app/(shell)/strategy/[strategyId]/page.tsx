import { StrategyDetailPage } from '@/features/strategy/StrategyDetailPage';

export default async function Page({ params }: { params: Promise<{ strategyId: string }> }) {
  const { strategyId } = await params;
  return <StrategyDetailPage strategyId={decodeURIComponent(strategyId)} />;
}
