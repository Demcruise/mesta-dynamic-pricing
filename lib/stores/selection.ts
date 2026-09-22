import { create } from 'zustand';

interface SelectionState {
  skuIds: string[];
  toggle: (sku: string) => void;
  setMany: (skus: string[]) => void;
  addMany: (skus: string[]) => void;
  clear: () => void;
}

export const useCatalogSelectionStore = create<SelectionState>((set) => ({
  skuIds: [],
  toggle: (sku) =>
    set((s) => ({ skuIds: s.skuIds.includes(sku) ? s.skuIds.filter((x) => x !== sku) : [...s.skuIds, sku] })),
  setMany: (skuIds) => set({ skuIds: [...new Set(skuIds)] }),
  addMany: (skus) => set((s) => ({ skuIds: [...new Set([...s.skuIds, ...skus])] })),
  clear: () => set({ skuIds: [] }),
}));
