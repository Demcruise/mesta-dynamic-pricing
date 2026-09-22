'use client';

import { Check, Clock, Pencil, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Status = 'pending' | 'approved' | 'rejected' | 'adjusted' | 'stale';

const STYLE = {
  pending: { icon: Clock, cls: 'bg-info-soft text-info' },
  approved: { icon: Check, cls: 'bg-up-soft text-up' },
  rejected: { icon: X, cls: 'bg-down-soft text-down' },
  adjusted: { icon: Pencil, cls: 'bg-brand-soft text-brand' },
  stale: { icon: TriangleAlert, cls: 'bg-warn-soft text-warn' },
} as const;

export function StatusChip({ status, className }: { status: Status; className?: string }) {
  const { t } = useTranslation();
  const { icon: Icon, cls } = STYLE[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cls, className)}>
      <Icon className="size-3" aria-hidden />
      {t(`common.status.${status}`)}
    </span>
  );
}
