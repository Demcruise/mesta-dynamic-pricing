'use client';

import type { ReactNode } from 'react';
import { AgentBorderCard } from '@/components/ds/AgentBorderCard';
import { ConfidenceBar } from '@/components/ds/ConfidenceBar';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { StatusChip } from '@/components/ds/StatusChip';
import { EmptyState, KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { Button } from '@/components/ui/button';

/**
 * Living design-system reference (English-only developer documentation, hence excluded from the
 * i18n copy lint). Each entry lists props, states, accessibility behaviour and do/don't.
 */
interface Entry {
  name: string;
  file: string;
  summary: string;
  props: string;
  a11y: string;
  doText: string;
  dontText: string;
  reactBits: string;
  demo: ReactNode;
}

const ENTRIES: Entry[] = [
  {
    name: 'PriceValue', file: 'components/ds/PriceValue.tsx', summary: 'IDR amount in mono tabular numerals, locale-aware.',
    props: 'value: number · muted?: boolean · loading?: boolean · className?',
    a11y: 'Plain text, so screen readers read the formatted currency.',
    doText: 'Use for every money value so digits align in tables.', dontText: 'Do not format prices with toLocaleString in feature code.',
    reactBits: 'Application UI › Data display › Stat',
    demo: <div className="flex gap-4"><PriceValue value={125000} /><PriceValue value={98000} muted /><PriceValue value={0} loading /></div>,
  },
  {
    name: 'DeltaBadge', file: 'components/ds/DeltaBadge.tsx', summary: 'Direction and size of a change, ratio input (0.05 = +5%).',
    props: 'value: number (ratio) · className?',
    a11y: 'Icon + text; aria-label announces "Increase 5%". Never colour-only.',
    doText: 'Use for price deltas, competitor gaps, demand change.', dontText: 'Do not use for status; use StatusChip.',
    reactBits: 'Application UI › Data display › Badge',
    demo: <div className="flex gap-2"><DeltaBadge value={0.052} /><DeltaBadge value={-0.031} /><DeltaBadge value={0} /></div>,
  },
  {
    name: 'ConfidenceBar', file: 'components/ds/ConfidenceBar.tsx', summary: '0–100 model confidence with High/Medium/Low tier.',
    props: 'value: number (0–100) · className?',
    a11y: 'role="meter" with aria-valuenow and aria-valuetext including the tier name.',
    doText: 'Show next to any AI-generated recommendation.', dontText: 'Do not use for progress; a meter is not a progress bar.',
    reactBits: 'Application UI › Data display › Progress',
    demo: <div className="flex flex-col gap-2"><ConfidenceBar value={92} /><ConfidenceBar value={68} /><ConfidenceBar value={41} /></div>,
  },
  {
    name: 'AgentBorderCard', file: 'components/ds/AgentBorderCard.tsx', summary: 'Card whose left border marks who produced the content.',
    props: 'actor: "agent" | "human" | "rule" · className?',
    a11y: 'Visually hidden label announces the actor; colour is supplementary.',
    doText: 'Wrap recommendation-like content authored by an agent, human or rule.', dontText: 'Do not use as a generic card.',
    reactBits: 'Application UI › Cards',
    demo: <div className="grid gap-2 sm:grid-cols-3">{(['agent', 'human', 'rule'] as const).map((a) => <AgentBorderCard key={a} actor={a}><p className="text-sm">{a}</p></AgentBorderCard>)}</div>,
  },
  {
    name: 'StatusChip', file: 'components/ds/StatusChip.tsx', summary: 'Lifecycle state of a recommendation.',
    props: 'status: "pending" | "approved" | "rejected" | "adjusted" | "stale" · className?',
    a11y: 'Icon + translated label.',
    doText: 'Use for workflow state.', dontText: 'Do not use for severity; deployment and anomaly chips have their own palette.',
    reactBits: 'Application UI › Data display › Badge',
    demo: <div className="flex flex-wrap gap-2">{(['pending', 'approved', 'rejected', 'adjusted', 'stale'] as const).map((s) => <StatusChip key={s} status={s} />)}</div>,
  },
  {
    name: 'KpiCard / PageHeader / EmptyState / LoadingRows', file: 'components/ds/states.tsx', summary: 'Page scaffolding and state placeholders.',
    props: 'KpiCard{label,value,hint?} · PageHeader{title,subtitle?,actions?} · EmptyState{title,action?} · LoadingRows{rows?,rowHeight?}',
    a11y: 'LoadingRows is role="status" aria-live="polite"; ErrorState is role="alert".',
    doText: 'Every data view handles loading, empty, error.', dontText: 'Do not invent one-off skeletons.',
    reactBits: 'Application UI › Layout, Empty states',
    demo: <div className="grid gap-3 sm:grid-cols-2"><KpiCard label="Pending" value={12} hint="since Monday" /><EmptyState title="Nothing here yet" /><div className="sm:col-span-2"><LoadingRows rows={2} rowHeight={28} /></div></div>,
  },
  {
    name: 'Button', file: 'components/ui/button.tsx', summary: 'Primary action primitive (shadcn-style).',
    props: 'variant: primary | secondary | ghost | destructive · size: sm | md | icon',
    a11y: 'Native button; visible focus ring from global focus-visible rule; icon buttons need aria-label.',
    doText: 'One primary action per surface.', dontText: 'Do not use a link styled as a button for actions that mutate state.',
    reactBits: 'Application UI › Buttons',
    demo: <div className="flex flex-wrap gap-2"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Destructive</Button><Button disabled>Disabled</Button></div>,
  },
];

const GUIDE = [
  ['StatusChip', 'A workflow state changed or needs attention on an entity.'],
  ['DeltaBadge', 'You show how much a number moved. Always with direction text.'],
  ['AgentBorderCard', 'You must show who authored the content (agent, human, rule).'],
  ['Alert (role="alert")', 'A blocking or urgent message in context, e.g. validation summary or guardrail breach.'],
  ['Toast', 'Non-blocking confirmation that an action happened; use the undo toast for reversible decisions.'],
  ['Dialog', 'A decision that needs input or confirmation (reject note, bulk approve, override). Native dialog: focus is trapped for you.'],
];

export function DesignSystemPage() {
  return (
    <>
      <PageHeader title="Design system" subtitle="Mesta components, states, accessibility notes and usage guidance" />
      <div className="flex flex-col gap-6">
        {ENTRIES.map((e) => (
          <section key={e.name} aria-labelledby={`ds-${e.name}`} className="rounded-card border border-line bg-surface p-card shadow-e1">
            <h2 id={`ds-${e.name}`} className="text-base font-semibold">{e.name}</h2>
            <p className="text-sm text-muted">{e.summary} <code className="text-xs">{e.file}</code></p>
            <div className="my-3 rounded-input border border-line bg-bg p-4">{e.demo}</div>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted">Props</dt><dd><code className="text-xs">{e.props}</code></dd>
              <dt className="text-muted">Accessibility</dt><dd>{e.a11y}</dd>
              <dt className="text-muted">Do</dt><dd>{e.doText}</dd>
              <dt className="text-muted">Don&apos;t</dt><dd>{e.dontText}</dd>
              <dt className="text-muted">React Bits Pro</dt><dd>{e.reactBits}</dd>
            </dl>
          </section>
        ))}
        <section className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 className="mb-2 text-base font-semibold">Which component do I use?</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Component decision guide</caption>
            <thead className="text-left text-xs text-muted"><tr><th scope="col" className="py-1 font-medium">Component</th><th scope="col" className="py-1 font-medium">Use when</th></tr></thead>
            <tbody>{GUIDE.map(([n, d]) => <tr key={n} className="border-t border-line"><th scope="row" className="py-1 pr-3 text-left font-medium">{n}</th><td className="py-1">{d}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </>
  );
}
