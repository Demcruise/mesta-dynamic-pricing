'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, BadgeDollarSign, Briefcase, CheckCheck, ClipboardList, Gauge, History, Hourglass,
  LineChart as LineChartIcon, ListChecks, PencilLine, RefreshCw, Rocket, Scale, ScrollText, ServerCrash, ShieldAlert,
  Stamp, Target, TrendingUp, TriangleAlert, Users, type LucideIcon,
} from 'lucide-react';
import { OnboardingChecklist } from '@/components/ds/OnboardingChecklist';
import { TopMoversPanel } from '@/components/ds/TopMoversPanel';
import type { Polarity } from '@/components/ds/DeltaBadge';
import { KpiCard, LoadingRows, PageHeader, Panel } from '@/components/ds/states';
import { Button } from '@/components/ui/button';
import { MetricDefinition } from '@/components/ds/trust';
import { canDecideAtLevel, pendingApprovalLevel, recommendationHealth } from '@/lib/actions/recommendation';
import { formatDate, formatPercent, formatPrice, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Recommendation, Role, UserSession } from '@/lib/ontology';
import {
  useAnomalies, useAuditLog, useDataSources, useDeploymentRecords, usePriceEvents, useRules, useScenarios, useScopedRecommendations, useScopedSkuList, useScopedSkuSet, useStrategies,
} from '@/lib/queries';
import { can, type Action } from '@/lib/rbac';
import { useMonitoringStore, useSessionStore, useUiStore } from '@/lib/stores';
import { track } from '@/lib/telemetry';
import { cn } from '@/lib/utils';
import { decisionsByCategory, gapByCategory, roleKpis } from './kpis';

const OverviewCharts = dynamic(() => import('./OverviewCharts').then((m) => m.OverviewCharts), {
  loading: () => <LoadingRows rows={4} rowHeight={60} />,
});

export function OverviewPage() {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const threshold = useMonitoringStore((s) => s.threshold);
  const skus = useScopedSkuList();
  const recs = useScopedRecommendations();
  const scopedSkuSet = useScopedSkuSet();
  const audit = useAuditLog();
  const anomaliesAll = useAnomalies();
  const anomalies = useMemo(
    () => ({ ...anomaliesAll, data: scopedSkuSet ? anomaliesAll.data.filter((a) => scopedSkuSet.has(a.sku)) : anomaliesAll.data }),
    [anomaliesAll, scopedSkuSet],
  );
  const strategies = useStrategies();
  const scenarios = useScenarios();
  const deployments = useDeploymentRecords();
  const events = usePriceEvents();
  const rules = useRules();
  const sources = useDataSources();

  useEffect(() => { track('page_viewed', { page: 'overview', role: user.role }); }, [user.role]);

  const loading = [skus, recs, audit, anomalies, strategies, scenarios, deployments, events].some((q) => q.isLoading);

  const view = useMemo(() => {
    const breachRecs = recs.data.filter((r) => r.status === 'pending' && recommendationHealth(r).breach);
    const lastDeploymentAt = events.data.filter((e) => e.source === 'deployment').map((e) => e.at).sort().at(-1) ?? null;
    // G-03 attention strip: role-prioritized "needs attention" items.
    const awaitingMine = recs.data.filter((r) => {
      const level = pendingApprovalLevel(r);
      return (r.status === 'pending' || r.status === 'escalated') && (!level || canDecideAtLevel(user, level));
    });
    const failedDeploys = deployments.data.filter((d) => d.status === 'failed').length;
    const anomalyCount = anomalies.data.filter((a) => Math.abs(a.deviationPercent) > threshold).length;
    const badSources = sources.data.filter((s) => s.status !== 'healthy').length;
    const queue: Recommendation[] = recs.data
      .filter((r) => r.status === 'pending' || r.status === 'escalated')
      .sort((a, b) => Math.abs(b.projectedMarginImpact) - Math.abs(a.projectedMarginImpact))
      .slice(0, 5);
    const attention: { key: string; href: string; n: number }[] = [
      { key: 'awaiting', href: '/approvals', n: awaitingMine.length },
      { key: 'breaches', href: '/catalog?mh=critical', n: breachRecs.length },
      { key: 'failedDeploys', href: '/deployment?status=failed', n: failedDeploys },
      { key: 'anomalies', href: '/monitoring', n: anomalyCount },
      { key: 'sources', href: '/data', n: badSources },
    ].filter((a) => a.n > 0);
    const priority: Record<Role, string[]> = {
      analyst: ['awaiting', 'anomalies', 'breaches', 'failedDeploys', 'sources'],
      manager: ['awaiting', 'breaches', 'failedDeploys', 'anomalies', 'sources'],
      approver: ['awaiting', 'breaches', 'failedDeploys', 'anomalies', 'sources'],
      ops_lead: ['failedDeploys', 'sources', 'anomalies', 'awaiting', 'breaches'],
      compliance: ['breaches', 'awaiting', 'anomalies', 'failedDeploys', 'sources'],
    };
    attention.sort((a, b) => priority[user.role].indexOf(a.key) - priority[user.role].indexOf(b.key));
    return {
      kpis: roleKpis({
        user, recs: recs.data, audit: audit.data, anomalies: anomalies.data, threshold, strategies: strategies.data,
        deployments: deployments.data, breachRecs, lastDeploymentAt,
      }),
      volume: decisionsByCategory(recs.data, skus.data),
      gap: gapByCategory(skus.data),
      breachCount: breachRecs.length,
      attention,
      queue,
    };
  }, [user, recs.data, audit.data, anomalies.data, threshold, strategies.data, deployments.data, events.data, skus.data, sources.data]);

  const fmt = (k: (typeof view.kpis)[number]) => {
    if (k.value === null) return t('overview.kpi.none');
    if (k.kind === 'money') return formatPrice(Number(k.value), locale);
    if (k.kind === 'percent') return formatPercent(Number(k.value), locale);
    if (k.kind === 'date') return formatDate(String(k.value), locale);
    return String(k.value);
  };
  const quick = (href: string) => track('quick_link_clicked', { href });

  const links: { key: string; href: string }[] = [
    ...(user.role === 'analyst' || user.role === 'manager' ? [{ key: 'pending', href: '/recommendations?status=pending' }] : []),
    ...(view.breachCount > 0 ? [{ key: 'breach', href: '/catalog?mh=critical' }] : []),
    ...(user.role === 'ops_lead' || user.role === 'manager' ? [{ key: 'failures', href: '/deployment?status=failed' }] : []),
    ...(user.role === 'manager' ? [{ key: 'strategies', href: '/strategy' }] : []),
    ...(user.role === 'compliance' ? [{ key: 'audit', href: '/audit' }] : []),
    { key: 'monitoring', href: '/monitoring' },
  ];

  const onboardingDismissed = useUiStore((s) => s.onboardingDismissed);
  const setOnboardingDismissed = useUiStore((s) => s.setOnboardingDismissed);

  const kpiCols = view.kpis.length >= 4 ? 'xl:grid-cols-4' : view.kpis.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2';

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.greeting', { name: user.name, role: t(`common.role.${user.role}`) })}
        actions={
          onboardingDismissed ? (
            <Button variant="secondary" size="sm" onClick={() => setOnboardingDismissed(false)}>
              <ListChecks aria-hidden className="size-3.5" />
              {t('overview.onboarding.reopen')}
            </Button>
          ) : undefined
        }
      />
      {loading ? <LoadingRows rows={4} rowHeight={72} /> : (
        <div className="flex flex-col gap-3">
          <PersonaPrompt t={t} />
          {/* G-02 §1 attention: the role-prioritized "what needs me" strip leads the dashboard. */}
          {view.attention.length > 0 && (
            <Panel
              aria-label={t('overview.attention.title')}
              icon={TriangleAlert}
              title={t('overview.attention.title')}
              className="border-warn/25 bg-warn-soft/40"
            >
              <ul className="flex flex-wrap gap-2">
                {view.attention.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} onClick={() => quick(a.href)} className={chipLinkCls}>
                      <span className="tabular font-semibold text-fg">{a.n}</span>
                      <span className="text-muted">{t(`overview.attention.${a.key}`)}</span>
                      <ArrowRight aria-hidden className="size-3.5 text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {!onboardingDismissed && (
            <SetupChecklist
              t={t} user={user}
              skuCount={skus.data.length}
              allHealthy={sources.data.length > 0 && sources.data.every((s) => s.status === 'healthy')}
              hasActiveStrategy={strategies.data.some((s) => s.status === 'active')}
              hasActiveRule={rules.data.some((r) => r.status === 'active')}
              hasScenario={scenarios.data.length > 0}
              queueClear={!recs.data.some((r) => r.status === 'pending' || r.status === 'escalated')}
              hasDeploy={deployments.data.some((d) => d.status === 'synced')}
              onDismiss={() => setOnboardingDismissed(true)}
            />
          )}
          <section aria-label={t('common.a11y.kpi')} className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', kpiCols)}>
            {view.kpis.map((k) => {
              const meta = KPI_META[k.key] ?? { icon: Gauge, polarity: 'neutral' as const };
              return (
                <KpiCard
                  key={k.key}
                  icon={meta.icon}
                  polarity={meta.polarity}
                  label={
                    <Link href={k.href ?? '/overview'} onClick={() => quick(k.href ?? '/overview')} className="inline-flex min-h-6 items-center rounded transition-colors duration-fast hover:text-brand hover:underline">
                      {t(`overview.kpi.${k.key}`)}
                    </Link>
                  }
                  value={typeof k.value === 'number' ? k.value : fmt(k)}
                  format={k.kind === 'money' ? (n) => formatPrice(n, locale) : k.kind === 'percent' ? (n) => formatPercent(n, locale) : undefined}
                  spark={k.spark}
                  delta={k.delta}
                  comparison={k.delta !== undefined ? t('overview.kpi.vsPrev') : undefined}
                  hint={
                    <MetricDefinition
                      label={t('overview.def.about', { name: t(`overview.kpi.${k.key}`) })}
                      definition={t(`overview.kpiDef.${k.key}`)}
                      rows={[
                        { label: t('overview.def.scope'), value: t('overview.def.scopeValue') },
                        { label: t('overview.def.source'), value: t('overview.def.sourceValue') },
                        { label: t('overview.def.updated'), value: t('overview.def.updatedValue') },
                      ]}
                    />
                  }
                />
              );
            })}
          </section>

          <nav aria-label={t('overview.title')} className="flex flex-wrap gap-2">
            {links.map((l) => (
              <Link key={l.key} href={l.href} onClick={() => quick(l.href)} className={chipLinkCls}>
                {t(`overview.links.${l.key}`)}
                <ArrowUpRight aria-hidden className="size-3.5 text-faint" />
              </Link>
            ))}
          </nav>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-8">
              <OverviewCharts products={skus.data} volume={view.volume} gap={view.gap} />
            </div>
            <div className="flex min-w-0 flex-col gap-3 xl:col-span-4">
              {/* G-02 §5 decision queue: top pending recommendations by absolute impact. */}
              <Panel
                icon={ListChecks}
                title={t('overview.queue.title')}
                actions={
                  <Link href="/recommendations?status=pending" onClick={() => quick('/recommendations?status=pending')} className="text-xs font-medium text-brand hover:underline">
                    {t('overview.queue.all')}
                  </Link>
                }
              >
                {view.queue.length === 0 ? <p className="text-[13px] text-muted">{t('overview.queue.empty')}</p> : (
                  <ul className="flex flex-col gap-1.5">
                    {view.queue.map((r) => (
                      <li key={r.id}>
                        <Link href={`/recommendations/${r.id}`} className={rowLinkCls}>
                          <span className="min-w-0">
                            <span className="tabular block truncate text-[13px] font-semibold text-fg">{r.id}</span>
                            <span className="tabular block truncate text-[11px] text-faint">{r.sku} · {formatPrice(r.proposedPrice, locale)}</span>
                          </span>
                          <span className={cn('tabular shrink-0 text-xs font-semibold', r.projectedMarginImpact >= 0 ? 'text-up' : 'text-down')}>
                            {r.projectedMarginImpact >= 0 ? '+' : ''}{formatPrice(Math.round(r.projectedMarginImpact), locale)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <TopMoversPanel products={skus.data} />
              <Panel icon={History} title={t('overview.activity.title')}>
                {audit.data.length === 0 ? <p className="text-[13px] text-muted">{t('overview.activity.empty')}</p> : (
                  <ul className="flex flex-col gap-1.5">
                    {audit.data.slice(0, 5).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 rounded-row bg-row px-2.5 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-fg">{t(`common.event.${e.type}`)}</span>
                          <span className="tabular block truncate text-[11px] text-faint">{e.sku ?? e.entityId}</span>
                        </span>
                        <time dateTime={e.timestamp} className="tabular shrink-0 text-[11px] font-medium text-faint">{formatRelativeTime(e.timestamp, locale)}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Pill-shaped navigation chip (attention counts, quick links) — one anatomy for both rows. */
const chipLinkCls =
  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium tracking-label text-fg transition-colors duration-fast hover:bg-subtle';
/** Reference list row: tinted band, 8px radius, primary line + meta line. */
const rowLinkCls =
  'flex items-center justify-between gap-3 rounded-row bg-row px-2.5 py-2 transition-colors duration-fast hover:bg-subtle';

/** Icon + sentiment per KPI: the arrow shows direction, colour shows whether that direction is good. */
const KPI_META: Record<string, { icon: LucideIcon; polarity: Polarity }> = {
  pendingApprovals: { icon: ClipboardList, polarity: 'lower-better' },
  reviewed: { icon: CheckCheck, polarity: 'higher-better' },
  activeAnomalies: { icon: Activity, polarity: 'lower-better' },
  marginImpact: { icon: TrendingUp, polarity: 'higher-better' },
  overrideRate: { icon: PencilLine, polarity: 'lower-better' },
  strategyHealth: { icon: Target, polarity: 'higher-better' },
  pendingStrategies: { icon: Hourglass, polarity: 'neutral' },
  channelFailures: { icon: ServerCrash, polarity: 'lower-better' },
  pendingSyncs: { icon: RefreshCw, polarity: 'lower-better' },
  lastDeployment: { icon: Rocket, polarity: 'neutral' },
  awaitingExecutive: { icon: Stamp, polarity: 'lower-better' },
  decidedByMe: { icon: CheckCheck, polarity: 'higher-better' },
  executiveImpact: { icon: BadgeDollarSign, polarity: 'higher-better' },
  auditVolume: { icon: ScrollText, polarity: 'neutral' },
  manualOverrides: { icon: PencilLine, polarity: 'lower-better' },
  guardrailExceptions: { icon: ShieldAlert, polarity: 'lower-better' },
};

type T = (key: string, vars?: Record<string, string | number>) => string;

const PERSONAS: { role: Role; icon: LucideIcon }[] = [
  { role: 'analyst', icon: LineChartIcon },
  { role: 'manager', icon: Briefcase },
  { role: 'approver', icon: Stamp },
  { role: 'ops_lead', icon: Rocket },
  { role: 'compliance', icon: Scale },
];

/**
 * ONB-001: first-run "what do you work on?" prompt. Choosing a persona sets the
 * session role, which reshapes nav, permissions, quick links, and the setup
 * checklist below — the checklist stays role-aware via RBAC gating.
 */
function PersonaPrompt({ t }: { t: T }) {
  const personaChosen = useSessionStore((s) => s.personaChosen);
  const choosePersona = useSessionStore((s) => s.choosePersona);
  if (personaChosen) return null;
  return (
    <Panel aria-label={t('overview.persona.title')} icon={Users} title={t('overview.persona.title')} description={t('overview.persona.subtitle')}>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {PERSONAS.map((p) => (
          <li key={p.role}>
            <button
              type="button"
              onClick={() => choosePersona(p.role)}
              className="group flex w-full items-center gap-2.5 rounded-row bg-row px-2.5 py-2 text-left transition-colors duration-fast hover:bg-brand-soft"
            >
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-line-icon bg-icon text-brand">
                <p.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-fg">{t(`overview.persona.${p.role}`)}</span>
                <span className="block truncate text-[11px] text-faint">{t(`overview.persona.${p.role}Desc`)}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-faint transition-colors duration-fast group-hover:text-brand" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Seven-step workspace setup tracker (E.2). Every step is derived from real
 * store state and gated by RBAC — a role only sees steps it can act on.
 * The seeded workspace means some steps are already done; the subtitle says so.
 * Hidden entirely once every visible step is complete.
 */
function SetupChecklist({ t, user, skuCount, allHealthy, hasActiveStrategy, hasActiveRule, hasScenario, queueClear, hasDeploy, onDismiss }: {
  t: T; user: UserSession;
  skuCount: number; allHealthy: boolean; hasActiveStrategy: boolean; hasActiveRule: boolean;
  hasScenario: boolean; queueClear: boolean; hasDeploy: boolean; onDismiss: () => void;
}) {
  const all: { id: string; href: string; action: Action; done: boolean }[] = [
    { id: 'catalog', href: '/catalog', action: 'catalog.view', done: skuCount > 0 },
    { id: 'feeds', href: '/data', action: 'data.view', done: allHealthy },
    { id: 'strategy', href: '/strategy', action: 'strategy.create', done: hasActiveStrategy },
    { id: 'rules', href: '/rules', action: 'rule.manage', done: hasActiveRule },
    { id: 'simulate', href: '/simulation', action: 'simulation.use', done: hasScenario },
    { id: 'decide', href: '/approvals', action: 'recommendation.decide', done: queueClear },
    { id: 'publish', href: '/deployment', action: 'deployment.view', done: hasDeploy },
  ];
  const steps = all
    .filter((s) => can(user.role, s.action))
    .map(({ id, href, done }) => ({
      id, href, done,
      title: t(`overview.onboarding.step.${id}`), description: t(`overview.onboarding.step.${id}Hint`),
    }));
  if (steps.length === 0 || steps.every((s) => s.done)) return null;
  return (
    <OnboardingChecklist
      title={t('overview.onboarding.title')}
      subtitle={`${t('overview.onboarding.subtitle')} ${t('overview.onboarding.sample')}`}
      doneLabel={(n, total) => t('overview.onboarding.progress', { n, total })}
      steps={steps}
      onDismiss={onDismiss}
      dismissLabel={t('overview.onboarding.dismiss')}
    />
  );
}
