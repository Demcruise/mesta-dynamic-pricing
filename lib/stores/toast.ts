import { create } from 'zustand';
import { useNotificationStore } from './notification';
import { useSessionStore } from './session';

export interface Toast { id: number; message: string; href?: string }

const MAX_VISIBLE = 3;
const TTL_MS = 5000;

interface ToastState {
  /** At most MAX_VISIBLE rendered at once. */
  toasts: Toast[];
  /** Overflow waiting for a visible slot. */
  queued: Toast[];
  push: (message: string, opts?: { href?: string }) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => {
  // A toast's lifetime starts when it becomes visible, not when it was pushed.
  const arm = (id: number) => timers.set(id, setTimeout(() => get().dismiss(id), TTL_MS));

  return {
    toasts: [],
    queued: [],
    push: (message, opts) => {
      const toast: Toast = { id: ++seq, message, ...(opts?.href ? { href: opts.href } : {}) };
      if (get().toasts.length < MAX_VISIBLE) {
        set((s) => ({ toasts: [...s.toasts, toast] }));
        arm(toast.id);
      } else {
        set((s) => ({ queued: [...s.queued, toast] }));
      }
      // Toasts are ephemeral; mirror each into the notification centre so nothing vanishes trace-free.
      useNotificationStore.getState().push({
        targetRole: useSessionStore.getState().user.role,
        groupKey: `toast:${message}`,
        messageKey: '',
        message,
        ...(opts?.href ? { href: opts.href } : {}),
      });
    },
    dismiss: (id) => {
      const s = get();
      const timer = timers.get(id);
      if (timer) { clearTimeout(timer); timers.delete(id); }
      if (!s.toasts.some((t) => t.id === id)) {
        if (s.queued.some((t) => t.id === id)) set({ queued: s.queued.filter((t) => t.id !== id) });
        return;
      }
      const [next, ...rest] = s.queued;
      set({ toasts: [...s.toasts.filter((t) => t.id !== id), ...(next ? [next] : [])], queued: rest });
      if (next) arm(next.id);
    },
  };
});
