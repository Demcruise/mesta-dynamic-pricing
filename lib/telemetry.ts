import { create } from 'zustand';

export interface TelemetryEvent {
  name: string;
  props: Record<string, string | number | boolean | null>;
  at: string;
}

/** Frontend-only telemetry stub: keeps the last events in memory for inspection/tests. */
export const useTelemetryStore = create<{ events: TelemetryEvent[] }>(() => ({ events: [] }));

export function track(name: string, props: TelemetryEvent['props'] = {}) {
  const e = { name, props, at: new Date().toISOString() };
  useTelemetryStore.setState((s) => ({ events: [...s.events.slice(-199), e] }));
  if (process.env.NODE_ENV === 'development') console.debug('[telemetry]', name, props);
}
