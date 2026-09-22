import {
  Activity, BarChart3, FlaskConical, Inbox, LayoutDashboard, ListChecks, Package, Palette, ScrollText, Send, Settings, ShieldCheck, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { Action } from '@/lib/rbac';

export interface NavItem {
  href: string;
  key:
    | 'overview' | 'catalog' | 'strategy' | 'rules' | 'guardrails' | 'simulation' | 'recommendations' | 'approvals' | 'deployment' | 'monitoring' | 'audit'
    | 'designSystem' | 'settings';
  icon: LucideIcon;
  /** Absent = visible to every role (open routes). */
  action?: Action;
  mobile?: boolean;
  /** Live badge source rendered on the item (Sidebar + MobileNav). */
  badge?: 'pendingRecommendations' | 'failedDeployments';
}

export interface NavSection {
  key: 'workflow' | 'insight' | 'account';
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
    key: 'insight',
    items: [
      { href: '/monitoring', key: 'monitoring', icon: Activity, action: 'monitoring.view', mobile: true },
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
