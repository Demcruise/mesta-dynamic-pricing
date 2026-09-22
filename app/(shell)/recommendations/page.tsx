import { Suspense } from 'react';
import { QueuePage } from '@/features/recommendations/QueuePage';

export default function Page() {
  return (
    <Suspense>
      <QueuePage />
    </Suspense>
  );
}
