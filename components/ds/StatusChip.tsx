'use client';

import { StatusBadge } from './StatusBadge';

export type Status = 'pending' | 'approved' | 'rejected' | 'adjusted' | 'stale';

/** Recommendation lifecycle chip — kept as a thin alias of the unified StatusBadge. */
export function StatusChip({ status, className }: { status: Status; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}
