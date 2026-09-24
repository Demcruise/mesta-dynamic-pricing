'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { saveRule, setRuleStatus } from '@/lib/actions/rule';
import { useTranslation } from '@/lib/i18n';
import type { Rule } from '@/lib/ontology';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { describeCondition, describeFormula, describeScope } from './rule-format';
import { pillCls } from '@/components/ds/Pill';

interface Props {
  /** The conflicting set — ruleIds tied on one SKU. Null closes the dialog. */
  conflict: { sku: string; ruleIds: string[] } | null;
  rules: Rule[];
  onEdit: (rule: Rule) => void;
  onClose: () => void;
}

/**
 * RULE-003 resolution surface: compares the tied rules side by side and offers the
 * honest exits — differentiate priority, pause a rule, or edit its scope.
 */
export function ConflictDialog({ conflict, rules, onEdit, onClose }: Props) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [busy, setBusy] = useState<string | null>(null);
  const tied = conflict ? conflict.ruleIds.map((id) => rules.find((r) => r.id === id)).filter((r): r is Rule => !!r) : [];
  const tiePriority = tied[0]?.priority ?? 0;

  const prioritize = (r: Rule) => {
    setBusy(r.id);
    const res = saveRule(user, { ...r, priority: Math.max(1, tiePriority - 1) }, { expectedUpdatedAt: r.updatedAt });
    setBusy(null);
    toast(t(res.ok ? 'rules.conflict.resolved' : `rules.err.${res.error}`));
  };
  const pause = (r: Rule) => {
    setBusy(r.id);
    const res = setRuleStatus(user, r.id, 'paused');
    setBusy(null);
    toast(t(res.ok ? 'rules.conflict.resolved' : `rules.err.${res.error}`));
  };

  return (
    <Dialog open={conflict !== null} onClose={onClose} title={t('rules.conflict.dialogTitle', { sku: conflict?.sku ?? '' })} className="max-w-3xl">
      <p className="mb-3 text-xs text-muted">{t('rules.conflict.howTo')}</p>
      <div className={`grid grid-cols-1 gap-3 ${tied.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {tied.map((r) => (
          <section key={r.id} className="rounded-card border border-line bg-subtle p-3" aria-label={r.name}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{r.name}</h3>
                <p className="text-xs text-muted">{r.id} · {t('rules.table.priority')} <b className="text-warn">{r.priority}</b></p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex gap-2">
                <dt className="w-14 shrink-0 font-medium uppercase tracking-wide text-faint">{t('rules.table.when')}</dt>
                <dd className="min-w-0 flex-1">
                  <ul className="flex flex-wrap gap-1">
                    {r.when.map((c, i) => <li key={i} className={pillCls('neutral', 'sm')}>{describeCondition(c, t)}</li>)}
                  </ul>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-14 shrink-0 font-medium uppercase tracking-wide text-faint">{t('rules.table.then')}</dt>
                <dd>{describeFormula(r.then, t)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-14 shrink-0 font-medium uppercase tracking-wide text-faint">{t('rules.table.scope')}</dt>
                <dd>{describeScope(r, t)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
              <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => prioritize(r)}>
                {t('rules.conflict.prioritize')}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => pause(r)}>
                {t('rules.actions.pause')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { onClose(); onEdit(r); }}>
                {t('rules.actions.edit')}
              </Button>
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
