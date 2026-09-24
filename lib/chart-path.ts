export interface Pt { x: number; y: number }

/**
 * Monotone cubic (Fritsch–Carlson) path through the points: smooth like the reference
 * charts, but never overshoots — a series that only rises is never drawn dipping.
 */
export function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]!.x},${pts[0]!.y}`;
  const n = pts.length;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    dx.push(b.x - a.x);
    m.push((b.y - a.y) / (b.x - a.x || 1));
  }
  const tan: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) {
    tan.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2);
  }
  tan.push(m[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue; }
    const a = tan[i]! / m[i]!, b = tan[i + 1]! / m[i]!;
    const h = a * a + b * b;
    if (h > 9) { const s = 3 / Math.sqrt(h); tan[i] = s * a * m[i]!; tan[i + 1] = s * b * m[i]!; }
  }
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!, h = dx[i]! / 3;
    d += ` C${a.x + h},${a.y + tan[i]! * h} ${b.x - h},${b.y - tan[i + 1]! * h} ${b.x},${b.y}`;
  }
  return d;
}

/** Closes a line path down to a baseline so it can be filled as an area. */
export function areaPath(pts: Pt[], baseline: number): string {
  if (pts.length === 0) return '';
  return `${smoothPath(pts)} L${pts[pts.length - 1]!.x},${baseline} L${pts[0]!.x},${baseline} Z`;
}

/** "Nice" axis ticks (1/2/2.5/5 × 10ⁿ) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) { const pad = Math.abs(min) * 0.05 || 1; min -= pad; max += pad; }
  const raw = (max - min) / Math.max(count - 1, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}
