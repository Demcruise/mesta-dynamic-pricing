import type { Role } from './ontology';

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
  'recommendation.view': ['analyst', 'manager', 'compliance'],
  'recommendation.decide': ['analyst', 'manager'],
  'recommendation.bulk_approve': ['manager'],
  'deployment.view': ['manager', 'ops_lead'],
  'deployment.execute': ['ops_lead'],
  'deployment.export': ['manager', 'ops_lead'],
  'monitoring.view': ['analyst', 'manager', 'ops_lead', 'compliance'],
  'monitoring.flag_model': ['analyst', 'manager'],
  'audit.view': ['analyst', 'manager', 'ops_lead', 'compliance'],
  'audit.view_all': ['manager', 'compliance'],
  'audit.export': ['manager', 'compliance'],
  'overview.view': ['analyst', 'manager', 'ops_lead', 'compliance'],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof PERMISSIONS;

export function can(role: Role, action: Action): boolean {
  return (PERMISSIONS[action] as readonly Role[]).includes(role);
}

export const ROLES: Role[] = ['analyst', 'manager', 'ops_lead', 'compliance'];

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
};

export function actionForPath(pathname: string): Action | null {
  if (/^\/strategy\/(new|[^/]+\/edit)(\/|$)/.test(pathname)) return 'strategy.create';
  const hit = Object.keys(ROUTE_ACTIONS).find((p) => pathname === p || pathname.startsWith(p + '/'));
  return hit ? (ROUTE_ACTIONS[hit] as Action) : null;
}
