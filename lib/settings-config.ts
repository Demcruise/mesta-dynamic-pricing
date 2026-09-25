import type { Role } from '@/lib/ontology';

/*
 * Enterprise settings model (backlog v11 SET-001…046). One typed workspace configuration, split by
 * section so each section drafts, validates and saves independently. Personal preferences live in
 * the ui store (theme/language/density) plus `PersonalPrefs`; everything here is workspace-level
 * and editable only with `settings.manage`.
 */

export type EngineAction = 'block' | 'fallback' | 'flag' | 'warn';
export type Rounding = 'nearest' | 'up' | 'down';
export type SourceSystem = 'erp' | 'pos' | 'engine' | 'competitor' | 'model' | 'warehouse';
export type Channel = 'inapp' | 'email' | 'webhook' | 'slack';

export interface ApprovalTier { max: number | null; role: Role }
export interface RoutingRule { event: string; severity: 'critical' | 'warning' | 'info'; recipients: Role[]; channels: Channel[]; mandatory: boolean }
export interface Freshness { warn: number; block: number }

export interface WorkspaceConfig {
  general: { name: string; workspaceId: string; org: string; environment: 'production' | 'staging' | 'sandbox'; status: 'active' | 'suspended'; createdAt: string; owner: string; admin: string; support: string };
  scope: { buLabel: string; regionLabel: string; storeLabel: string; categoryLabel: string; source: SourceSystem; defaultRegion: string; defaultStore: string; defaultCategory: string; currency: string; inherit: boolean };
  pricing: {
    currency: string; precision: number; rounding: Rounding; increment: number; psychological: boolean;
    refreshMinutes: number; recFreshnessDays: number; simHorizonDays: number; demandModel: string; competitorFreshnessHours: number;
    behavior: Record<'missingCompetitor' | 'missingElasticity' | 'staleInventory' | 'stalePrice' | 'lowConfidence' | 'conflictingRules' | 'guardrailFailure', EngineAction>;
  };
  data: { freshness: Record<'catalog' | 'price' | 'inventory' | 'competitor' | 'demand', Freshness>; sourceOfTruth: Record<'sku' | 'cost' | 'inventory' | 'price' | 'competitor' | 'demand', SourceSystem>; conflict: 'source_of_truth' | 'most_recent' | 'flag' };
  approvals: { tiers: ApprovalTier[]; slaHours: number; expiryDays: number; autoApproveConfidence: number; requireJustification: boolean; escalateAfterHours: number; highImpactIdr: number; sod: { authorNotApprover: boolean; ruleAuthorNotPublisher: boolean; requesterNotApprover: boolean } };
  guardrails: { maxChangePct: number; floorPrice: number | null; ceilingPct: number; mapEnforced: boolean; approvalThresholdIdr: number; confidenceThreshold: number; staleData: EngineAction; changeFrequencyDays: number };
  workflow: {
    recTtlDays: number; staleHours: number; escalateHours: number; defaultQueue: 'decide' | 'all' | 'impact'; assignment: 'owner' | 'round_robin' | 'category'; sort: 'confidence' | 'impact' | 'age'; reviewMode: 'cards' | 'table';
    simScenarios: number; simHorizonDays: number; simBaseline: 'current' | 'competitor'; simShowConfidence: boolean;
    expDurationDays: number; expMinSample: number; expMaxDeltaPct: number; expRequireApproval: boolean; expConclusion: 'manager' | 'analyst';
  };
  alerts: { routing: RoutingRule[] };
  audit: { retentionDays: number; immutable: boolean; exportRoles: Role[]; format: 'json' | 'csv'; timezone: string; actorIdentity: 'sso' | 'local'; events: Record<string, boolean> };
  security: { sessionMinutes: number; reauthSensitive: boolean; sso: 'saml' | 'oidc' | 'off'; mfa: boolean; trustedDomains: string; loginPolicy: 'sso_only' | 'sso_or_password' };
  features: Record<'dynamicPricing' | 'automatedRecs' | 'autoApproval' | 'experiments' | 'competitorIntel' | 'monitoring' | 'apiAccess', boolean>;
}

export type SectionKey = keyof WorkspaceConfig;

export const AUDIT_EVENT_CLASSES = [
  'price_change', 'recommendation_generated', 'recommendation_approved', 'recommendation_rejected', 'strategy_changed',
  'rule_changed', 'guardrail_changed', 'override_requested', 'override_approved', 'configuration_changed', 'integration_changed', 'experiment_lifecycle',
] as const;

export const NOTIFICATION_EVENTS = [
  'decision_required', 'guardrail_breach', 'deployment_failure', 'data_quality', 'stale_recommendation', 'approval_escalation', 'experiment_complete', 'monitoring_anomaly',
] as const;

export const DEFAULT_CONFIG: WorkspaceConfig = {
  general: { name: 'Mesta Retail', workspaceId: 'MSTA-RET-001', org: 'Mesta Group', environment: 'production', status: 'active', createdAt: '2025-11-03T09:00:00+07:00', owner: 'Rina Analyst', admin: 'Budi Manager', support: 'pricing-ops@mesta.id' },
  scope: { buLabel: 'Business unit', regionLabel: 'Region', storeLabel: 'Store', categoryLabel: 'Category', source: 'erp', defaultRegion: '', defaultStore: '', defaultCategory: '', currency: 'IDR', inherit: true },
  pricing: {
    currency: 'IDR', precision: 0, rounding: 'nearest', increment: 100, psychological: false,
    refreshMinutes: 60, recFreshnessDays: 7, simHorizonDays: 28, demandModel: 'dm-2026.09', competitorFreshnessHours: 72,
    behavior: { missingCompetitor: 'fallback', missingElasticity: 'flag', staleInventory: 'warn', stalePrice: 'flag', lowConfidence: 'flag', conflictingRules: 'block', guardrailFailure: 'block' },
  },
  data: {
    freshness: { catalog: { warn: 24, block: 72 }, price: { warn: 24, block: 72 }, inventory: { warn: 6, block: 24 }, competitor: { warn: 48, block: 72 }, demand: { warn: 24, block: 96 } },
    sourceOfTruth: { sku: 'erp', cost: 'erp', inventory: 'erp', price: 'engine', competitor: 'competitor', demand: 'model' },
    conflict: 'source_of_truth',
  },
  approvals: {
    tiers: [{ max: 100_000, role: 'analyst' }, { max: 1_000_000, role: 'manager' }, { max: null, role: 'approver' }],
    slaHours: 24, expiryDays: 7, autoApproveConfidence: 90, requireJustification: true, escalateAfterHours: 48, highImpactIdr: 1_000_000,
    sod: { authorNotApprover: true, ruleAuthorNotPublisher: true, requesterNotApprover: true },
  },
  guardrails: { maxChangePct: 5, floorPrice: null, ceilingPct: 25, mapEnforced: true, approvalThresholdIdr: 100_000, confidenceThreshold: 70, staleData: 'flag', changeFrequencyDays: 7 },
  workflow: {
    recTtlDays: 7, staleHours: 24, escalateHours: 48, defaultQueue: 'decide', assignment: 'owner', sort: 'confidence', reviewMode: 'cards',
    simScenarios: 3, simHorizonDays: 28, simBaseline: 'current', simShowConfidence: true,
    expDurationDays: 14, expMinSample: 500, expMaxDeltaPct: 10, expRequireApproval: true, expConclusion: 'manager',
  },
  alerts: {
    routing: [
      { event: 'guardrail_breach', severity: 'critical', recipients: ['manager', 'compliance'], channels: ['inapp', 'email'], mandatory: true },
      { event: 'deployment_failure', severity: 'critical', recipients: ['ops_lead', 'manager'], channels: ['inapp', 'email', 'slack'], mandatory: true },
      { event: 'decision_required', severity: 'warning', recipients: ['analyst', 'manager'], channels: ['inapp'], mandatory: false },
      { event: 'data_quality', severity: 'warning', recipients: ['ops_lead'], channels: ['inapp', 'webhook'], mandatory: false },
      { event: 'approval_escalation', severity: 'warning', recipients: ['manager', 'approver'], channels: ['inapp', 'email'], mandatory: true },
      { event: 'monitoring_anomaly', severity: 'info', recipients: ['analyst'], channels: ['inapp'], mandatory: false },
    ],
  },
  audit: {
    retentionDays: 2555, immutable: true, exportRoles: ['manager', 'compliance'], format: 'json', timezone: 'Asia/Jakarta', actorIdentity: 'sso',
    events: Object.fromEntries(AUDIT_EVENT_CLASSES.map((e) => [e, true])),
  },
  security: { sessionMinutes: 30, reauthSensitive: true, sso: 'saml', mfa: true, trustedDomains: 'mesta.id', loginPolicy: 'sso_only' },
  features: { dynamicPricing: true, automatedRecs: true, autoApproval: false, experiments: true, competitorIntel: true, monitoring: true, apiAccess: true },
};

/** Feature dependencies (SET-030): a capability can only switch on when its prerequisites hold. */
export const FEATURE_DEPS: Partial<Record<keyof WorkspaceConfig['features'], ('approvalPolicy' | 'guardrails' | 'confidence' | 'dynamicPricing' | 'automatedRecs' | 'apiAccess')[]>> = {
  autoApproval: ['approvalPolicy', 'guardrails', 'confidence'],
  automatedRecs: ['dynamicPricing'],
  experiments: ['dynamicPricing'],
};

/**
 * SET-032: fields whose change needs an explicit impact confirmation. Keys are `section.path`;
 * any change under a listed prefix is sensitive.
 */
export const SENSITIVE: string[] = [
  'approvals.tiers', 'approvals.autoApproveConfidence', 'approvals.highImpactIdr', 'approvals.sod',
  'guardrails.maxChangePct', 'guardrails.mapEnforced', 'guardrails.approvalThresholdIdr', 'guardrails.confidenceThreshold', 'guardrails.floorPrice', 'guardrails.ceilingPct',
  'security', 'features.autoApproval', 'features.apiAccess', 'audit.retentionDays', 'audit.immutable', 'pricing.behavior.guardrailFailure',
];

export interface FieldChange { path: string; from: unknown; to: unknown; sensitive: boolean }

/** Flat diff of two section values (leaf-level), used for the change preview and the audit note. */
export function diffSection(section: SectionKey, before: unknown, after: unknown, prefix: string = section): FieldChange[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  // Objects and arrays both recurse, so a tier edit reads `approvals.tiers.0.max: 100000 → 150000`.
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  if (isObj(before) && isObj(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((k) => diffSection(section, before[k], after[k], `${prefix}.${k}`));
  }
  return [{ path: prefix, from: before, to: after, sensitive: SENSITIVE.some((s) => prefix === s || prefix.startsWith(`${s}.`)) }];
}

/** SET-038: contextual validation — messages name the rule, never "invalid value". */
export function validateSection(section: SectionKey, v: WorkspaceConfig[SectionKey]): Record<string, string> {
  const errs: Record<string, string> = {};
  if (section === 'approvals') {
    const a = v as WorkspaceConfig['approvals'];
    a.tiers.forEach((tier, i) => {
      const prev = a.tiers[i - 1]?.max;
      if (tier.max !== null && prev != null && tier.max <= prev) errs[`tiers.${i}`] = 'tierOrder';
      if (tier.max !== null && tier.max <= 0) errs[`tiers.${i}`] = 'positive';
    });
    if (a.autoApproveConfidence < 50 || a.autoApproveConfidence > 100) errs.autoApproveConfidence = 'confidenceRange';
    if (a.slaHours <= 0) errs.slaHours = 'positive';
  }
  if (section === 'data') {
    const d = v as WorkspaceConfig['data'];
    for (const [k, f] of Object.entries(d.freshness)) if (f.block <= f.warn) errs[`freshness.${k}`] = 'blockAfterWarn';
  }
  if (section === 'guardrails') {
    const g = v as WorkspaceConfig['guardrails'];
    if (g.maxChangePct <= 0 || g.maxChangePct > 50) errs.maxChangePct = 'changeRange';
    if (g.confidenceThreshold < 0 || g.confidenceThreshold > 100) errs.confidenceThreshold = 'confidenceRange';
    if (g.ceilingPct <= g.maxChangePct) errs.ceilingPct = 'ceilingAboveChange';
  }
  if (section === 'pricing') {
    const p = v as WorkspaceConfig['pricing'];
    if (p.increment <= 0) errs.increment = 'positive';
  }
  if (section === 'security') {
    const s = v as WorkspaceConfig['security'];
    if (s.sessionMinutes < 5 || s.sessionMinutes > 720) errs.sessionMinutes = 'sessionRange';
  }
  return errs;
}

/** SET-007: the rounding transformation, shown live next to the controls. */
export function applyRounding(price: number, rounding: Rounding, increment: number, psychological: boolean): number {
  const step = Math.max(1, increment);
  const fn = rounding === 'up' ? Math.ceil : rounding === 'down' ? Math.floor : Math.round;
  const rounded = fn(price / step) * step;
  // Psychological mode: charm price just under the next thousand (49,287 → 49,900).
  return psychological ? Math.ceil(rounded / 1000) * 1000 - 100 : rounded;
}
