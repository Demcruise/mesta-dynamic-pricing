'use client';

import { Download, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ComponentType } from 'react';
import { EmptyState, PageHeader } from '@/components/ds/states';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/components/ui/field';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useToastStore, useWorkspaceSettingsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { GROUPS, SECTIONS, sectionBySlug } from './registry';
import { IdentitySsoSection, SessionsSection, UsersSection } from './sections-access';
import { ApiSection, AuditRetentionSection, FeaturesSection, RolesSection, SecuritySection } from './sections-governance';
import { NotificationsSection, PreferencesSection, ViewsSection } from './sections-personal';
import {
  AlertsRoutingSection, ApprovalsSection, GeneralSection, GuardrailDefaultsSection, IntegrationsSection, PricingEngineSection, ScopeSection, WorkflowSection,
} from './sections-workspace';

const VIEWS: Record<string, ComponentType> = {
  preferences: PreferencesSection, notifications: NotificationsSection, views: ViewsSection,
  general: GeneralSection, 'scope-hierarchy': ScopeSection, 'pricing-engine': PricingEngineSection, integrations: IntegrationsSection,
  approvals: ApprovalsSection, guardrails: GuardrailDefaultsSection, workflow: WorkflowSection, alerts: AlertsRoutingSection,
  'identity-sso': IdentitySsoSection, users: UsersSection, sessions: SessionsSection,
  roles: RolesSection, audit: AuditRetentionSection, api: ApiSection, security: SecuritySection, features: FeaturesSection,
};

/**
 * Enterprise settings shell (SET-001/002/033/034/041/042/044): a persistent 240px navigation split
 * into Personal · Workspace · Governance · System, a settings search, and one section per stable
 * URL (/settings/<slug>). The content column is capped at 1280px overall. Below lg the navigation
 * collapses into a section picker so forms get the full width.
 */
export function SettingsPage({ section }: { section: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const drafts = useWorkspaceSettingsStore((s) => s.drafts);
  const config = useWorkspaceSettingsStore((s) => s.config);
  const [q, setQ] = useState('');
  const active = sectionBySlug(section);
  const View = active ? VIEWS[active.slug] : undefined;

  // SET-041: search section titles, descriptions and keywords.
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return SECTIONS.filter((s) => [t(`settings.section.${s.slug}.title`), t(`settings.section.${s.slug}.desc`), ...s.keywords].some((x) => x.toLowerCase().includes(needle)));
  }, [q, t]);

  // SET-044: non-secret configuration only — credentials never leave the browser.
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), workspace: config }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mesta-workspace-config-${config.general.workspaceId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t('settings.export.done'));
  };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={can('settings.manage') ? <Button variant="secondary" onClick={exportConfig}><Download className="size-4" aria-hidden />{t('settings.export.button')}</Button> : undefined}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" aria-label={t('settings.search.label')} placeholder={t('settings.search.placeholder')} value={q}
              onChange={(e) => setQ(e.target.value)} className={cn(inputCls, 'pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden')} />
            {q && (
              <button type="button" aria-label={t('common.filter.clear')} onClick={() => setQ('')} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-subtle">
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>

          {q ? (
            <div role="region" aria-live="polite" aria-label={t('settings.search.results', { n: results.length })}>
              <p className="mb-2 text-caption text-faint">{t('settings.search.results', { n: results.length })}</p>
              {results.length === 0 ? <p className="text-body-sm text-muted">{t('settings.search.empty', { q })}</p> : (
                <ul className="flex flex-col gap-1">
                  {results.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/settings/${s.slug}`} onClick={() => setQ('')} className="block rounded-input px-3 py-2 hover:bg-subtle">
                        <span className="block text-label font-medium text-fg">{t(`settings.section.${s.slug}.title`)}</span>
                        <span className="block text-caption text-faint">{t(`settings.group.${s.group}`)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              {/* Narrow screens: one picker instead of the full rail (SET-046 responsive). */}
              <label className="lg:hidden">
                <span className="sr-only">{t('settings.nav.jump')}</span>
                <select className={inputCls} value={section} onChange={(e) => router.push(`/settings/${e.target.value}`)}>
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={t(`settings.group.${g}`)}>
                      {SECTIONS.filter((s) => s.group === g).map((s) => <option key={s.slug} value={s.slug}>{t(`settings.section.${s.slug}.title`)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <nav aria-label={t('settings.nav.label')} className="hidden flex-col gap-5 lg:flex">
                {GROUPS.map((g) => (
                  <div key={g}>
                    <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{t(`settings.group.${g}`)}</p>
                    <ul className="flex flex-col gap-0.5">
                      {SECTIONS.filter((s) => s.group === g).map((s) => {
                        const Icon = s.icon;
                        const current = s.slug === section;
                        const unsaved = s.configKey !== undefined && drafts[s.configKey] !== undefined;
                        return (
                          <li key={s.slug}>
                            <Link
                              href={`/settings/${s.slug}`}
                              aria-current={current ? 'page' : undefined}
                              className={cn('flex h-9 items-center gap-2.5 rounded-row px-3 text-[13px] transition-colors duration-fast', current ? 'bg-brand-soft font-semibold text-brand' : 'font-medium text-muted hover:bg-subtle hover:text-fg')}
                            >
                              <Icon className="size-4 shrink-0" aria-hidden />
                              <span className="truncate">{t(`settings.section.${s.slug}.title`)}</span>
                              {unsaved && <span className="ml-auto size-2 shrink-0 rounded-full bg-warn" aria-label={t('settings.save.unsaved')} />}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </>
          )}
        </aside>

        <section className="min-w-0" aria-label={active ? t(`settings.section.${active.slug}.title`) : t('settings.title')}>
          {View ? <View /> : <EmptyState title={t('common.state.notFound')} action={{ label: t('settings.section.preferences.title'), onClick: () => router.push('/settings/preferences') }} />}
        </section>
      </div>
    </div>
  );
}
