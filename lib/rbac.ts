import type { Role } from './ontology';
import { usePolicyStore } from './stores/policy';

/** Single source of truth for permissions. Add every new action here. */
export const PERMISSIONS = {
  'catalog.view': ['analyst', 'manager', 'ops_lead', 'compliance'],
  'catalog.override_price': ['analyst', 'manager'],
  'catalog.apply_strategy': ['analyst', 'manager'],
  'catalog.export': ['analyst', 'manager'],
  'rule.view': ['analyst', 'manager', 'compliance'],
  'guardrail.view': ['analyst', 'manager', 'ops_lead', 'compliance'],
  'rule.manage': ['analyst', 'manager'],
  'rule.run': ['analyst', 'manager'],
  'strategy.view': ['analyst', 'manager', 'compliance'],
  'strategy.create': ['analyst', 'manager'],
  'strategy.activate': ['manager'],
  'simulation.use': ['analyst', 'manager'],
  'recommendation.view': ['analyst', 'manager', 'approver', 'compliance'],
  'recommendation.decide': ['analyst', 'manager', 'approver'],
  'recommendation.bulk_approve': ['manager'],
  'deployment.view': ['manager', 'ops_lead'],
  'deployment.execute': ['ops_lead'],
  'deployment.export': ['manager', 'ops_lead'],
  'monitoring.view': ['analyst', 'manager', 'approver', 'ops_lead', 'compliance'],
  'monitoring.flag_model': ['analyst', 'manager'],
  'audit.view': ['analyst', 'manager', 'approver', 'ops_lead', 'compliance'],
  'audit.view_all': ['manager', 'approver', 'compliance'],
  'audit.export': ['manager', 'compliance'],
  'overview.view': ['analyst', 'manager', 'approver', 'ops_lead', 'compliance'],
  'data.view': ['manager', 'ops_lead', 'compliance'],
  'data.sync': ['ops_lead'],
  'exceptions.view': ['analyst', 'manager', 'approver', 'ops_lead', 'compliance'],
  'override.request': ['analyst', 'manager'],
  'override.decide': ['manager'],
  'alerts.view': ['analyst', 'manager', 'approver', 'ops_lead', 'compliance'],
  'competitors.view': ['analyst', 'manager', 'approver', 'compliance'],
  'signals.view': ['analyst', 'manager', 'approver', 'compliance'],
  'analytics.view': ['analyst', 'manager', 'approver', 'compliance'],
  'experiment.view': ['analyst', 'manager', 'compliance'],
  'experiment.manage': ['analyst', 'manager'],
  'approval.delegate': ['manager'],
  'policy.manage': ['manager'],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof PERMISSIONS;

/**
 * Actions the settings policy editor will not override — overriding 'policy.manage'
 * itself could lock every role out of policy administration. Rendered as a locked row.
 */
export const POLICY_LOCKED: ReadonlySet<Action> = new Set(['policy.manage']);

export function can(role: Role, action: Action): boolean {
  const override = usePolicyStore.getState().overrides[`${role}:${action}`];
  if (override !== undefined && !POLICY_LOCKED.has(action)) return override;
  return (PERMISSIONS[action] as readonly Role[]).includes(role);
}

export const ROLES: Role[] = ['analyst', 'manager', 'approver', 'ops_lead', 'compliance'];

/** Route prefix → action required to enter. */
export const ROUTE_ACTIONS: Record<string, Action> = {
  '/overview': 'overview.view',
  '/catalog': 'catalog.view',
  '/strategy': 'strategy.view',
  '/rules': 'rule.view',
  '/guardrails': 'guardrail.view',
  '/simulation': 'simulation.use',
  '/recommendations': 'recommendation.view',
  '/approvals': 'recommendation.decide',
  '/deployment': 'deployment.view',
  '/monitoring': 'monitoring.view',
  '/audit': 'audit.view',
  '/data': 'data.view',
  '/exceptions': 'exceptions.view',
  '/alerts': 'alerts.view',
  '/competitors': 'competitors.view',
  '/signals': 'signals.view',
  '/analytics': 'analytics.view',
  '/experiments': 'experiment.view',
};

export function actionForPath(pathname: string): Action | null {
  if (/^\/strategy\/(new|[^/]+\/edit)(\/|$)/.test(pathname)) return 'strategy.create';
  const hit = Object.keys(ROUTE_ACTIONS).find((p) => pathname === p || pathname.startsWith(p + '/'));
  return hit ? (ROUTE_ACTIONS[hit] as Action) : null;
}
