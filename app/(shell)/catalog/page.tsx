import { Suspense } from 'react';
import { CatalogPage } from '@/features/catalog/CatalogPage';

export default function Page() {
  return (
    <Suspense>
      <CatalogPage />
    </Suspense>
  );
}
