import { SkuDetailPage } from '@/features/catalog/SkuDetailPage';

export default async function Page({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  return <SkuDetailPage sku={decodeURIComponent(sku)} />;
}
