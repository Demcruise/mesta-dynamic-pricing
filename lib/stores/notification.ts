import { create } from 'zustand';
import type { Role, UserSession } from '../ontology';
import { useAuditStore } from './audit';

export interface Notification {
  id: string;
  targetRole: Role | 'all';
  /** Same groupKey collapses into one row in digest views. */
  groupKey: string;
  /** i18n key under "common.notify.*"; params are interpolated at render time. Empty when `message` carries literal text. */
  messageKey: string;
  /** Literal already-translated text (used for toast-originated entries). */
  message?: string;
  params?: Record<string, string | number>;
  href?: string;
  read: boolean;
  /** AL-004: seen and owned — distinct from merely read. */
  acknowledged?: boolean;
  /** AL-004: hidden until this ISO time. */
  snoozedUntil?: string | null;
  /** AL-004: raised to the next role in the escalation path. */
  escalated?: boolean;
  createdAt: string;
}

type NewNotification = Omit<Notification, 'id' | 'read' | 'createdAt'>;

/** AL-004 escalation path — who a notification is raised to. */
const ESCALATION_ROLE: Record<Role, Role> = {
  analyst: 'manager', manager: 'approver', approver: 'manager', ops_lead: 'manager', compliance: 'manager',
};

interface NotificationState {
  items: Notification[];
  push: (n: NewNotification) => void;
  markRead: (id: string) => void;
  markAllRead: (role: Role) => void;
  acknowledge: (id: string) => void;
  snooze: (id: string, until: string) => void;
  /** Raises the notification to the next role and records an audit event. */
  escalate: (id: string, user: UserSession) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  push: (n) =>
    set((s) => ({
      items: [
        { ...n, id: `N-${s.items.length + 1}`, read: false, createdAt: new Date().toISOString() },
        ...s.items,
      ],
    })),
  markRead: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
  markAllRead: (role) =>
    set((s) => ({ items: s.items.map((i) => (i.targetRole === role || i.targetRole === 'all' ? { ...i, read: true } : i)) })),
  acknowledge: (id) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true, acknowledged: true } : i)) })),
  snooze: (id, until) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true, snoozedUntil: until } : i)) })),
  escalate: (id, user) =>
    set((s) => {
      const target = s.items.find((i) => i.id === id);
      if (!target) return s;
      const to = ESCALATION_ROLE[user.role];
      useAuditStore.getState().record({
        type: 'notification_escalate', actorId: user.userId, actorRole: user.role,
        entityType: 'notification', entityId: id, sku: target.params?.sku ? String(target.params.sku) : null,
        source: 'ui', note: `→ ${to}`,
      });
      return {
        items: [
          { ...target, id: `N-${s.items.length + 1}`, read: false, acknowledged: true, escalated: true, targetRole: to, createdAt: new Date().toISOString() },
          ...s.items.map((i) => (i.id === id ? { ...i, read: true, acknowledged: true, escalated: true } : i)),
        ],
      };
    }),
  reset: () => set({ items: [] }),
}));

/** Collapse notifications by groupKey with a count. */
export function groupNotifications(items: Notification[]) {
  const map = new Map<string, { groupKey: string; latest: Notification; count: number }>();
  for (const i of items) {
    const g = map.get(i.groupKey);
    if (g) g.count += 1;
    else map.set(i.groupKey, { groupKey: i.groupKey, latest: i, count: 1 });
  }
  return [...map.values()];
}
