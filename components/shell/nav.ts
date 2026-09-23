import {
  Activity, BarChart3, Beaker, BellRing, Database, FlaskConical, Inbox, LayoutDashboard, ListChecks, Package, Palette,
  Radio, Scale, ScrollText, Send, Settings, ShieldCheck, Siren, Sparkles, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { Action } from '@/lib/rbac';

export interface NavItem {
  href: string;
  key:
    | 'overview' | 'catalog' | 'strategy' | 'rules' | 'guardrails' | 'simulation' | 'recommendations' | 'approvals' | 'deployment' | 'monitoring' | 'audit'
    | 'exceptions' | 'alerts' | 'data' | 'competitors' | 'signals' | 'analytics' | 'experiments'
    | 'designSystem' | 'settings';
  icon: LucideIcon;
  /** Absent = visible to every role (open routes). */
  action?: Action;
  mobile?: boolean;
  /** Live badge source rendered on the item (Sidebar + MobileNav). */
  badge?: 'pendingRecommendations' | 'failedDeployments';
}

export interface NavSection {
  key: 'workflow' | 'operations' | 'insight' | 'account';
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'workflow',
    items: [
      { href: '/catalog', key: 'catalog', icon: Package, action: 'catalog.view' },
      { href: '/strategy', key: 'strategy', icon: BarChart3, action: 'strategy.view' },
      { href: '/rules', key: 'rules', icon: ListChecks, action: 'rule.view' },
      { href: '/guardrails', key: 'guardrails', icon: ShieldCheck, action: 'guardrail.view' },
      { href: '/simulation', key: 'simulation', icon: FlaskConical, action: 'simulation.use' },
      { href: '/recommendations', key: 'recommendations', icon: Sparkles, action: 'recommendation.view', badge: 'pendingRecommendations' },
      { href: '/approvals', key: 'approvals', icon: Inbox, action: 'recommendation.decide' },
      { href: '/deployment', key: 'deployment', icon: Send, action: 'deployment.view', mobile: true, badge: 'failedDeployments' },
    ],
  },
  {
    key: 'operations',
    items: [
      { href: '/exceptions', key: 'exceptions', icon: Siren, action: 'exceptions.view' },
      { href: '/alerts', key: 'alerts', icon: BellRing, action: 'alerts.view' },
      { href: '/data', key: 'data', icon: Database, action: 'data.view' },
    ],
  },
  {
    key: 'insight',
    items: [
      { href: '/monitoring', key: 'monitoring', icon: Activity, action: 'monitoring.view', mobile: true },
      { href: '/competitors', key: 'competitors', icon: Scale, action: 'competitors.view' },
      { href: '/signals', key: 'signals', icon: Radio, action: 'signals.view' },
      { href: '/analytics', key: 'analytics', icon: TrendingUp, action: 'analytics.view' },
      { href: '/experiments', key: 'experiments', icon: Beaker, action: 'experiment.view' },
      { href: '/audit', key: 'audit', icon: ScrollText, action: 'audit.view' },
      { href: '/overview', key: 'overview', icon: LayoutDashboard, action: 'overview.view', mobile: true },
    ],
  },
  {
    key: 'account',
    items: [
      { href: '/design-system', key: 'designSystem', icon: Palette },
      { href: '/settings', key: 'settings', icon: Settings },
    ],
  },
];

/** Flat list kept for consumers that don't need grouping (CommandMenu, MobileNav). */
export const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}
