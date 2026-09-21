import {
  Activity, BarChart3, FlaskConical, LayoutDashboard, Package, ScrollText, Send, Sparkles, type LucideIcon,
} from 'lucide-react';
import type { Action } from '@/lib/rbac';

export interface NavItem {
  href: string;
  key: 'overview' | 'catalog' | 'strategy' | 'simulation' | 'recommendations' | 'deployment' | 'monitoring' | 'audit';
  icon: LucideIcon;
  action: Action;
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/overview', key: 'overview', icon: LayoutDashboard, action: 'overview.view', mobile: true },
  { href: '/catalog', key: 'catalog', icon: Package, action: 'catalog.view' },
  { href: '/strategy', key: 'strategy', icon: BarChart3, action: 'strategy.view' },
  { href: '/simulation', key: 'simulation', icon: FlaskConical, action: 'simulation.use' },
  { href: '/recommendations', key: 'recommendations', icon: Sparkles, action: 'recommendation.view' },
  { href: '/deployment', key: 'deployment', icon: Send, action: 'deployment.view', mobile: true },
  { href: '/monitoring', key: 'monitoring', icon: Activity, action: 'monitoring.view', mobile: true },
  { href: '/audit', key: 'audit', icon: ScrollText, action: 'audit.view' },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}
