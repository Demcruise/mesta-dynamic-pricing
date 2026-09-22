'use client';

import { BookOpen, CircleHelp, Undo2 } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
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
  return (
    <details className={cn('group relative inline-flex', className)}>
      <summary
        aria-label={label}
        title={label}
        className="grid size-4 cursor-pointer list-none place-items-center rounded-full text-faint transition-colors duration-fast hover:text-fg [&::-webkit-details-marker]:hidden"
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </summary>
      <div className="glass absolute right-0 top-5 z-40 w-60 rounded-card border border-line p-3 text-left shadow-e3">
        <p className="text-xs text-fg">{definition}</p>
        {rows.length > 0 && (
          <dl className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-2">
                <dt className="text-muted">{r.label}</dt>
                <dd className="tabular text-fg">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </details>
  );
}
