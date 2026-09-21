import { create } from 'zustand';

export interface Toast { id: number; message: string }

interface ToastState {
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
