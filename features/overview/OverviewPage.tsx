'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { OnboardingChecklist } from '@/components/ds/OnboardingChecklist';
import { TopMoversPanel } from '@/components/ds/TopMoversPanel';
import { KpiCard, LoadingRows, PageHeader } from '@/components/ds/states';
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

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.greeting', { name: user.name, role: t(`common.role.${user.role}`) })}
        actions={
          onboardingDismissed ? (
            <button type="button" onClick={() => setOnboardingDismissed(false)} className="text-sm text-brand hover:underline">
              {t('overview.onboarding.reopen')}
            </button>
          ) : undefined
        }
      />
      {loading ? <LoadingRows rows={4} rowHeight={72} /> : (
        <>
          <PersonaPrompt t={t} />
          {/* G-02 §1 attention: the role-prioritized "what needs me" strip leads the dashboard. */}
          {view.attention.length > 0 && (
            <section aria-label={t('overview.attention.title')} className="mb-4 rounded-card border border-warn/40 bg-warn-soft/30 p-card shadow-e1">
              <h2 className="mb-2 text-sm font-semibold">{t('overview.attention.title')}</h2>
              <ul className="flex flex-wrap gap-2">
                {view.attention.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} onClick={() => quick(a.href)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm transition-colors duration-fast hover:bg-subtle">
                      <span className="tabular font-semibold">{a.n}</span>
                      <span className="text-muted">{t(`overview.attention.${a.key}`)}</span>
                      <ArrowRight aria-hidden className="size-3.5 text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
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
          <section aria-label={t('common.a11y.kpi')} className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {view.kpis.map((k) => (
              <KpiCard
                key={k.key}
                label={
                  <Link href={k.href ?? '/overview'} onClick={() => quick(k.href ?? '/overview')} className="rounded transition-colors duration-fast hover:text-fg hover:underline">
                    {t(`overview.kpi.${k.key}`)}
                  </Link>
                }
                value={typeof k.value === 'number' ? k.value : fmt(k)}
                format={k.kind === 'money' ? (n) => formatPrice(n, locale) : k.kind === 'percent' ? (n) => formatPercent(n, locale) : undefined}
                spark={k.spark} delta={k.delta}
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
            ))}
          </section>

          <nav aria-label={t('overview.title')} className="mb-6 flex flex-wrap gap-2">
            {links.map((l) => (
              <Link key={l.key} href={l.href} onClick={() => quick(l.href)} className="rounded-full border border-line bg-surface px-3 py-1 text-sm transition-colors duration-fast hover:bg-subtle">
                {t(`overview.links.${l.key}`)}
              </Link>
            ))}
          </nav>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <OverviewCharts products={skus.data} volume={view.volume} gap={view.gap} />
            <div className="flex min-w-0 flex-col gap-4">
              {/* G-02 §5 decision queue: top pending recommendations by absolute impact. */}
              <section className="rounded-card border border-line bg-surface p-card shadow-e1">
                <h2 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold">
                  {t('overview.queue.title')}
                  <Link href="/recommendations?status=pending" onClick={() => quick('/recommendations?status=pending')} className="text-xs font-normal text-brand hover:underline">
                    {t('overview.queue.all')}
                  </Link>
                </h2>
                {view.queue.length === 0 ? <p className="text-sm text-muted">{t('overview.queue.empty')}</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {view.queue.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                        <Link href={`/recommendations/${r.id}`} className="min-w-0 truncate hover:underline">
                          <span className="tabular font-medium text-brand">{r.id}</span>
                          <span className="tabular text-muted"> · {r.sku}</span>
                        </Link>
                        <span className="tabular shrink-0 text-muted">
                          {formatPrice(r.proposedPrice, locale)}
                          <span className={cn('ml-2 font-medium', r.projectedMarginImpact >= 0 ? 'text-up' : 'text-down')}>
                            {r.projectedMarginImpact >= 0 ? '+' : ''}{formatPrice(Math.round(r.projectedMarginImpact), locale)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <TopMoversPanel products={skus.data} />
              <section className="rounded-card border border-line bg-surface p-card shadow-e1">
                <h2 className="mb-2 text-sm font-semibold">{t('overview.activity.title')}</h2>
                {audit.data.length === 0 ? <p className="text-sm text-muted">{t('overview.activity.empty')}</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {audit.data.slice(0, 8).map((e) => (
                      <li key={e.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                        <span>{t(`common.event.${e.type}`)} · <span className="tabular">{e.sku ?? e.entityId}</span></span>
                        <span className="tabular text-muted">{formatDate(e.timestamp, locale)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

const PERSONAS: { role: Role; icon: string }[] = [
  { role: 'analyst', icon: '◇' },
  { role: 'manager', icon: '◈' },
  { role: 'approver', icon: '◆' },
  { role: 'ops_lead', icon: '▣' },
  { role: 'compliance', icon: '◎' },
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
    <section aria-label={t('overview.persona.title')} className="mb-4 rounded-card border border-brand/40 bg-brand-soft/30 p-card shadow-e1">
      <h2 className="text-sm font-semibold text-fg">{t('overview.persona.title')}</h2>
      <p className="mt-0.5 text-xs text-muted">{t('overview.persona.subtitle')}</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {PERSONAS.map((p) => (
          <li key={p.role}>
            <button
              type="button"
              onClick={() => choosePersona(p.role)}
              className="group flex w-full items-center gap-2.5 rounded-input border border-line bg-surface px-3 py-2.5 text-left transition-colors duration-fast hover:border-brand hover:bg-brand-soft"
            >
              <span aria-hidden className="text-brand">{p.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t(`overview.persona.${p.role}`)}</span>
                <span className="block truncate text-xs text-muted">{t(`overview.persona.${p.role}Desc`)}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-faint transition-colors duration-fast group-hover:text-brand" />
            </button>
          </li>
        ))}
      </ul>
    </section>
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
