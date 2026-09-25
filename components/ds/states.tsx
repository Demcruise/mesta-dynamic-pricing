'use client';

import { CheckCircle2, FilterX, Inbox, Lock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/stores/session';
import { useToastStore } from '@/lib/stores/toast';
import { useCountUp } from '@/lib/use-count-up';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DeltaBadge, type Polarity } from './DeltaBadge';
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
    <div className={cn('flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong p-10 text-center', className)}>
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
    <div role="status" aria-live="polite" aria-label={t('common.state.loading')} className="flex flex-col gap-1.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="animate-pulse rounded-row bg-row" style={{ height: rowHeight }} />
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-label text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Reference icon tile. `tile` = 20px soft-brand tile used on metric cards;
 * `box` = 26px neutral bordered tile used on panel/chart headers.
 */
export function IconBox({ icon: Icon, variant = 'box', className }: { icon: LucideIcon; variant?: 'tile' | 'box'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center text-fg',
        variant === 'tile' ? 'size-5 rounded-md bg-brand-soft' : 'size-[26px] rounded-[7px] border border-line-icon bg-icon',
        className,
      )}
    >
      <Icon className={variant === 'tile' ? 'size-3' : 'size-3.5'} strokeWidth={2} />
    </span>
  );
}

/**
 * Standard content card (reference "Holdings"-style panel): 12px radius, 1px edge, flat,
 * header = icon box + title (+ optional description) + optional trailing actions.
 * Every Overview/aside section uses this so padding and header rhythm are identical.
 */
export function Panel({ title, icon, description, actions, children, className, bodyClassName, as: Tag = 'section', 'aria-label': ariaLabel }: {
  title: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'div';
  'aria-label'?: string;
}) {
  return (
    <Tag aria-label={ariaLabel} className={cn('min-w-0 rounded-card border border-line bg-surface p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <IconBox icon={icon} />}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium tracking-label text-fg">{title}</h2>
            {description && <p className="mt-0.5 truncate text-xs text-faint">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('mt-3', bodyClassName)}>{children}</div>
    </Tag>
  );
}

/**
 * Metric card — reference anatomy: fixed 152px height; header = 20px icon tile + 12px
 * medium label (+ definition trigger right); footer = 28px figure over a delta line
 * (coloured arrow + %, then the comparison label), sparkline bottom-right coloured by
 * sentiment. Flat surface, 12px radius, 1px edge.
 */
export function KpiCard({ label, value, format, hint, spark, delta, icon, polarity = 'higher-better', comparison, className }: {
  label: ReactNode; value: number | ReactNode; hint?: ReactNode;
  /** Formats the animated number (e.g. percent/currency). Defaults to rounded integer. */
  format?: (value: number) => string;
  /** Per-period series for the inline sparkline (same source as the KPI value). */
  spark?: number[];
  /** Ratio change between the last two periods — icon+label, never colour alone. */
  delta?: number;
  icon?: LucideIcon;
  /** Whether a rise is good, bad or neither — drives delta/sparkline colour, never the arrow. */
  polarity?: Polarity;
  /** Label after the delta, e.g. "vs previous period". */
  comparison?: ReactNode;
  className?: string;
}) {
  const numeric = typeof value === 'number';
  const animated = useCountUp(numeric ? value : 0, numeric);
  const shown = numeric ? (format ? format(animated) : String(Math.round(animated))) : value;
  const good = delta === undefined || Math.abs(delta) < 0.0005 || polarity === 'neutral'
    ? 'muted'
    : (delta > 0) === (polarity === 'higher-better') ? 'up' : 'down';
  return (
    <div className={cn('flex h-[152px] min-w-0 flex-col justify-between rounded-card border border-line bg-surface p-4', className)}>
      <div className="flex items-center gap-1.5">
        {icon && <IconBox icon={icon} variant="tile" />}
        <div className="min-w-0 flex-1 truncate text-xs font-medium leading-none tracking-label text-fg">{label}</div>
        {hint}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="tabular truncate text-[28px] font-semibold leading-none tracking-figure text-fg">{shown}</p>
          {(delta !== undefined || comparison) && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs leading-none">
              {delta !== undefined && <DeltaBadge value={delta} variant="text" polarity={polarity} />}
              {comparison && <span className="truncate font-medium tracking-label text-faint">{comparison}</span>}
            </div>
          )}
        </div>
        {spark && spark.length > 1 && <Sparkline points={spark} tone={good} className="h-[26px] w-[58px] shrink-0" />}
      </div>
    </div>
  );
}

/**
 * AUTH-11 unauthorized state: what is blocked, which permission it needs (human label, never a
 * policy id), who to contact, and two ways forward — Back, or Request access.
 */
export function PermissionDeniedState({ action }: { action?: string | undefined }) {
  const { t } = useTranslation();
  const role = useSessionStore((s) => s.user.role);
  const toast = useToastStore((s) => s.push);
  const router = useRouter();
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-card border border-line bg-surface px-8 py-12 text-center">
      <Lock className="size-7 text-faint" aria-hidden />
      <h2 className="text-section text-fg">{t('auth.denied.title')}</h2>
      {action && (
        <p className="text-body-sm text-muted">
          {t('auth.denied.required')}: <span className="font-semibold text-fg">{t(`auth.permission.${action.replace('.', '_')}`)}</span>
        </p>
      )}
      <p className="text-body-sm text-muted">{t('auth.denied.yourRole', { role: t(`common.role.${role}`) })} · {t('auth.denied.contact')}</p>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" onClick={() => (window.history.length > 1 ? router.back() : router.push('/overview'))}>{t('auth.denied.back')}</Button>
        <Button onClick={() => toast(t('auth.denied.requested'))}>{t('auth.denied.request')}</Button>
      </div>
    </div>
  );
}
