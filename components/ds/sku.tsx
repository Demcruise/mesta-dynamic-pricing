'use client';

import { MoreHorizontal, Sparkles, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pill } from '@/components/ds/Pill';
import { Sparkline } from '@/components/ds/Sparkline';
import { CellStack } from '@/components/ds/numeric';
import { elasticityBand, marginHealth, marginPct } from '@/lib/domain';
import { formatDate, formatPercent, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { cn } from '@/lib/utils';

/*
 * SKU cell family (backlog v11 ARCH-001 / ARCH-002). Every surface that renders a SKU dataset —
 * Catalog, Competitors, Signals, Monitoring, Guardrails, Simulation, Recommendations, Approvals,
 * drawers, Audit — composes these instead of styling cells locally, so the same value always has
 * the same typography, alignment, and footprint. None of them wrap: each is one or two fixed lines.
 */

export { ProductIdentity as SkuIdentity } from '@/components/ds/ProductIdentity';

const HEALTH_TEXT = { healthy: 'text-up', thin: 'text-warn', critical: 'text-down' } as const;
const HEALTH_BAR = { healthy: 'bg-up-graphic', thin: 'bg-warn', critical: 'bg-down-graphic' } as const;
const STOCK_TEXT = { in_stock: 'text-faint', low_stock: 'text-warn', out_of_stock: 'text-down' } as const;

/** TABLE-008 — SKU identifier: tabular, never wraps; link hover only underlines (no layout change). */
export function SkuId({ sku, href }: { sku: string; href?: string }) {
  const cls = 'tabular whitespace-nowrap text-[13px] font-semibold';
  return href
    ? <Link className={cn(cls, 'text-brand underline-offset-2 hover:underline')} href={href}>{sku}</Link>
    : <span className={cn(cls, 'text-fg')}>{sku}</span>;
}

/** TABLE-011 — margin %, health label below (text, not colour alone), with a 40px meter. */
export function SkuMargin({ product }: { product: Product }) {
  const { t, locale } = useTranslation();
  const health = marginHealth(product);
  const pct = marginPct(product);
  const fill = Math.max(0, Math.min(1, pct));
  return (
    <CellStack
      align="right"
      primary={
        <span className="inline-flex items-center gap-2">
          <span
            role="meter" aria-label={t('catalog.col.margin')} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(fill * 100)}
            className="h-1.5 w-10 overflow-hidden rounded-full bg-line-strong"
          >
            <span className={cn('block h-full origin-left rounded-full', HEALTH_BAR[health])} style={{ transform: `scaleX(${fill})` }} />
          </span>
          <span className="tabular font-semibold text-fg">{formatPercent(pct, locale)}</span>
        </span>
      }
      secondary={<span className={HEALTH_TEXT[health]}>{t(`catalog.health.${health}`)}</span>}
    />
  );
}

/** TABLE-012 — elasticity band as a fixed-height pill. */
export function SkuElasticity({ elasticity }: { elasticity: number }) {
  const { t } = useTranslation();
  return <Pill size="sm" tone="neutral">{t(`catalog.elasticity.${elasticityBand(elasticity)}`)}</Pill>;
}

/** TABLE-013 — quantity over stock state. */
export function SkuStock({ product }: { product: Pick<Product, 'stockUnits' | 'stockStatus'> }) {
  const { t, locale } = useTranslation();
  return (
    <CellStack
      align="right"
      primary={<span className="tabular font-semibold text-fg">{product.stockUnits.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')}</span>}
      secondary={<span className={STOCK_TEXT[product.stockStatus]}>{t(`catalog.stock.${product.stockStatus}`)}</span>}
    />
  );
}

/** TABLE-014 — absolute timestamp over relative time, both single-line. */
export function SkuLastChange({ at }: { at: string }) {
  const { locale } = useTranslation();
  return (
    <CellStack
      primary={<time dateTime={at} className="tabular text-fg">{formatDate(at, locale)}</time>}
      secondary={formatRelativeTime(at, locale)}
    />
  );
}

/** TABLE-015 — fixed 88×28 sparkline slot; size never depends on the data. */
export function SkuTrend({ points }: { points: number[] }) {
  const up = (points[points.length - 1] ?? 0) >= (points[0] ?? 0);
  return (
    <span className="mx-auto flex h-7 w-[88px] items-center justify-center">
      <Sparkline points={points} tone={up ? 'up' : 'down'} className="h-7 w-[88px]" />
    </span>
  );
}

/** TABLE-016 — AI state: one-line agent pill (truncated, full label in the tooltip) or a reserved dash. */
export function SkuRecommendationBadge({ label, emptyLabel }: { label?: string | undefined; emptyLabel: string }) {
  if (!label) return <span className="text-faint" aria-label={emptyLabel}>—</span>;
  return (
    <span className="inline-flex max-w-full" title={label}>
      <Pill size="sm" tone="agent" icon={Sparkles} className="min-w-0 max-w-full shrink overflow-hidden"><span className="truncate">{label}</span></Pill>
    </span>
  );
}

export interface SkuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
}

const ACTION_BTN = 'grid size-8 shrink-0 place-items-center rounded-row text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg';

/**
 * TABLE-017 — row actions: right-aligned, 8px gap, 32px hit areas. Up to `inline` actions render as
 * icon buttons; the rest go to a `…` overflow menu, so availability never shifts other columns.
 */
export function SkuActions({ actions, inline = 3, subject, moreLabel }: {
  actions: SkuAction[];
  inline?: number;
  /** Appended to each accessible name, e.g. the SKU. */
  subject: string;
  moreLabel: string;
}) {
  const shown = actions.length > inline + 1 ? actions.slice(0, inline) : actions;
  const overflow = actions.length > inline + 1 ? actions.slice(inline) : [];
  return (
    <div className="flex items-center justify-end gap-2">
      {shown.map((a) => <ActionButton key={a.id} action={a} subject={subject} />)}
      {overflow.length > 0 && <SkuRowMenu actions={overflow} subject={subject} label={moreLabel} />}
    </div>
  );
}

function ActionButton({ action, subject }: { action: SkuAction; subject: string }) {
  const Icon = action.icon;
  const name = `${action.label} ${subject}`;
  return action.href
    ? <Link href={action.href} aria-label={name} title={action.label} className={ACTION_BTN}><Icon className="size-4" aria-hidden /></Link>
    : <button type="button" onClick={action.onSelect} aria-label={name} title={action.label} className={ACTION_BTN}><Icon className="size-4" aria-hidden /></button>;
}

/** Overflow `…` menu for secondary row actions. Escape / outside click closes; focus returns to the trigger. */
export function SkuRowMenu({ actions, subject, label }: { actions: SkuAction[]; subject: string; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const item = 'flex h-9 w-full items-center gap-2 rounded-row px-2.5 text-left text-[13px] text-fg hover:bg-subtle';
  return (
    <div ref={ref} className="relative">
      <button
        ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open}
        aria-label={`${label} ${subject}`} title={label}
        onClick={() => setOpen((o) => !o)} className={ACTION_BTN}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-30 min-w-44 rounded-card border border-line bg-surface p-1 shadow-e3">
          {actions.map((a) => {
            const Icon = a.icon;
            const body = <><Icon className="size-4 text-muted" aria-hidden />{a.label}</>;
            return a.href
              ? <Link key={a.id} role="menuitem" href={a.href} className={item} onClick={() => setOpen(false)}>{body}</Link>
              : <button key={a.id} role="menuitem" type="button" className={item} onClick={() => { setOpen(false); a.onSelect?.(); }}>{body}</button>;
          })}
        </div>
      )}
    </div>
  );
}

/** Convenience for a label + value pair inside a SKU card/drawer (CROSS-001). */
export function SkuFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="tabular mt-1 truncate text-sm font-semibold text-fg">{children}</dd>
    </div>
  );
}
