import type { Guardrail, Product, Strategy, StrategyObjective } from './ontology';

export interface StrategyDraft {
  name: string;
  objective: StrategyObjective;
  skuIds: string[];
  categories: string[];
  guardrail: Guardrail;
}

export type IssueCode =
  | 'name_required' | 'scope_required' | 'min_ge_max' | 'change_range' | 'threshold_range' | 'overlap';

export interface Issue {
  severity: 'blocker' | 'warning';
  code: IssueCode;
  /** For overlap: names of conflicting active strategies. */
  detail?: string;
}

export const emptyDraft = (skuIds: string[] = []): StrategyDraft => ({
  name: '',
  objective: 'maximize_margin',
  skuIds,
  categories: [],
  guardrail: { minPrice: null, maxPrice: null, mapEnforced: true, maxChangePercent: 5, autoApproveThreshold: 90 },
});

export const toDraft = (s: Strategy): StrategyDraft => ({
  name: s.name, objective: s.objective, skuIds: s.skuIds, categories: s.categories, guardrail: s.guardrail,
});

/** SKUs covered by a strategy: explicit SKUs plus everything in its categories. */
export function skusInScope(s: Pick<Strategy, 'skuIds' | 'categories'>, products: Product[]): Set<string> {
  const out = new Set(s.skuIds);
  if (s.categories.length) for (const p of products) if (s.categories.includes(p.category)) out.add(p.sku);
  return out;
}

export function validateDraft(
  draft: StrategyDraft,
  strategies: Strategy[],
  products: Product[],
  selfId: string | null,
): Issue[] {
  const issues: Issue[] = [];
  const g = draft.guardrail;
  if (!draft.name.trim()) issues.push({ severity: 'blocker', code: 'name_required' });
  if (draft.skuIds.length === 0 && draft.categories.length === 0) issues.push({ severity: 'blocker', code: 'scope_required' });
  if (g.minPrice !== null && g.maxPrice !== null && g.minPrice >= g.maxPrice) issues.push({ severity: 'blocker', code: 'min_ge_max' });
  if (!(g.maxChangePercent > 0 && g.maxChangePercent <= 100)) issues.push({ severity: 'blocker', code: 'change_range' });
  if (!(g.autoApproveThreshold >= 0 && g.autoApproveThreshold <= 100)) issues.push({ severity: 'blocker', code: 'threshold_range' });

  if (draft.skuIds.length || draft.categories.length) {
    const mine = skusInScope(draft, products);
    const clash = strategies.filter((s) => {
      if (s.id === selfId || s.status !== 'active') return false;
      for (const sku of skusInScope(s, products)) if (mine.has(sku)) return true;
      return false;
    });
    if (clash.length) issues.push({ severity: 'warning', code: 'overlap', detail: clash.map((s) => s.name).join(', ') });
  }
  return issues;
}

export const hasBlocker = (issues: Issue[]) => issues.some((i) => i.severity === 'blocker');
