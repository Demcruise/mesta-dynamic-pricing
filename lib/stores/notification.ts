import { create } from 'zustand';
import type { Role } from '../ontology';

export interface Notification {
  id: string;
  targetRole: Role | 'all';
  /** Same groupKey collapses into one row in digest views. */
  groupKey: string;
  message: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: Notification[];
  push: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
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
