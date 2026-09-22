import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SCANNED_DIRS = ['features', 'app'];
// Raw React Bits Pro registry files are named <slug>-<number>.tsx.
const RAW_BLOCK_IMPORT = /@\/components\/blocks\/[a-z0-9-]+-\d+(['"]|$)/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx)$/.test(entry)) yield path;
  }
}

describe('React Bits Pro block boundary (backlog v4 A.3)', () => {
  it('features/ and app/ never import raw registry blocks directly', () => {
    const violations: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const src = readFileSync(file, 'utf8');
        for (const match of src.matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
          const spec = match[1] ?? match[2] ?? '';
          if (RAW_BLOCK_IMPORT.test(spec)) violations.push(`${file}: ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
