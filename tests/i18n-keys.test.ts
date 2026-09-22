import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messages } from '@/lib/i18n';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const has = (locale: 'id' | 'en', key: string) => {
  let node: unknown = messages[locale];
  for (const part of key.split('.')) node = typeof node === 'object' && node ? (node as Record<string, unknown>)[part] : undefined;
  return typeof node === 'string';
};

describe('i18n key hygiene', () => {
  const files = ['app', 'components', 'features', 'lib'].flatMap((d) => walk(d));
  // Static keys only: t('ns.path'). Dynamic template keys are covered by runtime warnings.
  const RE = /\bt\(\s*(['"])([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)\1/g;

  it('every static t() key exists in both locales', () => {
    const missing: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(RE)) {
        const key = m[2] as string;
        for (const l of ['id', 'en'] as const) if (!has(l, key)) missing.push(`${f}: ${l}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('notification message keys exist', () => {
    const keys: string[] = [];
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/messageKey:\s*'([^']+)'/g)) keys.push(m[1] as string);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) for (const l of ['id', 'en'] as const) expect(has(l, k), `${l}:${k}`).toBe(true);
  });

  it('no raw English button/heading copy in JSX outside i18n (heuristic)', () => {
    const ALLOW = new Set(['Ctrl K']); // keyboard hint, not copy
    const offenders: string[] = [];
    for (const f of files.filter((x) => /\.tsx$/.test(x) && !/design-system/.test(x))) {
      const src = readFileSync(f, 'utf8');
      // >Some Capitalised Words< between tags, at least two words, not inside braces
      for (const m of src.matchAll(/>\s*([A-Z][a-z]+(?: [A-Za-z]+)+)\s*</g)) if (!ALLOW.has(m[1] as string)) offenders.push(`${f}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});
