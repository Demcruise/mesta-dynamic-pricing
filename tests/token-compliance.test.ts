import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SCANNED_DIRS = ['features', 'app', 'components'];

// Vendored React Bits Pro registry files are adapted/wrapped per-epic — exempt them.
const isRawBlock = (f: string) => /components[/\\]blocks[/\\][a-z0-9-]+-\d+\.tsx$/.test(f);

// First-party code must use token utilities (shadow-e*, duration-fast|base|slow,
// ease-standard|decelerate|accelerate, py-row, p-card), not raw Tailwind values.
const FORBIDDEN: { re: RegExp; hint: string }[] = [
  { re: /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/g, hint: 'use shadow-e1..e4 (or shadow-none)' },
  { re: /\bshadow-\[/g, hint: 'no arbitrary shadow values — use shadow-e1..e4' },
  { re: /\bduration-\d/g, hint: 'use duration-fast/base/slow' },
  { re: /\bduration-\[/g, hint: 'no arbitrary durations — use duration-fast/base/slow' },
  { re: /\bease-(?:in|out|in-out|linear)\b/g, hint: 'use ease-standard/decelerate/accelerate' },
  { re: /\bease-\[/g, hint: 'no arbitrary easings — use ease-standard/decelerate/accelerate' },
  { re: /\btransition-all\b/g, hint: 'transition only the properties that change' },
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|css)$/.test(entry)) yield p;
  }
}

describe('Token compliance (backlog v4 B): no raw elevation/motion utilities', () => {
  it('features/, app/, components/ (excl. blocks) use token utilities only', () => {
    const violations: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        if (isRawBlock(file)) continue;
        const src = readFileSync(file, 'utf8');
        for (const { re, hint } of FORBIDDEN) {
          for (const m of src.matchAll(re)) violations.push(`${file}: "${m[0]}" — ${hint}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// Animating layout/paint properties runs off the compositor thread (Lighthouse
// "Avoid non-composited animations"): jank on low-end devices, main-thread work,
// and CLS from elements actually moving. Animate transform/opacity instead.
// Progress/meter fills use transform: scaleX() with origin-left.
const NON_COMPOSITED = /\btransition-\[(?:width|height|grid-template-rows|top|right|bottom|left|margin[\w-]*|padding[\w-]*|stroke-dashoffset)\]/g;

// Inherent layout/paint animations kept deliberately — each is a documented,
// interaction-triggered change with no compositor-only equivalent.
const COMPOSITED_EXCEPTIONS = new Set([
  // Collapsing the rail IS the content-column reflow; width is the layout change.
  'components/shell/Sidebar.tsx::transition-[width]',
  // Auto-height disclosure: no compositor-only equivalent for animating to auto.
  'components/ds/RationaleBreakdown.tsx::transition-[grid-template-rows]',
  // 24px SVG countdown ring — paint-only, only runs while an undo toast is up.
  'components/shell/ToastHost.tsx::transition-[stroke-dashoffset]',
]);

describe('Animation compliance: no non-composited transitions', () => {
  it('only compositor-only properties are animated (exceptions documented above)', () => {
    const violations: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        if (isRawBlock(file)) continue;
        const rel = file.slice(ROOT.length + 1).replaceAll('\\', '/');
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(NON_COMPOSITED)) {
          if (COMPOSITED_EXCEPTIONS.has(`${rel}::${m[0]}`)) continue;
          violations.push(`${rel}: "${m[0]}" — animate transform/opacity instead`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
