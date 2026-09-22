import { create } from 'zustand';

/** Dev-only switches for demoing error states. */
interface DevState {
  failQueries: boolean;
  setFailQueries: (v: boolean) => void;
}

export const useDevStore = create<DevState>((set) => ({
  failQueries: false,
  setFailQueries: (failQueries) => set({ failQueries }),
}));
