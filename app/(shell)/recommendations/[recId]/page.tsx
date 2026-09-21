import { RecommendationDetailPage } from '@/features/recommendations/DetailPage';

export default async function Page({ params }: { params: Promise<{ recId: string }> }) {
  const { recId } = await params;
  return <RecommendationDetailPage recId={decodeURIComponent(recId)} />;
}
