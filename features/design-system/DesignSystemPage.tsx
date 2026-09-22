'use client';

import { useState, type ReactNode } from 'react';
import { AgentBorderCard } from '@/components/ds/AgentBorderCard';
import { AgentRunTimeline } from '@/components/ds/AgentRunTimeline';
import { ConfidenceBar } from '@/components/ds/ConfidenceBar';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { Drawer } from '@/components/ds/Drawer';
import { LiveDot } from '@/components/ds/LiveDot';
import { OnboardingChecklist } from '@/components/ds/OnboardingChecklist';
import { PriceValue } from '@/components/ds/PriceValue';
import { RationaleBreakdown } from '@/components/ds/RationaleBreakdown';
import { RuleEvaluation } from '@/components/ds/RuleEvaluation';
import { SeverityChip } from '@/components/ds/SeverityChip';
import { Sparkline } from '@/components/ds/Sparkline';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { StatusChip } from '@/components/ds/StatusChip';
import { ExecutionTimeline, FreshnessBadge, JobProgress, SyncStatus } from '@/components/ds/system-status';
import { ActionSummary, ConsequencePreview, DocsLink, MetricDefinition, RecoveryNotice } from '@/components/ds/trust';
import { EmptyState, KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
import { MestaDataTable, useColumnVisibility } from '@/components/ds/table/DataTable';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';

/**
 * Living design-system reference (English-only developer documentation, hence excluded from the
 * i18n copy lint). Each entry lists props, states, accessibility behaviour and do/don't.
 * Coverage rule: every component imported by a production route must have an entry here (J.1).
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
  demo?: ReactNode;
}

/** Small interactive demo for the table family (hooks can't run in the static ENTRIES array). */
function TableDemo() {
  const rows = [
    { sku: 'SKU-101', price: 125000, status: 'pending' },
    { sku: 'SKU-102', price: 98000, status: 'approved' },
    { sku: 'SKU-103', price: 210500, status: 'stale' },
  ];
  const vis = useColumnVisibility('ds-demo');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'price', dir: 'asc' });
  return (
    <MestaDataTable
      tableId="ds-demo"
      caption="Demo SKUs"
      columns={[
        { id: 'sku', header: 'SKU', required: true, cell: (r) => r.sku },
        { id: 'price', header: 'Price', sortKey: 'price', align: 'right', cell: (r) => <PriceValue value={r.price} /> },
        { id: 'status', header: 'Status', cell: (r) => <StatusChip status={r.status as 'pending'} /> },
      ]}
      rows={[...rows].sort((a, b) => (sort.dir === 'asc' ? a.price - b.price : b.price - a.price))}
      getRowId={(r) => r.sku}
      sort={{ key: sort.key, dir: sort.dir, onSort: (k) => setSort((s) => ({ key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' })) }}
      visibility={vis}
    />
  );
}

function DrawerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Open drawer</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="SKU-101" href="/catalog" hrefLabel="Open full page">
        <p className="text-sm text-muted">Quick-view content — KPIs, sparkline, actions.</p>
      </Drawer>
    </>
  );
}

/** Static demo objects — a strategy-less rec so strategy-bound rows show the n/a state. */
const DEMO_PRODUCT = {
  sku: 'SKU-101', name: 'Demo product', category: 'Beverages', region: 'Jawa', store: 'Jakarta HQ', cost: 90000, price: 125000,
  minPrice: 100000, maxPrice: 200000, mapPrice: 110000, competitorAvg: 128000, elasticity: -1.2,
  stockUnits: 140, stockStatus: 'in_stock' as const, lastChangeAt: '2026-09-20T09:00:00Z', priceHistory: [],
};
const DEMO_REC = {
  id: 'REC-DEMO', sku: 'SKU-101', currentPrice: 125000, proposedPrice: 118000, confidence: 86,
  source: 'agent' as const, status: 'pending' as const, rationale: [], projectedMarginImpact: 420000,
  strategyId: null, scenarioId: null, ruleId: null, createdAt: '2026-09-21T09:00:00Z', ownerId: 'agent', decidedAt: null, decisionNote: null, deployed: false,
};

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirm action">
        <p className="text-sm text-muted">Decisions that need input or confirmation.</p>
      </Dialog>
    </>
  );
}

const ENTRIES: Entry[] = [
  {
    name: 'PriceValue', file: 'components/ds/PriceValue.tsx', summary: 'IDR amount in mono tabular numerals, locale-aware.',
    props: 'value: number · muted?: boolean · loading?: boolean · animate?: boolean · className?',
    a11y: 'Plain text, so screen readers read the formatted currency. Count-up is skipped under reduced-motion.',
    doText: 'Use for every money value so digits align in tables; set animate where a deploy visibly changes it.', dontText: 'Do not format prices with toLocaleString in feature code.',
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
    name: 'Sparkline', file: 'components/ds/Sparkline.tsx', summary: 'Tiny inline trend line (KPI cards, table trend column).',
    props: 'points: number[] · className?',
    a11y: 'aria-hidden decoration — the numeric value beside it carries the information.',
    doText: 'Pair with the value it summarizes (KPI card, trend column).', dontText: 'Do not use as the only carrier of trend information.',
    reactBits: 'Application UI › Charts › Sparkline',
    demo: <Sparkline points={[4, 6, 5, 8, 7, 11, 9, 13]} className="h-8 w-40 text-brand" />,
  },
  {
    name: 'AgentBorderCard', file: 'components/ds/AgentBorderCard.tsx', summary: 'Card whose left border marks who produced the content and its decision state.',
    props: 'actor: "agent" | "human" | "rule" · status?: "pending" | "approved" | "adjusted" | "rejected" · className?',
    a11y: 'Visually hidden label announces actor + status; colour is supplementary.',
    doText: 'Wrap recommendation-like content authored by an agent, human or rule.', dontText: 'Do not use as a generic card.',
    reactBits: 'Application UI › Cards · Blocks › agent-approval-2',
    demo: <div className="grid gap-2 sm:grid-cols-3">{(['agent', 'human', 'rule'] as const).map((a) => <AgentBorderCard key={a} actor={a}><p className="text-sm">{a}</p></AgentBorderCard>)}</div>,
  },
  {
    name: 'AgentRunTimeline', file: 'components/ds/AgentRunTimeline.tsx', summary: 'Ordered trace of how a recommendation was produced.',
    props: 'steps: RunStep[] {id,label,detail?,at?,ok?}',
    a11y: 'Ordered list with aria-label; ok:false steps show a warn ring + dashed icon.',
    doText: 'Render inside a recommendation evidence section.', dontText: 'Do not fabricate steps — only show what the pipeline actually ran.',
    reactBits: 'Blocks › agent-activity-2, tool-calls-1',
    demo: <AgentRunTimeline steps={[
      { id: 's1', label: 'Competitor data pulled', detail: '3 sources', at: '2026-09-21T09:00:00Z' },
      { id: 's2', label: 'Elasticity calculated', detail: 'band −1.2', at: '2026-09-21T09:00:01Z' },
      { id: 's3', label: 'Guardrails checked', ok: true, at: '2026-09-21T09:00:02Z' },
    ]} />,
  },
  {
    name: 'RationaleBreakdown', file: 'components/ds/RationaleBreakdown.tsx', summary: 'Animated accordion of weighted factors behind a recommendation.',
    props: 'factors: RationaleFactor[] {key,weight,detail} · defaultOpen?: boolean',
    a11y: 'Real <button> toggle with aria-expanded/aria-controls; height animation is reduced-motion safe.',
    doText: 'Show factor weights so reviewers can sanity-check the model.', dontText: 'Do not render weights that do not sum to ~1 — it breaks the bar chart.',
    reactBits: 'Application UI › Disclosure',
    demo: <RationaleBreakdown factors={[
      { key: 'competitor', weight: 0.35, detail: 'Gap vs competitor avg −4.2%' },
      { key: 'elasticity', weight: 0.35, detail: 'Elasticity −1.2, demand +6.0%' },
      { key: 'stock', weight: 0.2, detail: '140 units on hand' },
      { key: 'seasonality', weight: 0.1, detail: 'Neutral seasonal index' },
    ]} />,
  },
  {
    name: 'StatusBadge', file: 'components/ds/StatusBadge.tsx', summary: 'The single status vocabulary — workflow, execution, sync-health, and severity states resolve through one map.',
    props: 'StatusBadge{status: MestaStatus, label?, className?} · StatusIcon{status} · StatusChip + SeverityChip are domain aliases over it',
    a11y: 'Icon + translated label + tone — never colour alone. Running states use a spinning LoaderCircle (killed under reduced-motion).',
    doText: 'Use for every lifecycle/system status: approvals, deployment, publishing, sync health.', dontText: 'Do not hand-roll status spans or page-local STATUS_CLS maps — that is how the vocabulary diverged.',
    reactBits: 'Application UI › Data display › Badge',
    demo: (
      <div className="flex flex-wrap gap-2">
        {(['draft', 'pending', 'approved', 'rejected', 'adjusted', 'changes_requested', 'escalated', 'expired', 'stale',
          'queued', 'scheduled', 'in_flight', 'published', 'failed', 'rolled_back', 'partial',
          'healthy', 'syncing', 'delayed', 'blocked', 'conflicted', 'info', 'warning', 'critical'] as const)
          .map((s) => <StatusBadge key={s} status={s} />)}
      </div>
    ),
  },
  {
    name: 'Trust components', file: 'components/ds/trust.tsx', summary: 'Consequence and recovery vocabulary around high-impact actions (TR-001).',
    props: 'ActionSummary{action,consequence} · ConsequencePreview{items:{label,value,tone?}[]} · RecoveryNotice{children} · DocsLink{href} · MetricDefinition{label,definition,rows?}',
    a11y: 'Consequence text sits adjacent to the CTA it describes; MetricDefinition is a <details> disclosure with a named trigger.',
    doText: 'Bulk approve, overrides, deployments — anywhere scope, impact, or irreversibility must be visible before commit.', dontText: 'Do not hide consequences in tooltips, footnotes, or post-submit toasts.',
    reactBits: 'Blocks › app-dialog-6 (pattern source)',
    demo: (
      <div className="flex flex-col gap-3">
        <ConsequencePreview items={[
          { label: 'Current price', value: <PriceValue value={125000} /> },
          { label: 'New price', value: <PriceValue value={118000} />, tone: 'down' },
          { label: 'Change', value: '−5.6%', tone: 'down' },
          { label: 'vs MAP', value: '+2.1%' },
        ]} />
        <ActionSummary consequence={<>12 SKUs · impact <PriceValue value={21400} /> · 2 excluded</>} action={<Button size="sm">Approve 12</Button>} />
        <RecoveryNotice>Applies immediately — each decision is recorded in the audit trail. <DocsLink href="/audit">View audit trail</DocsLink></RecoveryNotice>
        <div className="flex items-center gap-2 text-xs text-muted">
          Pending approvals <MetricDefinition label="About pending approvals" definition="Recommendations currently waiting for a decision." rows={[{ label: 'Scope', value: 'All stores' }]} />
        </div>
      </div>
    ),
  },
  {
    name: 'System-status primitives', file: 'components/ds/system-status.tsx', summary: 'Operational state: data freshness, channel sync health, job progress, execution traces.',
    props: 'FreshnessBadge{at,label?} · SyncStatus{status} · JobProgress{done,total,label} · ExecutionTimeline{steps:ExecStep[],ariaLabel}',
    a11y: 'JobProgress is role="progressbar" with min/max/now and a label; ExecutionTimeline is a semantic ordered list like AgentRunTimeline.',
    doText: 'Deployment channel health, "competitor data X ago" provenance, publish-job progress, per-record execution history.', dontText: 'Do not show bare timestamps where a freshness claim is being made — name it.',
    reactBits: 'Blocks › monitoring-1',
    demo: (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3"><SyncStatus status="healthy" /><SyncStatus status="in_flight" /><SyncStatus status="failed" /><FreshnessBadge at={new Date(0).toISOString()} label="Updated 5m ago" /><FreshnessBadge at={null} /></div>
        <JobProgress done={3} total={4} label="Channels synced" />
        <ExecutionTimeline ariaLabel="Demo trace" steps={[
          { id: 'a', label: 'Deployment triggered', status: 'queued' },
          { id: 'b', label: 'Channel synced', status: 'synced' },
          { id: 'c', label: 'Retry scheduled', status: 'in_flight' },
        ]} />
      </div>
    ),
  },
  {
    name: 'SeverityChip / LiveDot', file: 'components/ds/SeverityChip.tsx · components/ds/LiveDot.tsx', summary: 'Signal severity palette and the pulsing live indicator.',
    props: 'SeverityChip{s:"info"|"warning"|"critical"} · LiveDot{className?}',
    a11y: 'SeverityChip: icon + translated label. LiveDot is aria-hidden decoration; ping is disabled under reduced-motion.',
    doText: 'One severity scheme everywhere — alerts, monitoring, deployment health.', dontText: 'Do not invent ad-hoc red/yellow chips per page.',
    reactBits: 'Blocks › monitoring-1',
    demo: <div className="flex items-center gap-3"><SeverityChip s="info" /><SeverityChip s="warning" /><SeverityChip s="critical" /><span className="flex items-center gap-1.5 text-xs text-muted"><LiveDot />Live</span></div>,
  },
  {
    name: 'RuleEvaluation', file: 'components/ds/RuleEvaluation.tsx', summary: 'Per-check input→expected→actual→result table explaining why a proposed price passes or fails.',
    props: 'rec: Recommendation · product: Product | undefined — rows derive from evaluateRules()',
    a11y: 'Semantic table with caption and header row; results are icon + translated text, never colour alone.',
    doText: 'Render on the recommendation detail page so a reviewer sees which check drove the outcome.', dontText: 'Do not pass editor drafts — it evaluates the stored proposed price.',
    reactBits: 'Application UI › Data display › Table',
    demo: <RuleEvaluation rec={DEMO_REC} product={DEMO_PRODUCT} />,
  },
  {
    name: 'MestaDataTable', file: 'components/ds/table/DataTable.tsx', summary: 'Unified enterprise table: sort, selection, sticky header, density, virtualization, CSV, column visibility, saved views.',
    props: 'tableId · caption · columns: DataColumn<T>[] · rows · getRowId · sort? · selection? · onRowClick? · virtualize? · csv? · toolbar? · visibility?',
    a11y: 'Semantic table + caption, aria-sort on sortable headers, row keyboard nav (↑↓ move, Space select, Enter open), column menu excludes required columns.',
    doText: 'Every data-dense list view uses this; gate CSV by RBAC and pass visibility for tables with >4 columns.', dontText: 'Do not hand-roll table markup or a second sort implementation.',
    reactBits: 'Blocks › data-table-1 (pattern source)',
    demo: <TableDemo />,
  },
  {
    name: 'Drawer / Dialog', file: 'components/ds/Drawer.tsx · components/ui/dialog.tsx', summary: 'Right-anchored quick-view sheet vs centred decision modal.',
    props: 'Drawer{open,onClose,title,href?,hrefLabel?,children} · Dialog{open,onClose,title,children,className?}',
    a11y: 'Both are native <dialog> — focus trap, Escape, inert background for free. Drawer is full-height on mobile.',
    doText: 'Drawer for row drill-in with an "open full page" link; Dialog for decisions needing input.', dontText: 'Do not build drawers with position:fixed divs — you lose the focus trap.',
    reactBits: 'Blocks › app-dialog-6',
    demo: <div className="flex gap-2"><DrawerDemo /><DialogDemo /></div>,
  },
  {
    name: 'Field / Input', file: 'components/ui/field.tsx', summary: 'Labelled form control wrapper with error text and aria wiring.',
    props: 'Field{label,error?,children(render prop:{id,aria-invalid,aria-describedby})} · Input: native input + inputCls',
    a11y: 'Render prop injects id/aria-invalid/aria-describedby; error text is linked to the control.',
    doText: 'Wrap every form control — labels and errors stay associated.', dontText: 'Do not pair a <label> with htmlFor by hand.',
    reactBits: 'Application UI › Forms',
    demo: <Field label="Proposed price">{(p) => <Input {...p} placeholder="150000" inputMode="numeric" />}</Field>,
  },
  {
    name: 'RoleGate', file: 'components/shell/RoleGate.tsx', summary: 'RBAC wrapper — hide or disable content the role may not use.',
    props: 'action: string · mode?: "hide" | "disable" · fallback?: ReactNode · children',
    a11y: 'Disable mode keeps content discoverable but inert (aria-disabled) instead of removing it.',
    doText: 'Gate write affordances; the actions layer re-checks regardless.', dontText: 'Do not gate on role name directly — always gate on an action.',
    reactBits: 'Application UI › RBAC (Mesta convention)',
    demo: <RoleGate action="deployment.execute" mode="disable"><Button variant="secondary">Ops-only action</Button></RoleGate>,
  },
  {
    name: 'OnboardingChecklist', file: 'components/ds/OnboardingChecklist.tsx', summary: 'First-run checklist whose steps complete from real store state.',
    props: 'title · subtitle · steps:{id,title,description,href,done}[] · doneLabel(n,total)',
    a11y: 'Section landmark + role="progressbar" with localized name/values; done steps read as struck text.',
    doText: 'Show only while the journey is incomplete; let data completion dismiss it.', dontText: 'Do not add a dismiss X — the checklist reflects reality, not preference.',
    reactBits: 'Blocks › onboarding-3',
    demo: <OnboardingChecklist title="Get started" subtitle="Three steps." doneLabel={(n, t) => `${n} of ${t} done`} steps={[
      { id: 'a', title: 'Create a strategy', description: 'Guardrails + scope', href: '/design-system', done: true },
      { id: 'b', title: 'Run a simulation', description: 'Compare scenarios', href: '/design-system', done: false },
      { id: 'c', title: 'Review a recommendation', description: 'Approve or reject', href: '/design-system', done: false },
    ]} />,
  },
  {
    name: 'TopMoversPanel', file: 'components/ds/TopMoversPanel.tsx', summary: 'Side list of SKUs with the largest latest price move, deep-linking to filtered Catalog.',
    props: 'products: Product[]',
    a11y: 'Each row is a link with price + delta badge; margin health is a role="meter" bar.',
    doText: 'Use for "what moved recently" side rails.', dontText: 'Do not use for full inventory views — that is Catalog.',
    reactBits: 'Blocks › list-3',
  },
  {
    name: 'Charts (ChartWithTable)', file: 'components/ds/charts.tsx', summary: 'SVG line/bar charts that always ship an accessible data-table twin.',
    props: 'LineChart{series,labels,format?,label} · BarChart{items,format,label} · ChartWithTable{title,caption,chart,columns,rows,controls?,headline?}',
    a11y: 'The data table is the screen-reader twin; charts are decorative. controls slot holds period pickers.',
    doText: 'Always render through ChartWithTable so the twin cannot be skipped.', dontText: 'Do not render a bare chart without its tabular equivalent.',
    reactBits: 'Blocks › dashboard-1, analytics-2',
  },
  {
    name: 'KpiCard / PageHeader / EmptyState / LoadingRows / PageSkeleton', file: 'components/ds/states.tsx · components/ds/PageSkeleton.tsx', summary: 'Page scaffolding and state placeholders.',
    props: 'KpiCard{label,value:number|ReactNode,format?,hint?,spark?,delta?} · EmptyState{title,variant?:"empty"|"filter"|"caughtUp",action?} · PageSkeleton{variant}',
    a11y: 'LoadingRows + PageSkeleton are role="status" aria-live; ErrorState is role="alert". EmptyState icons are decorative.',
    doText: 'Every data view handles loading, empty, error; match the EmptyState variant to the context.', dontText: 'Do not invent one-off skeletons or variant-less empty boxes.',
    reactBits: 'Application UI › Layout, Empty states · Blocks › empty-state-1',
    demo: <div className="grid gap-3 sm:grid-cols-2"><KpiCard label="Pending" value={12} hint="since Monday" /><EmptyState variant="caughtUp" title="Nothing here yet" /><div className="sm:col-span-2"><LoadingRows rows={2} rowHeight={28} /></div></div>,
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

/** Block → wrapper → surface mapping (source of truth: components/blocks/README.md). */
const BLOCK_MAP: [string, string, string][] = [
  ['app-sidebar-1', 'Sidebar', 'Global shell'],
  ['app-shell-1', 'AppShell', 'Global shell'],
  ['navbar-6', 'TopBar', 'Global shell'],
  ['command-menu-1', 'CommandMenu', 'Global shell — Ctrl+K / /'],
  ['data-table-1', 'MestaDataTable', 'Catalog, Audit, Deployment'],
  ['agent-approval-2', 'AgentBorderCard + DecisionDialog', 'Recommendations queue'],
  ['agent-activity-2', 'AgentRunTimeline', 'Recommendation evidence'],
  ['tool-calls-1', 'AgentRunTimeline steps', 'Recommendation evidence'],
  ['agent-plan-1', 'BulkDialog checklist + GuardrailPreview', 'Queue, Strategy wizard'],
  ['dashboard-1', 'KpiCard spark/delta + ChartWithTable', 'Overview'],
  ['analytics-2', 'ScenarioCompare, DemandChart', 'Simulation, Overview'],
  ['monitoring-1', 'SeverityChip + LiveDot strip', 'Monitoring'],
  ['card-9', 'Sku detail cards', 'Catalog detail'],
  ['wizard-5', 'StrategyWizard stepper', 'Strategy builder'],
  ['integrations-6', 'Channel board', 'Deployment'],
  ['list-3', 'TopMoversPanel + AuditTimeline', 'Overview, Audit'],
  ['filtering-3', 'FilterBar + facet chips', 'Catalog, Recommendations, Audit'],
  ['notifications-1', 'ToastHost + NotificationBell', 'Global shell'],
  ['empty-state-1', 'EmptyState variants', 'All list/table pages'],
  ['app-dialog-6', 'Drawer + Dialog', 'Row drill-in, decisions'],
  ['onboarding-3', 'OnboardingChecklist', 'Overview first run'],
];

const GUIDE: [string, string][] = [
  ['MestaDataTable vs a plain list', 'Rows you need to sort, select, export or drill into → table; small static lists → simple markup.'],
  ['Drawer vs Dialog', 'Row quick-view or entity drill-in → Drawer; a decision needing input or confirmation → Dialog.'],
  ['StatusBadge vs SeverityChip', 'Any lifecycle/system status (pending/deployed/synced/failed/…) → StatusBadge (or its StatusChip alias for recs); signal severity → SeverityChip alias.'],
  ['ActionSummary vs bare CTA', 'Action with consequences a reviewer must see before commit (scope, impact, exclusions) → ActionSummary; trivial navigation or low-risk toggles → plain button.'],
  ['JobProgress vs LoadingRows', 'A job with a measurable denominator (N channels synced) → progressbar; unknown-duration waits → LoadingRows/PageSkeleton.'],
  ['DeltaBadge vs ConfidenceBar', 'How much a number moved → DeltaBadge; an absolute 0–100 score → ConfidenceBar.'],
  ['AgentBorderCard vs plain card', 'Content authored by an agent/human/rule that must show provenance → AgentBorderCard; generic grouping → plain card.'],
  ['AgentRunTimeline vs RationaleBreakdown', 'The process steps that produced a recommendation → timeline; the weighted factors behind it → breakdown.'],
  ['Toast vs notification centre', 'Ephemeral confirmation → toast (it mirrors into the centre anyway); durable cross-role handoffs → notification store.'],
  ['EmptyState variants', 'No data ever → empty; filters excluded everything → filter; work is done → caughtUp.'],
  ['PriceValue vs plain text', 'Any money value → PriceValue (tabular + locale + optional count-up). Never toLocaleString inline.'],
  ['PageSkeleton vs LoadingRows', 'Route-level loading.tsx → PageSkeleton matched to the layout; in-page query loading → LoadingRows.'],
  ['SavedViewMenu vs facet chips', 'Persist a filter+column combination for reuse → saved view; expose/remove active filters → chips.'],
  ['KpiCard vs TopMoversPanel', 'Aggregate metric with spark/delta → KpiCard; ranked entity list needing drill-in → TopMoversPanel.'],
  ['RoleGate hide vs disable', 'Action the role should never see → hide; discoverable but inert affordance → disable.'],
  ['Bulk approve vs undo-staged decide', 'One-off reversible decision → staged decide (10 s undo); batch of verified items → bulk approve (immediate, checklist-gated).'],
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
            {e.demo && <div className="my-3 rounded-input border border-line bg-bg p-4">{e.demo}</div>}
            <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted">Props</dt><dd><code className="text-xs">{e.props}</code></dd>
              <dt className="text-muted">Accessibility</dt><dd>{e.a11y}</dd>
              <dt className="text-muted">Do</dt><dd>{e.doText}</dd>
              <dt className="text-muted">Don&apos;t</dt><dd>{e.dontText}</dd>
              <dt className="text-muted">React Bits Pro</dt><dd>{e.reactBits}</dd>
            </dl>
          </section>
        ))}
        <section aria-labelledby="ds-blocks" className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 id="ds-blocks" className="text-base font-semibold">React Bits Pro blocks → production surfaces</h2>
          <p className="text-sm text-muted">
            Vendored blocks in <code className="text-xs">components/blocks/</code> are pattern sources — never imported raw
            (enforced by <code className="text-xs">tests/block-boundary.test.ts</code>). Each row maps a block to the
            Mesta component that carries its pattern and where that component ships.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">React Bits Pro block to production component mapping</caption>
              <thead className="text-left text-xs text-muted">
                <tr><th scope="col" className="py-1 font-medium">Block</th><th scope="col" className="py-1 font-medium">Production component</th><th scope="col" className="py-1 font-medium">Surface</th></tr>
              </thead>
              <tbody>{BLOCK_MAP.map(([b, c, s]) => <tr key={b} className="border-t border-line"><th scope="row" className="py-1 pr-3 text-left font-medium"><code className="text-xs">{b}</code></th><td className="py-1 pr-3">{c}</td><td className="py-1 text-muted">{s}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="ds-guide" className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 id="ds-guide" className="mb-2 text-base font-semibold">Which component do I use?</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Component decision guide</caption>
            <thead className="text-left text-xs text-muted"><tr><th scope="col" className="py-1 font-medium">Choice</th><th scope="col" className="py-1 font-medium">Rule</th></tr></thead>
            <tbody>{GUIDE.map(([n, d]) => <tr key={n} className="border-t border-line"><th scope="row" className="py-1 pr-3 text-left font-medium">{n}</th><td className="py-1">{d}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </>
  );
}
