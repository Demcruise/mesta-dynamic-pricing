'use client';

import { cn } from '@/lib/utils';

function Bar({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded bg-subtle', className)} />;
}

/** Route-level skeletons that mirror each page's real layout instead of a bare spinner. */
export function PageSkeleton({ variant }: { variant: 'table' | 'cards' | 'board' | 'detail' }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <Bar className="h-7 w-48" />
      {variant === 'cards' && (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Bar key={i} className="h-24 rounded-card" />)}
          </div>
          <Bar className="h-64 rounded-card" />
        </>
      )}
      {variant === 'board' && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Bar key={i} className="h-32 rounded-card" />)}
          </div>
          <div className="rounded-card border border-line">
            {Array.from({ length: 6 }, (_, i) => <Bar key={i} className="mx-3 my-2 h-row" />)}
          </div>
        </>
      )}
      {variant === 'table' && (
        <>
          <div className="flex gap-2"><Bar className="h-9 w-44" /><Bar className="h-9 w-44" /><Bar className="h-9 w-44" /></div>
          <div className="rounded-card border border-line">
            {Array.from({ length: 8 }, (_, i) => <Bar key={i} className="mx-3 my-2 h-row" />)}
          </div>
        </>
      )}
      {variant === 'detail' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Bar key={i} className="h-44 rounded-card" />)}
        </div>
      )}
    </div>
  );
}
