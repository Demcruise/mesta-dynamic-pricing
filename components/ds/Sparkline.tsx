export function Sparkline({ points, className = 'h-12 w-full max-w-60 text-brand' }: { points: number[]; className?: string }) {
  const w = 240, h = 48;
  if (points.length === 0) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / Math.max(points.length - 1, 1)) * w},${h - ((p - min) / span) * (h - 6) - 3}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
