'use client';

import { BookOpen, CircleHelp, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Trust-critical content patterns (enterprise backlog TR-001/TR-005, §1A.5):
 * consequence visible adjacent to the CTA, recovery named, docs one click away.
 */

/** CTA with its consequence stated immediately next to it — never a bare "Submit". */
export function ActionSummary({ action, consequence }: {
  /** The button(s). */
  action: ReactNode;
  /** Scope + impact, e.g. "12 SKUs · +2.1% margin · 2 excluded". */
  consequence: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <p className="mr-auto text-xs text-muted sm:mr-0">{consequence}</p>
      {action}
    </div>
  );
}

export interface ConsequenceItem {
  label: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'up' | 'down' | 'warn';
}

const TONE = { default: 'text-fg', up: 'text-up', down: 'text-down', warn: 'text-warn' } as const;

/** "What changes" preview — a compact before/after list shown before a risky action. */
export function ConsequencePreview({ items, className }: { items: ConsequenceItem[]; className?: string }) {
  return (
    <dl className={cn('grid gap-x-4 gap-y-1 rounded-input bg-subtle p-3 text-sm sm:grid-cols-2', className)}>
      {items.map((i, k) => (
        <div key={k} className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">{i.label}</dt>
          <dd className={cn('tabular font-medium', TONE[i.tone ?? 'default'])}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** How to get back — shown where an action can fail or be reversed. */
export function RecoveryNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-start gap-1.5 rounded-input bg-info-soft px-3 py-2 text-xs text-info', className)}>
      <Undo2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Contextual documentation link — a specific reference, not a generic help centre. */
export function DocsLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-1 text-xs text-brand hover:underline', className)}>
      <BookOpen className="size-3" aria-hidden />
      {children}
    </Link>
  );
}

export interface MetricDefinitionRow { label: string; value: ReactNode }

/**
 * KPI trust popover (§14 data trust): definition, scope, period, currency,
 * freshness, coverage — one click from the number it describes.
 */
export function MetricDefinition({ label, definition, rows = [], className }: {
  /** Accessible name for the ⓘ trigger, e.g. "About pending approvals". */
  label: string;
  definition: string;
  rows?: MetricDefinitionRow[];
  className?: string;
}) {
  /*
   * SIG-009…014: rendered in a portal with fixed positioning, so table overflow and `nowrap`
   * headers can never clip or stretch it. Width min(320px, viewport − 32px), text wraps inside the
   * frame, flips above the trigger when there is no room below, clamps inside the viewport.
   * Hover/focus previews it; click pins it; Escape or an outside click closes; opening one closes
   * any other (no stacked popovers).
   */
  const [open, setOpen] = useState<false | 'peek' | 'pinned'>(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(320, window.innerWidth - 32);
      const h = pop.current?.offsetHeight ?? 120;
      const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), window.innerWidth - width - 16);
      const below = r.bottom + 8 + h <= window.innerHeight - 8;
      setPos({ top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - h), left, width });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent('mesta:popover', { detail: id }));
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== id) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    const onDown = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (!trigger.current?.contains(tgt) && !pop.current?.contains(tgt)) setOpen(false);
    };
    window.addEventListener('mesta:popover', onOther);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('mesta:popover', onOther); document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open, id]);

  return (
    <span className={cn('ml-1 inline-flex shrink-0 align-middle', className)}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={!!open}
        aria-controls={open ? id : undefined}
        title={open ? undefined : label}
        onClick={() => setOpen((o) => (o === 'pinned' ? false : 'pinned'))}
        onMouseEnter={() => setOpen((o) => o || 'peek')}
        onMouseLeave={() => setOpen((o) => (o === 'peek' ? false : o))}
        onFocus={() => setOpen((o) => o || 'peek')}
        onBlur={(e) => { if (!pop.current?.contains(e.relatedTarget as Node)) setOpen((o) => (o === 'peek' ? false : o)); }}
        className="grid size-6 cursor-pointer place-items-center rounded-full text-faint transition-colors duration-fast hover:text-fg aria-expanded:text-brand"
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={pop}
          id={id}
          role="tooltip"
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? 320 }}
          className="z-[60] whitespace-normal rounded-card border border-line bg-surface px-3.5 py-3 text-left font-normal normal-case tracking-normal shadow-e3 [overflow-wrap:break-word]"
        >
          <p className="text-caption leading-[1.45] text-fg">{definition}</p>
          {rows.length > 0 && (
            <dl className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-caption">
              {rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-3">
                  <dt className="text-muted">{r.label}</dt>
                  <dd className="tabular text-right text-fg">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}
