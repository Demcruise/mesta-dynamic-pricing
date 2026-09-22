import { create } from 'zustand';
import type { Role } from '../ontology';

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
  createdAt: string;
}

type NewNotification = Omit<Notification, 'id' | 'read' | 'createdAt'>;

interface NotificationState {
  items: Notification[];
  push: (n: NewNotification) => void;
  markRead: (id: string) => void;
  markAllRead: (role: Role) => void;
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
