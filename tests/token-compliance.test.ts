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
