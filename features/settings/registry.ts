import {
  Bell, Blocks, Bookmark, Building2, Cable, ClipboardCheck, Cpu, KeyRound, Network, ScrollText, ShieldCheck, SlidersHorizontal,
  ToggleRight, UsersRound, Workflow, BellRing, type LucideIcon,
} from 'lucide-react';

export type SettingsGroup = 'personal' | 'workspace' | 'governance' | 'system';

export interface SettingsSectionDef {
  slug: string;
  group: SettingsGroup;
  icon: LucideIcon;
  /** Workspace config key edited by this section (drafts + unsaved dot in the nav). */
  configKey?: 'general' | 'scope' | 'pricing' | 'data' | 'approvals' | 'guardrails' | 'workflow' | 'alerts' | 'audit' | 'security' | 'features';
  /** Extra search terms (SET-041) beyond the section's own i18n labels. */
  keywords: string[];
}

/** SET-002/042 — the settings IA; every entry has a stable /settings/<slug> deep link. */
export const SECTIONS: SettingsSectionDef[] = [
  { slug: 'preferences', group: 'personal', icon: SlidersHorizontal, keywords: ['theme', 'dark', 'language', 'density', 'time zone', 'date', 'currency', 'number', 'landing'] },
  { slug: 'notifications', group: 'personal', icon: Bell, keywords: ['email', 'in-app', 'alert', 'notify'] },
  { slug: 'views', group: 'personal', icon: Bookmark, keywords: ['saved views', 'filters', 'columns'] },
  { slug: 'general', group: 'workspace', icon: Building2, configKey: 'general', keywords: ['workspace name', 'workspace id', 'environment', 'owner', 'support'] },
  { slug: 'scope-hierarchy', group: 'workspace', icon: Network, configKey: 'scope', keywords: ['hierarchy', 'business unit', 'region', 'store', 'category', 'default scope'] },
  { slug: 'pricing-engine', group: 'workspace', icon: Cpu, configKey: 'pricing', keywords: ['rounding', 'increment', 'precision', 'freshness', 'model', 'elasticity', 'fallback', 'psychological'] },
  { slug: 'integrations', group: 'workspace', icon: Cable, configKey: 'data', keywords: ['erp', 'pos', 'connection', 'sync', 'source of truth', 'freshness'] },
  { slug: 'approvals', group: 'workspace', icon: ClipboardCheck, configKey: 'approvals', keywords: ['approval thresholds', 'approval chains', 'auto-approval', 'escalation', 'sla', 'segregation of duties'] },
  { slug: 'guardrails', group: 'workspace', icon: ShieldCheck, configKey: 'guardrails', keywords: ['max change', 'price floor', 'ceiling', 'map', 'inheritance', 'confidence'] },
  { slug: 'workflow', group: 'workspace', icon: Workflow, configKey: 'workflow', keywords: ['recommendation ttl', 'stale', 'simulation', 'experiment', 'queue'] },
  { slug: 'alerts', group: 'workspace', icon: BellRing, configKey: 'alerts', keywords: ['routing', 'channels', 'webhook', 'slack', 'mandatory', 'escalation'] },
  { slug: 'roles', group: 'governance', icon: UsersRound, keywords: ['permissions', 'rbac', 'access', 'roles'] },
  { slug: 'audit', group: 'governance', icon: ScrollText, configKey: 'audit', keywords: ['retention', 'immutable', 'export', 'events'] },
  { slug: 'api', group: 'governance', icon: KeyRound, keywords: ['api keys', 'service accounts', 'webhook', 'secrets'] },
  { slug: 'security', group: 'governance', icon: ShieldCheck, configKey: 'security', keywords: ['session', 'sso', 'mfa', 'login', 'domains'] },
  { slug: 'features', group: 'system', icon: ToggleRight, configKey: 'features', keywords: ['feature flags', 'auto-approval', 'experiments', 'api access', 'monitoring'] },
];

export const GROUPS: SettingsGroup[] = ['personal', 'workspace', 'governance', 'system'];
export const SECTION_ICON_FALLBACK = Blocks;
export const sectionBySlug = (slug: string) => SECTIONS.find((s) => s.slug === slug);
