'use client';

import { CheckCircle2, FilterX, Inbox, Lock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useSessionStore } from '@/lib/stores/session';
import { useCountUp } from '@/lib/use-count-up';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DeltaBadge } from './DeltaBadge';
import { Sparkline } from './Sparkline';

const EMPTY_ICONS: Record<string, { icon: LucideIcon; cls: string }> = {
  empty: { icon: Inbox, cls: 'bg-subtle text-faint' },
  filter: { icon: FilterX, cls: 'bg-info-soft text-info' },
  caughtUp: { icon: CheckCircle2, cls: 'bg-up-soft text-up' },
};

export function EmptyState({
  title, action, className, children, variant = 'empty',
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  children?: ReactNode;
  /** Icon treatment per context: no data yet, filters excluded everything, or work is done. */
  variant?: 'empty' | 'filter' | 'caughtUp';
}) {
  const { icon: Icon, cls } = EMPTY_ICONS[variant]!;
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-card border border-dashed border-line p-10 text-center', className)}>
      <span aria-hidden className={cn('grid size-10 place-items-center rounded-full', cls)}><Icon className="size-5" /></span>
      <p className="text-sm text-muted">{title}</p>
      {children}
      {action && <Button variant="secondary" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}

export function ErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-line bg-critical-soft p-10 text-center">
      <p className="text-sm text-critical">{title}</p>
      <Button variant="secondary" onClick={onRetry}>{t('common.state.retry')}</Button>
    </div>
  );
}

export function LoadingRows({ rows = 8, rowHeight = 'var(--row-h)' }: { rows?: number; rowHeight?: number | string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-label={t('common.state.loading')} className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="animate-pulse px-3 py-2" style={{ height: rowHeight }}>
          <div className="h-full rounded bg-subtle" />
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function KpiCard({ label, value, format, hint, spark, delta }: {
  label: string; value: number | ReactNode; hint?: ReactNode;
  /** Formats the animated number (e.g. percent/currency). Defaults to rounded integer. */
  format?: (value: number) => string;
  /** Per-period series for the inline sparkline (same source as the KPI value). */
  spark?: number[];
  /** Ratio change between the last two periods — icon+label badge, never colour alone. */
  delta?: number;
}) {
  const numeric = typeof value === 'number';
  const animated = useCountUp(numeric ? value : 0, numeric);
  const shown = numeric ? (format ? format(animated) : String(Math.round(animated))) : value;
  return (
    <div className="rounded-card border border-line bg-surface p-card shadow-e1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        {spark && spark.length > 1 && <Sparkline points={spark} className="h-7 w-16 shrink-0 text-faint" />}
      </div>
      <p className="tabular mt-1 break-words text-xl font-semibold text-fg sm:text-2xl">{shown}</p>
      {(delta !== undefined || hint) && (
        <p className="mt-1 flex items-center gap-2 text-xs text-faint">
          {delta !== undefined && <DeltaBadge value={delta} />}
          {hint}
        </p>
      )}
    </div>
  );
}

export function PermissionDeniedState() {
  const { t } = useTranslation();
  const role = useSessionStore((s) => s.user.role);
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-10 text-center shadow-e1">
      <Lock className="size-6 text-faint" aria-hidden />
      <h2 className="text-base font-semibold">{t('common.perm.deniedTitle')}</h2>
      <p className="text-sm text-muted">{t('common.perm.deniedBody', { role: t(`common.role.${role}`) })}</p>
    </div>
  );
}
