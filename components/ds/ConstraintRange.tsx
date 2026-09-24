'use client';

import { CircleAlert, CircleCheck, CircleX, Info } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type { BoundSource, BoundsExplanation } from '@/lib/guardrails';
import { formatPrice } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/*
 * ConstraintRange — backlog v11 STRATEGY-007…023. Replaces the dot strip with an explainable
 * interval chart: one row per constraint (product, strategy, change-per-cycle, MAP) on a shared
 * price scale, the effective range as their intersection, and the current price as one vertical
 * line through every row. Every value is printed (no hover needed); hover/focus adds the source.
 * Reused wherever Mesta explains price limits: Strategy, SKU detail, Guardrails, Recommendations,
 * Approvals.
 */

type Tone = 'neutral' | 'effective' | 'invalid';

interface Row {
  id: string;
  label: string;
  source: string;
  kind: 'interval' | 'point';
  min: number | null;
  max: number | null;
  tone: Tone;
  muted?: boolean;
  /** Text shown in the value column. */
  value: ReactNode;
}

const STATE_ICON = { within: CircleCheck, below: CircleAlert, above: CircleAlert, equal: Info, invalid: CircleX } as const;
const STATE_CLS = {
  within: 'bg-up-soft text-up',
  below: 'bg-warn-soft text-warn',
  above: 'bg-warn-soft text-warn',
  equal: 'bg-info-soft text-info',
  invalid: 'bg-critical-soft text-critical',
} as const;

export function ConstraintRange({ bounds, proposed, strategyName, compact = false, className }: {
  bounds: BoundsExplanation;
  /** Optional recommended price, drawn as a second marker (recommendation / approval details). */
  proposed?: number | undefined;
  strategyName?: string | undefined;
  /** Hide the plain-language intro and the derivation disclosure (dense drawers). */
  compact?: boolean;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const headingId = useId();
  const b = bounds;
  const fmt = (n: number) => formatPrice(n, locale);
  const invalid = b.state === 'invalid';

  // Shared scale across every row.
  const values = [b.productMin, b.productMax, b.map, b.current, b.strategyMin, b.strategyMax, b.changeMin, b.changeMax, proposed]
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const lo = Math.min(...values) * 0.94;
  const hi = Math.max(...values) * 1.04;
  const pos = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;

  const range = (min: number | null, max: number | null) => (
    <>
      <span className={min === null ? 'text-faint' : undefined}>{min === null ? t('common.bounds.noMin') : fmt(min)}</span>
      <span className="px-1 text-faint">–</span>
      <span className={max === null ? 'text-faint' : undefined}>{max === null ? t('common.bounds.noMax') : fmt(max)}</span>
    </>
  );

  const strategyConfigured = b.strategyMin !== null || b.strategyMax !== null;
  const changePct = b.changeMin !== null ? Math.round((1 - b.changeMin / b.current) * 100) : 0;
  const rows: Row[] = [
    { id: 'product', label: t('common.bounds.row.product'), source: t('common.bounds.source.product'), kind: 'interval', min: b.productMin, max: b.productMax, tone: 'neutral', value: range(b.productMin, b.productMax) },
    {
      id: 'strategy', label: t('common.bounds.row.strategy'),
      source: strategyName ? t('common.bounds.source.strategyNamed', { name: strategyName }) : t('common.bounds.source.strategy'),
      kind: 'interval', min: b.strategyMin, max: b.strategyMax, tone: 'neutral', muted: !strategyConfigured,
      value: strategyConfigured ? range(b.strategyMin, b.strategyMax) : <span className="text-faint">{t('common.bounds.strategyUnset')}</span>,
    },
    {
      id: 'change', label: t('common.bounds.row.change'),
      source: b.changeMin !== null ? t('common.bounds.source.change', { pct: changePct }) : t('common.bounds.changeOff'),
      kind: 'interval', min: b.changeMin, max: b.changeMax, tone: 'neutral', muted: b.changeMin === null,
      value: b.changeMin !== null ? range(b.changeMin, b.changeMax) : <span className="text-faint">{t('common.bounds.changeOff')}</span>,
    },
    {
      id: 'map', label: t('common.bounds.row.map'),
      source: b.mapEnforced ? t('common.bounds.source.map') : t('common.bounds.source.mapOff'),
      kind: 'point', min: b.map, max: b.map, tone: 'neutral', muted: !b.mapEnforced,
      value: <span className={b.mapEnforced ? undefined : 'text-faint line-through'}>{fmt(b.map)}</span>,
    },
    {
      id: 'effective', label: t('common.bounds.row.effective'), source: t('common.bounds.source.effective'),
      kind: 'interval', min: b.effectiveMin, max: b.effectiveMax, tone: invalid ? 'invalid' : 'effective',
      value: invalid ? <span className="font-semibold text-critical">{t('common.bounds.noRange')}</span> : <span className="font-semibold text-fg">{range(b.effectiveMin, b.effectiveMax)}</span>,
    },
  ];

  const termLabel = (s: BoundSource, side: 'min' | 'max') =>
    t(`common.bounds.term.${s}${side === 'max' && s !== 'map' ? 'Max' : ''}`);
  const bindingText = (sources: BoundSource[], side: 'min' | 'max') =>
    t('common.bounds.derivedFrom', { sources: sources.map((s) => termLabel(s, side)).join(' + ') });

  const aria = (invalid
    ? t('common.bounds.ariaInvalid', { min: fmt(b.effectiveMin), max: fmt(b.effectiveMax), current: fmt(b.current) })
    : t('common.bounds.aria', { min: fmt(b.effectiveMin), max: fmt(b.effectiveMax), current: fmt(b.current) }))
    + (b.mapEnforced ? t('common.bounds.ariaMap', { map: fmt(b.map) }) : '');

  const StateIcon = STATE_ICON[b.state];
  const currentOut = b.state === 'below' || b.state === 'above' || invalid;

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-4', className)}>
      <div>
        <h3 id={headingId} className="text-section">{t('common.bounds.title')}</h3>
        {!compact && <p className="mt-1 max-w-prose text-body-sm text-muted">{t('common.bounds.help')}</p>}
      </div>

      {/* STRATEGY-012 — the three numbers that matter, printed, never behind hover. */}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure label={t('common.bounds.effectiveMin')} value={fmt(b.effectiveMin)} note={bindingText(b.minBinding, 'min')} tone={invalid ? 'invalid' : undefined} />
        <Figure label={proposed !== undefined ? t('common.bounds.proposed') : t('common.bounds.current')} value={fmt(proposed ?? b.current)}
          note={proposed !== undefined ? `${t('common.bounds.current')}: ${fmt(b.current)}` : t('common.bounds.source.current')} tone={currentOut ? 'warn' : 'brand'} />
        <Figure label={t('common.bounds.effectiveMax')} value={fmt(b.effectiveMax)} note={bindingText(b.maxBinding, 'max')} tone={invalid ? 'invalid' : undefined} />
      </dl>

      <p role="status" className={cn('flex items-start gap-2 rounded-input px-3 py-2 text-body-sm font-medium', STATE_CLS[b.state])}>
        <StateIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t(`common.bounds.state.${b.state}`)}
      </p>

      {/* Visual twin of the text above: decorative for assistive tech, which gets `aria` instead. */}
      <div role="img" aria-label={aria} className="rounded-card border border-line">
        <div className={cn('hidden grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,12rem)] gap-x-4 px-4 pt-2 sm:grid', proposed !== undefined ? 'h-[60px]' : 'h-9')}>
          <span />
          <span className="relative h-full" aria-hidden>
            <Marker pct={pos(b.current)} label={`${t('common.bounds.current')} · ${fmt(b.current)}`} tone={currentOut ? 'warn' : 'brand'} line={0} />
            {proposed !== undefined && <Marker pct={pos(proposed)} label={`${t('common.bounds.proposed')} · ${fmt(proposed)}`} tone="agent" line={1} />}
          </span>
          <span />
        </div>
        <ul aria-hidden>
          {rows.map((r) => {
            const left = r.min === null ? 0 : pos(r.min);
            const right = r.max === null ? 100 : pos(r.max);
            const binding = (r.id !== 'effective' && (b.minBinding.includes(r.id as BoundSource) || b.maxBinding.includes(r.id as BoundSource))) && !r.muted;
            return (
              <li
                key={r.id}
                tabIndex={-1}
                title={`${r.label} — ${r.source}`}
                className={cn(
                  'grid grid-cols-1 items-center gap-x-4 gap-y-1.5 border-t border-divider px-4 py-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,12rem)]',
                  r.id === 'effective' && 'bg-subtle',
                )}
              >
                <span className="min-w-0">
                  <span className={cn('flex items-center gap-1.5 text-label', r.id === 'effective' ? 'font-semibold text-fg' : r.muted ? 'text-faint' : 'text-fg')}>
                    <span className="truncate">{r.label}</span>
                    {binding && <span className="shrink-0 rounded-full bg-brand-soft px-1.5 text-[11px] font-semibold leading-5 text-brand">{t('common.bounds.binding')}</span>}
                  </span>
                  <span className="block truncate text-caption text-faint">{r.source}</span>
                </span>
                <span className="relative h-6">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
                  {!(r.id === 'effective' && invalid) && !(r.muted && r.kind === 'interval') && (
                    r.kind === 'point' ? (
                      <span className={cn('absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full', r.muted ? 'bg-line-strong' : 'bg-warn')} style={{ left: `${pos(r.min!)}%` }} />
                    ) : (
                      <span
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 rounded-full',
                          r.tone === 'effective' ? 'h-3 bg-up-soft ring-1 ring-inset ring-up-graphic' : 'h-2 bg-line-strong',
                          r.min === null && 'rounded-l-none',
                          r.max === null && 'rounded-r-none',
                        )}
                        style={{ left: `${left}%`, width: `${Math.max(0.8, right - left)}%` }}
                      />
                    )
                  )}
                  {r.id === 'effective' && invalid && (
                    <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-critical/40" />
                  )}
                  {/* The current price runs through every row as one line. */}
                  <span className={cn('absolute inset-y-0 w-0.5 -translate-x-1/2', currentOut ? 'bg-warn' : 'bg-brand')} style={{ left: `${pos(b.current)}%` }} />
                  {proposed !== undefined && <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-agent" style={{ left: `${pos(proposed)}%` }} />}
                </span>
                <span className="tabular truncate whitespace-nowrap text-body-sm sm:text-right">{r.value}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {!compact && (
        <details className="group rounded-card border border-line px-4 py-3">
          <summary className="cursor-pointer list-none text-label font-medium text-brand [&::-webkit-details-marker]:hidden">
            {t('common.bounds.why')}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Derivation
              title={`${t('common.bounds.effectiveMin')}: ${fmt(b.effectiveMin)}`}
              fn="Max"
              terms={b.minTerms.map((x) => ({ label: termLabel(x.source, 'min'), value: fmt(x.value), binding: b.minBinding.includes(x.source) }))}
            />
            <Derivation
              title={`${t('common.bounds.effectiveMax')}: ${fmt(b.effectiveMax)}`}
              fn="Min"
              terms={b.maxTerms.map((x) => ({ label: termLabel(x.source, 'max'), value: fmt(x.value), binding: b.maxBinding.includes(x.source) }))}
            />
          </div>
        </details>
      )}
    </section>
  );
}

function Figure({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'brand' | 'warn' | 'invalid' | undefined }) {
  return (
    <div className="min-w-0 rounded-card border border-line px-4 py-3">
      <dt className="text-caption font-medium text-muted">{label}</dt>
      <dd className={cn('tabular mt-1 text-numeric-md font-semibold', tone === 'brand' ? 'text-brand' : tone === 'warn' ? 'text-warn' : tone === 'invalid' ? 'text-critical' : 'text-fg')}>{value}</dd>
      <dd className="mt-0.5 truncate text-caption text-faint" title={note}>{note}</dd>
    </div>
  );
}

function Marker({ pct, label, tone, line }: { pct: number; label: string; tone: 'brand' | 'warn' | 'agent'; line: 0 | 1 }) {
  const cls = tone === 'brand' ? 'bg-brand text-brand-fg' : tone === 'warn' ? 'bg-warn text-surface' : 'bg-agent text-surface';
  // Clamp the label inside the track so it never overflows the card at either end.
  const shift = pct < 12 ? '0%' : pct > 88 ? '-100%' : '-50%';
  return (
    <span
      className={cn('tabular absolute whitespace-nowrap rounded-full px-2 text-[11px] font-semibold leading-5', cls)}
      style={{ left: `${Math.min(100, Math.max(0, pct))}%`, top: line * 24, transform: `translateX(${shift})` }}
    >
      {label}
    </span>
  );
}

function Derivation({ title, fn, terms }: { title: string; fn: 'Max' | 'Min'; terms: { label: string; value: string; binding: boolean }[] }) {
  return (
    <div className="min-w-0">
      <p className="text-label font-semibold text-fg">{title}</p>
      <p className="mt-1 font-mono text-caption text-muted">{fn}(</p>
      <ul className="ml-4 flex flex-col gap-1">
        {terms.map((x) => (
          <li key={x.label} className={cn('flex items-center justify-between gap-4 text-body-sm', x.binding ? 'font-semibold text-fg' : 'text-muted')}>
            <span className="truncate">{x.label}</span>
            <span className="tabular whitespace-nowrap">{x.value}</span>
          </li>
        ))}
      </ul>
      <p className="font-mono text-caption text-muted">)</p>
    </div>
  );
}
