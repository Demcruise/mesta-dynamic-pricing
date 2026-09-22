import { create } from 'zustand';
import type { CompetitorObservation, PriceEvent, Product } from '../ontology';

interface CatalogState {
  products: Product[];
  competitors: CompetitorObservation[];
  priceEvents: PriceEvent[];
  hydrated: boolean;
  /** Replaces (never appends) so calling twice is idempotent. */
  hydrate: (products: Product[], competitors: CompetitorObservation[], priceEvents?: PriceEvent[]) => void;
  /** Applies a new price; returns false if outside min/max guardrail. */
  applyPrice: (sku: string, price: number, source: PriceEvent['source'], recommendationId?: string | null) => boolean;
  reset: () => void;
}

export const useProductCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  competitors: [],
  priceEvents: [],
  hydrated: false,
  hydrate: (products, competitors, priceEvents = []) => set({ products, competitors, priceEvents, hydrated: true }),
  applyPrice: (sku, price, source, recommendationId = null) => {
    const p = get().products.find((x) => x.sku === sku);
    if (!p || price < p.minPrice || price > p.maxPrice) return false;
    const at = new Date().toISOString();
    set((s) => ({
      products: s.products.map((x) =>
        x.sku === sku
          ? { ...x, price, lastChangeAt: at, priceHistory: [...x.priceHistory, { at, price }] }
          : x,
      ),
      priceEvents: [
        ...s.priceEvents,
        { id: `PE-${Date.now().toString(36)}-${s.priceEvents.length + 1}`, sku, oldPrice: p.price, newPrice: price, recommendationId, source, at },
      ],
    }));
    return true;
  },
  reset: () => set({ products: [], competitors: [], priceEvents: [], hydrated: false }),
}));
