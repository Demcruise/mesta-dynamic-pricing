'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Filter state that lives in the URL (?status=breached&type=map). Survives reload, back/forward,
 * drawer open/close and round-trips to other pages, and makes filtered views shareable
 * (GUARDRAIL-029, ALERT-019, AUD-011). Values equal to their default are dropped from the URL.
 * Callers must render under a <Suspense> boundary (useSearchParams).
 */
export function useQueryState<T extends Record<string, string>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const query = sp.toString();

  const state = useMemo(() => {
    const params = new URLSearchParams(query);
    const out = { ...defaults };
    for (const k of Object.keys(defaults) as (keyof T & string)[]) {
      const v = params.get(k);
      if (v !== null) out[k] = v as T[typeof k];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const set = useCallback((patch: Partial<T>) => {
    const params = new URLSearchParams(query);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === defaults[k]) params.delete(k);
      else params.set(k, v as string);
    }
    const s = params.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pathname, router]);

  const reset = useCallback((keys?: (keyof T & string)[]) => {
    const params = new URLSearchParams(query);
    for (const k of keys ?? Object.keys(defaults)) params.delete(k);
    const s = params.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pathname, router]);

  return [state, set, reset] as const;
}
