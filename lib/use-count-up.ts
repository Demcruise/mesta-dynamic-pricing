'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 360;

/**
 * Animates toward `value` when it changes (≤400ms ease-out), so a deploy that
 * lands a new price reads as a transition rather than an instant swap.
 * First mount snaps directly; reduced-motion users always get the final value.
 */
export function useCountUp(value: number, enabled = true): number {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (!enabled || from === value) { setShown(value); return; }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / DURATION_MS);
      setShown(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, enabled]);

  return shown;
}
