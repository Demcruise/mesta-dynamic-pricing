import { create } from 'zustand';
import type { AuditEvent } from '../ontology';

interface AuditState {
  events: AuditEvent[];
  hydrate: (events: AuditEvent[]) => void;
  /** Append-only; ids and timestamps are assigned here. */
  record: (e: Omit<AuditEvent, 'id' | 'timestamp'>) => AuditEvent;
  reset: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  events: [],
  hydrate: (events) => set({ events }),
  record: (e) => {
    const event: AuditEvent = {
      ...e,
      id: `AUD-${Date.now().toString(36)}-${get().events.length}`,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ events: [event, ...s.events] }));
    return event;
  },
  reset: () => set({ events: [] }),
}));
