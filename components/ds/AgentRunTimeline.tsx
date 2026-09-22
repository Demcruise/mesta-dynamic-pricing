'use client';

import { Check, CircleDashed } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface RunStep {
  id: string;
  label: string;
  detail?: string;
  /** ISO timestamp; rendered in the compact column when present. */
  at?: string;
  ok?: boolean;
}

/** Ordered trace of how a recommendation was produced — Palantir-style "agent run" view. */
export function AgentRunTimeline({ steps }: { steps: RunStep[] }) {
  const { t, locale } = useTranslation();
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));

  const rows: ReactNode[] = [];
  steps.forEach((s, i) => {
    const last = i === steps.length - 1;
    rows.push(
      <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
        {!last && <span aria-hidden className="absolute left-[9px] top-5 h-full w-px bg-line" />}
        <span
          aria-hidden
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
            s.ok === false ? 'border-warn bg-warn-soft text-warn' : 'border-agent/40 bg-agent/10 text-agent',
          )}
        >
          {s.ok === false ? <CircleDashed className="size-3" /> : <Check className="size-3" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-5">
            {s.label}
            {s.at && <span className="tabular ml-2 text-[11px] font-normal text-faint">{fmt(s.at)}</span>}
          </p>
          {s.detail && <p className="text-xs text-muted">{s.detail}</p>}
        </div>
      </li>,
    );
  });

  return (
    <ol aria-label={t('recommendations.run.title')} className="text-sm">
      {rows}
    </ol>
  );
}
