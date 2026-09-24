import { useId } from 'react';
import { areaPath, smoothPath } from '@/lib/chart-path';
import { cn } from '@/lib/utils';

export type SparkTone = 'up' | 'down' | 'brand' | 'muted';

const STROKE: Record<SparkTone, string> = {
  up: 'text-up-graphic',
  down: 'text-down-graphic',
  brand: 'text-chart-1',
  muted: 'text-faint',
};

/**
 * Tiny trend line. With a `tone` it renders the reference treatment — smooth line plus a
 * soft gradient area — and colours by sentiment; without one it inherits currentColor
 * (legacy call sites pass a text-* class).
 */
export function Sparkline({ points, tone, area = tone !== undefined, className = 'h-12 w-full max-w-60 text-brand' }: {
  points: number[];
  tone?: SparkTone;
  /** Gradient fill under the line. Defaults on when a tone is set. */
  area?: boolean;
  className?: string;
}) {
  const gid = useId().replace(/:/g, '');
  const w = 240, h = 48, pad = 3;
  if (points.length === 0) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const pts = points.map((p, i) => ({
    x: (i / Math.max(points.length - 1, 1)) * w,
    y: h - pad - ((p - min) / span) * (h - pad * 2),
  }));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn(className, tone && STROKE[tone])} aria-hidden>
      {area && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath(pts, h)} fill={`url(#${gid})`} />
        </>
      )}
      <path d={smoothPath(pts)} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
