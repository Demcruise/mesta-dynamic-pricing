'use client';

import { Plus, Play, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { runRules, setRuleStatus, type RunSummary } from '@/lib/actions/rule';
import { formatRelativeTime } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Rule, RuleStatus } from '@/lib/ontology';
import { useRules, useSkuList, useStrategies } from '@/lib/queries';
import { findConflicts, inRuleScope, ruleApplies, evalCondition } from '@/lib/rules';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { RuleBuilderDialog } from './RuleBuilderDialog';
import { ConflictDialog } from './ConflictDialog';
import { describeCondition, describeFormula, describeScope } from './rule-format';

const ORDER: Record<RuleStatus, number> = { active: 0, draft: 1, paused: 2 };

export function RulesPage() {
  const { t, locale } = useTranslation();
  const rules = useRules();
  const products = useSkuList();
  const strategies = useStrategies();
  const user = useSessionStore((s) => s.user);
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const [builder, setBuilder] = useState<{ open: boolean; rule: Rule | null }>({ open: false, rule: null });
  const [conflictPair, setConflictPair] = useState<{ ruleIds: string[]; skus: string[] } | null>(null);

  const now = Date.now();
  const matchCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rules.data) {
      map.set(r.id, products.data.filter((p) => inRuleScope(r, p) && ruleApplies(r, p, strategies.data, products.data)
        && r.when.every((c) => evalCondition(c, p, now))).length);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules.data, products.data, strategies.data]);

  // Reverse lookup: which strategies bind each rule — shown as the "bound to" line on the card.
  const boundTo = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of strategies.data) for (const rid of s.ruleIds) map.set(rid, [...(map.get(rid) ?? []), s.name]);
    return map;
  }, [strategies.data]);

  const conflicts = useMemo(
    () => findConflicts(rules.data.filter((r) => r.status === 'active'), strategies.data, products.data, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules.data, products.data, strategies.data],
  );

  // The same rule pair can tie on many SKUs — group into one resolution target per pair.
  const conflictPairs = useMemo(() => {
    const map = new Map<string, { ruleIds: string[]; skus: string[] }>();
    for (const c of conflicts) {
      const key = [...c.ruleIds].sort().join('|');
      const entry = map.get(key) ?? { ruleIds: c.ruleIds, skus: [] };
      entry.skus.push(c.sku);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [conflicts]);

  // J-03 footer impact: how many SKUs each rule collides on.
  const conflictByRule = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of conflicts) for (const rid of c.ruleIds) m.set(rid, (m.get(rid) ?? 0) + 1);
    return m;
  }, [conflicts]);

  const run = () => {
    const r = runRules(user);
    if (!r.ok) { toast(t(`rules.err.${r.error}`)); return; }
    const s = r.summary as RunSummary;
    const parts = [s.created > 0 ? t('rules.run.done', { n: s.created }) : t('rules.run.none')];
    if (s.skipped.guardrail) parts.push(t('rules.run.skipped', { n: s.skipped.guardrail }));
    if (s.skipped.conflict) parts.push(t('rules.run.conflict', { n: s.skipped.conflict }));
    toast(parts.join(' · '));
  };

  const rows = useMemo(
    () => [...rules.data].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.priority - b.priority || a.id.localeCompare(b.id)),
    [rules.data],
  );

  return (
    <>
      <PageHeader
        title={t('rules.page.title')}
        subtitle={t('rules.page.desc')}
        actions={
          <div className="flex gap-2">
            <RoleGate action="rule.run">
              <Button variant="secondary" onClick={run}><Play className="size-4" aria-hidden /> {t('rules.run.cta')}</Button>
            </RoleGate>
            <RoleGate action="rule.manage">
              <Button onClick={() => setBuilder({ open: true, rule: null })}><Plus className="size-4" aria-hidden /> {t('rules.builder.new')}</Button>
            </RoleGate>
          </div>
        }
      />

      {conflicts.length > 0 && (
        <div role="alert" className="mb-4 rounded-card border border-warn bg-warn-soft p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-warn">
            <TriangleAlert className="size-4" aria-hidden /> {t('rules.conflict.title')}
          </p>
          <p className="mt-0.5 text-xs text-warn">{t('rules.conflict.desc')}</p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-warn">
            {conflictPairs.slice(0, 5).map((c) => (
              <li key={c.ruleIds.join('|')}>
                <button
                  type="button"
                  className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  onClick={() => setConflictPair(c)}
                >
                  {t('rules.conflict.pairRow', { a: c.ruleIds[0] ?? '', b: c.ruleIds.slice(1).join(', '), n: c.skus.length })}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rules.isLoading ? <LoadingRows rows={3} rowHeight={96} /> : rules.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={rules.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="empty"
          title={t('rules.empty')}
          {...(can('rule.manage') ? { action: { label: t('rules.builder.new'), onClick: () => setBuilder({ open: true, rule: null }) } } : {})}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-card shadow-e1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{r.name}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    {r.id}
                    {/* J-02: priority is a first-class badge — it decides conflict precedence. */}
                    <span className="rounded-full bg-subtle px-1.5 py-px text-[11px] font-semibold tabular text-muted" title={t('rules.table.priority')}>
                      P{r.priority}
                    </span>
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 font-medium uppercase tracking-wide text-faint">{t('rules.table.when')}</dt>
                  <dd className="min-w-0 flex-1">
                    <ul className="flex flex-wrap items-center gap-1">
                      {r.when.map((c, i) => (
                        <li key={i} className="flex items-center gap-1">
                          {/* J-01: conditions are ANDed — make the connector visible, not implicit. */}
                          {i > 0 && <span aria-hidden className="text-[10px] font-semibold uppercase tracking-wide text-faint">{t('rules.table.and')}</span>}
                          <span className="rounded-full bg-subtle px-2 py-0.5 text-fg">{describeCondition(c, t)}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 font-medium uppercase tracking-wide text-faint">{t('rules.table.then')}</dt>
                  <dd className="text-fg">{describeFormula(r.then, t)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 font-medium uppercase tracking-wide text-faint">{t('rules.table.scope')}</dt>
                  <dd className="text-fg">{describeScope(r, t)}</dd>
                </div>
                {(boundTo.get(r.id)?.length ?? 0) > 0 && (
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 font-medium uppercase tracking-wide text-faint">{t('rules.table.bound')}</dt>
                    <dd className="text-fg">{boundTo.get(r.id)!.join(', ')}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                <p className="text-xs text-muted">
                  {t('rules.table.matches', { n: matchCount.get(r.id) ?? 0, total: products.data.length })} · {formatRelativeTime(r.updatedAt, locale)}
                  {(conflictByRule.get(r.id) ?? 0) > 0 && (
                    <span className="text-warn"> · {t('rules.table.conflicts', { n: conflictByRule.get(r.id)! })}</span>
                  )}
                </p>
                {can('rule.manage') && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setBuilder({ open: true, rule: r })}>{t('rules.actions.edit')}</Button>
                    {r.status !== 'active' ? (
                      <Button size="sm" variant="secondary" onClick={() => setRuleStatus(user, r.id, 'active')}>{t('rules.actions.activate')}</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setRuleStatus(user, r.id, 'paused')}>{t('rules.actions.pause')}</Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-faint">{t('rules.note')}</p>

      <RuleBuilderDialog
        open={builder.open}
        rule={builder.rule}
        onClose={() => setBuilder({ open: false, rule: null })}
      />
      <ConflictDialog
        conflict={conflictPair ? { sku: conflictPair.skus.join(', '), ruleIds: conflictPair.ruleIds } : null}
        rules={rules.data}
        onEdit={(rule) => setBuilder({ open: true, rule })}
        onClose={() => setConflictPair(null)}
      />
    </>
  );
}
