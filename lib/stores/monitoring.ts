import { create } from 'zustand';
import type { AnomalyAlert, Outcome } from '../ontology';

interface MonitoringState {
  anomalies: AnomalyAlert[];
  outcomes: Outcome[];
  /** Deviation threshold in percent; anomalies below it are hidden. Local-only setting. */
  threshold: number;
  hydrate: (anomalies: AnomalyAlert[], outcomes: Outcome[]) => void;
  addOutcome: (o: Outcome) => void;
  flag: (id: string) => boolean;
  setThreshold: (v: number) => void;
  reset: () => void;
}

export const DEFAULT_THRESHOLD = 15;

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  anomalies: [],
  outcomes: [],
  threshold: DEFAULT_THRESHOLD,
  hydrate: (anomalies, outcomes) => set({ anomalies, outcomes, threshold: DEFAULT_THRESHOLD }),
  addOutcome: (o) => set((s) => ({ outcomes: [...s.outcomes, o] })),
  flag: (id) => {
    const a = get().anomalies.find((x) => x.id === id);
    if (!a || a.flaggedForReview) return false;
    set((s) => ({ anomalies: s.anomalies.map((x) => (x.id === id ? { ...x, flaggedForReview: true } : x)) }));
    return true;
  },
  setThreshold: (threshold) => set({ threshold }),
  reset: () => set({ anomalies: [], outcomes: [], threshold: DEFAULT_THRESHOLD }),
}));
