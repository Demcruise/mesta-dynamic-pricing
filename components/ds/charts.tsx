'use client';

import { BarChart3, LineChart as LineChartIcon, Table2, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { areaPath, niceTicks, smoothPath, type Pt } from '@/lib/chart-path';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Segmented } from '@/components/ui/segmented';
import { IconBox } from './states';

/* ─────────────────────────────────────────────────────────────────────────────
 * Chart system — reference ("Total Portfolio Value") anatomy.
 * Rendered in real pixels (ResizeObserver), so axis type stays a true 12px at every
 * card width instead of scaling with a viewBox. Colours are tokens only.
 * ──────────────────────────────────────────────────────────────────────────── */

export type SeriesTone = 'brand' | 'muted' | 'up' | 'down';
export interface Series {
  name: string;
  points: number[];
  /** Legacy stroke class (e.g. 'stroke-brand'); ignored when `tone` is set. */
  cls?: string;
  tone?: SeriesTone;
  /** Dashed, lower-emphasis line (forecast / baseline). */
  dash?: boolean;
  /** Gradient area under the line. Defaults on for the first solid series. */
  area?: boolean;
}

const TONE_TEXT: Record<SeriesTone, string> = {
  brand: 'text-chart-1',
  muted: 'text-faint',
  up: 'text-up-graphic',
  down: 'text-down-graphic',
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Line/area trend chart. First solid series is the hero (area + 2.5px line); dashed series
 * are lower-emphasis context (forecast), which survives greyscale. Hover or ←/→ moves a
 * crosshair with a tooltip; the default marker sits on the latest point.
 */
export function LineChart({ series, labels, tooltipLabels, tooltipNote, format = (v) => String(Math.round(v)), axisFormat, label, height = 240 }: {
  series: Series[];
  labels: string[];
  /** Full per-point label for the tooltip (e.g. date + time) when axis labels are abbreviated. */
  tooltipLabels?: string[];
  /** Extra tooltip line for a point, e.g. "+2.4% vs previous" (CATALOG-DETAIL-002). */
  tooltipNote?: (index: number) => ReactNode;
  format?: (v: number) => string;
  /** Compact tick formatter; defaults to `format`. */
  axisFormat?: (v: number) => string;
  label: string;
  height?: number;
}) {
  const gid = useId().replace(/:/g, '');
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points).filter(Number.isFinite);
  const n = labels.length;
  if (all.length === 0 || n === 0) return null;

  const ticks = niceTicks(Math.min(...all), Math.max(...all), 5);
  const lo = ticks[0]!, hi = ticks[ticks.length - 1]!;
  const tickFmt = axisFormat ?? format;
  const padL = Math.max(...ticks.map((v) => tickFmt(v).length)) * 7 + 14;
  const P = { l: padL, r: 12, t: 10, b: 30 };
  const W = Math.max(width, 240);
  const plotW = W - P.l - P.r, plotH = height - P.t - P.b;
  const x = (i: number) => P.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => P.t + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const pts = (s: Series): Pt[] => s.points.map((v, i) => ({ x: x(i), y: y(v) }));
  const heroIdx = series.findIndex((s) => !s.dash);
  const idx = active ?? n - 1;

  // X labels: long ids are clipped, and spacing is derived from the widest label (12px ≈ 6.6px/char),
  // so ticks never collide whatever the label vocabulary.
  const MAX_CHARS = 12;
  const clip = (l: string) => (l.length > MAX_CHARS ? `${l.slice(0, MAX_CHARS - 1)}…` : l);
  const labelW = Math.max(...labels.map((l) => clip(l).length)) * 6.6 + 18;
  const fit = Math.max(2, Math.floor(plotW / labelW));
  const every = Math.max(1, Math.ceil((n - 1) / (fit - 1)));
  // Each label is centred on its point, clamped inside the plot; a greedy pass then drops any
  // label whose box would touch its neighbour (the latest point always keeps its label).
  const placed = labels.map((l, i) => ({ l: clip(l), i })).filter(({ i }) => i % every === 0 || i === n - 1)
    .map((o) => {
      const half = (o.l.length * 6.6) / 2;
      const cx = Math.min(Math.max(x(o.i), P.l + half - 4), W - P.r - half + 4);
      return { ...o, cx, left: cx - half, right: cx + half };
    });
  const xLabels: typeof placed = [];
  for (const o of placed) {
    const prev = xLabels[xLabels.length - 1];
    if (!prev || o.left >= prev.right + 10) xLabels.push(o);
    else if (o.i === n - 1) { xLabels.pop(); xLabels.push(o); }
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setActive(Math.max(0, Math.min(n - 1, Math.round(((px - P.l) / (plotW || 1)) * (n - 1)))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(Math.max(0, idx - 1)); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setActive(Math.min(n - 1, idx + 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1); }
  };
  const tipLeft = Math.min(Math.max(x(idx), P.l + 70), W - P.r - 70);
  // Keep the tooltip off the hovered point: below it when the point sits high, above it otherwise.
  const heroPoint = series[heroIdx]?.points[idx];
  const pointY = Number.isFinite(heroPoint) ? y(heroPoint!) : P.t;
  const tipBelow = pointY < P.t + plotH / 2;
  const heroTone = series[heroIdx]?.tone ?? 'brand';

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      {width > 0 && (
        <svg
          width={W}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="block touch-none select-none focus-visible:outline-offset-4"
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1" className={TONE_TEXT[heroTone]}>
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth="1.2" />
              <text x={P.l - 10} y={y(v)} dy="0.32em" textAnchor="end" className="tabular fill-faint text-xs font-medium">{tickFmt(v)}</text>
            </g>
          ))}
          {xLabels.map(({ l, i, cx }) => {
            return (
            <text
              key={i} x={cx} y={height - 8}
              textAnchor="middle"
              className="fill-faint text-xs font-medium"
            >
              {l}
            </text>
            );
          })}
          {series.map((s, si) => {
            const p = pts(s);
            const tone = s.tone ? TONE_TEXT[s.tone] : undefined;
            const showArea = s.area ?? si === heroIdx;
            return (
              <g key={s.name} className={tone}>
                {showArea && !s.dash && <path d={areaPath(p, P.t + plotH)} fill={`url(#${gid})`} className={tone} />}
                <path
                  d={smoothPath(p)}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={s.dash ? 1.8 : 2.5}
                  strokeDasharray={s.dash ? '5 5' : undefined}
                  stroke={s.tone ? (s.dash ? 'var(--border-strong)' : 'currentColor') : undefined}
                  className={s.tone ? undefined : s.cls}
                />
              </g>
            );
          })}
          <g className={TONE_TEXT[heroTone]}>
            <line x1={x(idx)} x2={x(idx)} y1={P.t} y2={P.t + plotH} stroke="currentColor" strokeWidth="1.5" strokeOpacity={active === null ? 0.35 : 0.8} />
            {series.map((s) => Number.isFinite(s.points[idx]) && (
              <circle key={s.name} cx={x(idx)} cy={y(s.points[idx]!)} r="4.5" fill="var(--bg-surface)" stroke={s.dash ? 'var(--text-faint)' : 'currentColor'} strokeWidth="2" />
            ))}
          </g>
        </svg>
      )}
      {width === 0 && <div style={{ height }} aria-hidden />}
      {active !== null && (
        <div
          role="status"
          className="glass pointer-events-none absolute z-10 min-w-32 rounded-row border border-line px-2.5 py-2 text-xs shadow-e3"
          style={{ left: tipLeft, top: tipBelow ? pointY + 14 : pointY - 14, transform: `translate(-50%, ${tipBelow ? '0' : '-100%'})` }}
        >
          <p className="tabular mb-1 font-medium text-faint">{tooltipLabels?.[idx] ?? labels[idx]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-3">
              <span className="text-muted">{s.name}</span>
              <span className="tabular font-semibold text-fg">{Number.isFinite(s.points[idx]) ? format(s.points[idx]!) : '—'}</span>
            </p>
          ))}
          {tooltipNote && <p className="tabular mt-1 text-muted">{tooltipNote(idx)}</p>}
        </div>
      )}
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-muted">
          {series.map((s) => (
            <li key={s.name} className={cn('flex items-center gap-1.5', s.tone && TONE_TEXT[s.tone])}>
              <svg width="18" height="6" aria-hidden className={s.tone ? undefined : s.cls}>
                <line x1="1" y1="3" x2="17" y2="3" strokeWidth="2" strokeLinecap="round" stroke={s.dash ? 'var(--text-faint)' : s.tone ? 'currentColor' : undefined} strokeDasharray={s.dash ? '3 3' : undefined} />
              </svg>
              <span className="text-muted">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Horizontal bars; values may be negative (bars grow from the centre line). */
export function BarChart({ items, format, label }: { items: { label: string; value: number }[]; format: (v: number) => string; label: string }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  const hasNeg = items.some((i) => i.value < 0);
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {items.map((i) => {
        const w = (Math.abs(i.value) / maxAbs) * (hasNeg ? 50 : 100);
        return (
          <li key={i.label} className="grid grid-cols-[minmax(6rem,8rem)_1fr_4rem] items-center gap-3 text-xs">
            <span className="truncate font-medium text-muted">{i.label}</span>
            <div className="relative h-2 rounded-full bg-subtle">
              {hasNeg && <span aria-hidden className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />}
              <div
                className={cn('absolute top-0 h-full rounded-full', i.value < 0 ? 'bg-down-graphic' : 'bg-chart-1')}
                style={{ width: `${w}%`, ...(hasNeg ? (i.value < 0 ? { right: '50%' } : { left: '50%' }) : { left: 0 }) }}
              />
            </div>
            <span className="tabular text-right font-medium text-fg">{format(i.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Chart / Data table switch. Panels use the icon-only form so the header stays on one line. */
function ViewToggle({ view, setView, label, iconOnly }: { view: 'chart' | 'table'; setView: (v: 'chart' | 'table') => void; label: string; iconOnly?: boolean }) {
  const { t } = useTranslation();
  return (
    <Segmented
      label={label}
      value={view}
      onChange={setView}
      iconOnly={iconOnly}
      compactOnMobile
      options={[
        { value: 'chart', label: t('overview.charts.chart'), icon: LineChartIcon },
        { value: 'table', label: t('overview.charts.table'), icon: Table2 },
      ]}
    />
  );
}

/**
 * Data-table twin of a chart (MON-001…007/017/018). One table in one scroll container: the sticky
 * header and every row share a fixed column model (label track fluid, each figure track 200px,
 * right-aligned tabular numerals), and the scrollbar gutter is reserved so the Forecast/Actual
 * columns never shift when the body starts to scroll. Same grammar as `.mesta-table`.
 */
function ChartTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-scroll max-h-80 rounded-card border border-line">
      <table className="mesta-table" style={{ tableLayout: 'fixed', minWidth: 160 + (columns.length - 1) * 140 }}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col />
          {columns.slice(1).map((c) => <col key={c} style={{ width: 200 }} />)}
        </colgroup>
        <thead className="sticky top-0 z-[1]">
          <tr>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={i ? 'text-right' : 'text-left'}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (ci === 0
                ? <th key={ci} scope="row" className="truncate text-left">{c}</th>
                : <td key={ci} className="num">{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Chart card. Every chart ships with the same data as an accessible table.
 *
 * variant="hero" — the reference "Total Portfolio Value" card: 16px radius, 36px padding on
 *   desktop, 26px icon box + muted title, 30–36px bold headline figure, controls top-right.
 * variant="panel" (default) — the same header grammar at standard card density, for the
 *   smaller analysis cards that sit beside or below a hero.
 */
export function ChartWithTable({ title, caption, chart, columns, rows, controls, headline, meta, icon, variant = 'panel', className }: {
  title: string; caption: string; chart: ReactNode; columns: string[]; rows: ReactNode[][];
  /** Extra header controls rendered left of the chart/table toggle (e.g. a period selector). */
  controls?: ReactNode;
  /** Headline figure (hero) or summary line (panel) rendered under the title. */
  headline?: ReactNode;
  /** Visible unit/date-range metadata line. */
  meta?: ReactNode;
  icon?: LucideIcon;
  variant?: 'hero' | 'panel';
  className?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const hero = variant === 'hero';
  return (
    <section
      className={cn(
        'min-w-0 border border-line bg-surface',
        hero ? 'rounded-panel p-4 sm:p-5 md:p-9' : 'rounded-card p-4 sm:p-5',
        className,
      )}
    >
      <div className={cn('flex items-start justify-between gap-3', hero ? 'mb-5 flex-wrap sm:mb-7' : 'mb-4')}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <IconBox icon={icon ?? (hero ? LineChartIcon : BarChart3)} />
            <h2 className={cn('font-medium tracking-label', hero ? 'text-sm text-faint sm:text-base' : 'text-sm text-fg')}>{title}</h2>
          </div>
          {headline}
          {meta && <p className="text-xs font-medium tracking-label text-faint">{meta}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {controls}
          <ViewToggle view={view} setView={setView} label={title} iconOnly={!hero} />
        </div>
      </div>
      {view === 'chart' ? chart : <ChartTable caption={caption} columns={columns} rows={rows} />}
    </section>
  );
}

/** Hero headline figure: large bold numeral with an optional delta line beside it. */
export function ChartHeadline({ value, children }: { value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="tabular text-3xl font-bold leading-none tracking-[-0.03em] text-fg sm:text-4xl">{value}</p>
      {children}
    </div>
  );
}
