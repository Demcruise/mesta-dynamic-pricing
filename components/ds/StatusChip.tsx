'use client';

import type { RecommendationStatus } from '@/lib/ontology';
import type { PillSize } from './Pill';
import { StatusBadge } from './StatusBadge';

export type Status = RecommendationStatus | 'stale';

/** Recommendation lifecycle chip — kept as a thin alias of the unified StatusBadge. */
export function StatusChip({ status, size, className }: { status: Status; size?: PillSize; className?: string }) {
  return <StatusBadge status={status} size={size} className={className} />;
}
