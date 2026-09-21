'use client';

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useSessionStore } from '@/lib/stores/session';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function EmptyState({
  title, action, className, children,
}: { title: string; action?: { label: string; onClick: () => void }; className?: string; children?: ReactNode }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-card border border-dashed border-line p-10 text-center', className)}>
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

export function LoadingRows({ rows = 8, rowHeight = 44 }: { rows?: number; rowHeight?: number }) {
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

export function KpiCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 break-words text-xl font-semibold text-fg sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function PermissionDeniedState() {
  const { t } = useTranslation();
  const role = useSessionStore((s) => s.user.role);
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-10 text-center">
      <Lock className="size-6 text-faint" aria-hidden />
      <h2 className="text-base font-semibold">{t('common.perm.deniedTitle')}</h2>
      <p className="text-sm text-muted">{t('common.perm.deniedBody', { role: t(`common.role.${role}`) })}</p>
    </div>
  );
}
