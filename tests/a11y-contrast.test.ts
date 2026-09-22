import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('styles/tokens.css', 'utf8');

function block(selector: RegExp) {
  const m = css.match(selector);
  const vars: Record<string, string> = {};
  for (const [, k, v] of (m?.[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[k as string] = v as string;
  return vars;
}
const light = block(/:root\s*{([\s\S]*?)\n}/);
const dark = { ...light, ...block(/:root\[data-theme='dark'\]\s*{([\s\S]*?)\n}/) };

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

/** [foreground token, background token, min ratio]. 4.5 for text, 3 for UI-only accents. */
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5], ['text', 'bg-surface', 4.5], ['text-muted', 'bg-surface', 4.5], ['text-muted', 'bg', 4.5], ['text-muted', 'bg-subtle', 4.5],
  ['text-faint', 'bg-surface', 4.5],
  ['brand', 'bg-surface', 4.5], ['brand', 'brand-soft', 4.5], ['brand-fg', 'brand', 4.5],
  ['up', 'up-soft', 4.5], ['down', 'down-soft', 4.5], ['hold', 'hold-soft', 4.5], ['info', 'info-soft', 4.5], ['warn', 'warn-soft', 4.5],
  ['critical', 'critical-soft', 4.5], ['up', 'bg-surface', 4.5], ['down', 'bg-surface', 4.5], ['warn', 'bg-surface', 4.5],
  ['brand', 'bg-selected', 4.5],
];

describe.each([['light', light], ['dark', dark]] as const)('WCAG AA contrast (%s theme)', (_name, tokens) => {
  it.each(PAIRS)('%s on %s ≥ %s', (fg, bg, min) => {
    const f = tokens[fg], b = tokens[bg];
    expect(f && b, `token missing: ${fg}/${bg}`).toBeTruthy();
    expect(ratio(f as string, b as string)).toBeGreaterThanOrEqual(min);
  });
});
