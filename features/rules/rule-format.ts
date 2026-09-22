import type { Rule, RuleCondition, RuleFormula } from '@/lib/ontology';

type T = (key: string, vars?: Record<string, string | number>) => string;

export function describeCondition(c: RuleCondition, t: T): string {
  return `${t(`rules.when.field.${c.field}`)} ${t(`rules.when.op.${c.op}`)} ${c.value}`;
}

export function describeFormula(f: RuleFormula, t: T): string {
  const name = t(`rules.then.kind.${f.kind}`);
  return f.kind === 'match_competitor' ? `${name} ${f.value >= 0 ? '+' : '−'}${Math.abs(f.value)}%` : `${name} ${f.value}%`;
}

export function describeScope(rule: Rule, t: T): string {
  const parts: string[] = [];
  if (rule.scope.categories.length) parts.push(t('rules.scope.categories', { v: rule.scope.categories.join(', ') }));
  if (rule.scope.regions.length) parts.push(t('rules.scope.regions', { v: rule.scope.regions.join(', ') }));
  if (rule.scope.skus.length) parts.push(t('rules.scope.skus', { v: rule.scope.skus.join(', ') }));
  return parts.length ? parts.join(' · ') : t('rules.scope.all');
}
