'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, inputCls } from '@/components/ui/field';
import { activateStrategy, archiveStrategy, rejectStrategy, submitStrategy, unscheduleStrategy } from '@/lib/actions/strategy';
import type { Result } from '@/lib/actions/result';
import { CATEGORIES } from '@/lib/categories';
import { formatRelativeTime } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Strategy, StrategyStatus } from '@/lib/ontology';
import { useStrategies } from '@/lib/queries';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

const STATUS_ORDER: StrategyStatus[] = ['active', 'scheduled', 'pending_manager_approval', 'draft', 'archived'];
const CHIP: Record<StrategyStatus, string> = {
  active: 'bg-up-soft text-up',
  scheduled: 'bg-info-soft text-info',
  pending_manager_approval: 'bg-warn-soft text-warn',
  draft: 'bg-hold-soft text-hold',
  archived: 'bg-subtle text-faint',
};

export function StrategyListPage() {
  const { t, locale } = useTranslation();
  const q = useStrategies();
  const user = useSessionStore((s) => s.user);
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [objective, setObjective] = useState('');
  const [category, setCategory] = useState('');
  const [rejecting, setRejecting] = useState<Strategy | null>(null);
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState(false);
  const [scheduling, setScheduling] = useState<Strategy | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return q.data
      .filter((s) => (!needle || s.name.toLowerCase().includes(needle)) && (!status || s.status === status)
        && (!objective || s.objective === objective) && (!category || s.categories.includes(category)))
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
  }, [q.data, search, status, objective, category]);

  const run = (r: Result) => { if (!r.ok) toast(t(`strategy.err.${r.error}`)); };

  return (
    <>
      <PageHeader
        title={t('strategy.title')}
        subtitle={t('strategy.subtitle')}
        actions={
          <RoleGate action="strategy.create">
            <Link href="/strategy/new" className="inline-flex h-9 items-center rounded-input bg-brand px-3 text-sm font-medium text-brand-fg">
              {t('strategy.new')}
            </Link>
          </RoleGate>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2" role="search">
        <Input type="search" aria-label={t('strategy.search')} placeholder={t('strategy.search')} className="w-52" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label={t('strategy.status.all')} className={`${inputCls} w-52`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('strategy.status.all')}</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{t(`strategy.status.${s}`)}</option>)}
        </select>
        <select aria-label={t('strategy.objective.all')} className={`${inputCls} w-52`} value={objective} onChange={(e) => setObjective(e.target.value)}>
          <option value="">{t('strategy.objective.all')}</option>
          {(['maximize_margin', 'maximize_revenue', 'match_competitor', 'clear_inventory'] as const).map((o) => <option key={o} value={o}>{t(`strategy.objective.${o}`)}</option>)}
        </select>
        <select aria-label={t('strategy.list.category')} className={`${inputCls} w-44`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('strategy.list.category')}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {q.isLoading ? <LoadingRows rows={4} rowHeight={72} /> : q.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState variant={q.data.length ? 'filter' : 'empty'} title={q.data.length ? t('strategy.list.empty') : t('strategy.list.none')} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id} className="rounded-card border border-line bg-surface p-card shadow-e1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{s.name}</h2>
                  <p className="text-xs text-muted">{t(`strategy.objective.${s.objective}`)}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', CHIP[s.status])}>{t(`strategy.status.${s.status}`)}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-1 text-xs text-muted">
                <dt>{t('strategy.field.skus')}</dt>
                <dd className="text-fg">{t('strategy.list.scope', { skus: s.skuIds.length, cats: s.categories.length })}</dd>
                <dt>{t('strategy.step.guardrail')}</dt>
                <dd className="text-fg">
                  {t('strategy.list.guardrail', {
                    change: s.guardrail.maxChangePercent, threshold: s.guardrail.autoApproveThreshold,
                    map: s.guardrail.mapEnforced ? t('strategy.list.map') : '',
                  })}
                </dd>
                <dt>{t('strategy.list.owner')}</dt><dd className="text-fg">{s.ownerId}</dd>
                <dt>{t('strategy.list.updated')}</dt><dd className="text-fg">{formatRelativeTime(s.updatedAt, locale)}</dd>
                {s.status === 'scheduled' && s.activateAt && (
                  <>
                    <dt>{t('strategy.list.activatesAt')}</dt><dd className="text-fg">{formatRelativeTime(s.activateAt, locale)}</dd>
                  </>
                )}
                {s.ruleIds.length > 0 && (
                  <>
                    <dt>{t('strategy.list.boundRules')}</dt><dd className="text-fg">{s.ruleIds.join(', ')}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {can('strategy.create') && s.status === 'draft' && (
                  <>
                    <Link href={`/strategy/${s.id}/edit`} className="inline-flex h-7 items-center rounded-input border border-line px-2 text-sm">{t('strategy.action.edit')}</Link>
                    <Button size="sm" onClick={() => run(submitStrategy(user, s.id))}>{t('strategy.action.submit')}</Button>
                  </>
                )}
                {can('strategy.activate') && s.status === 'pending_manager_approval' && (
                  <>
                    <Button size="sm" onClick={() => run(activateStrategy(user, s.id))}>{t('strategy.action.approve')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setScheduling(s); setScheduleAt(''); }}>{t('strategy.action.schedule')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setRejecting(s); setNote(''); setNoteErr(false); }}>{t('strategy.action.reject')}</Button>
                  </>
                )}
                {can('strategy.activate') && s.status === 'scheduled' && (
                  <>
                    <Button size="sm" onClick={() => run(activateStrategy(user, s.id))}>{t('strategy.action.activateNow')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => run(unscheduleStrategy(user, s.id))}>{t('strategy.action.unschedule')}</Button>
                  </>
                )}
                {can('strategy.activate') && s.status === 'active' && (
                  <>
                    <Link href={`/strategy/${s.id}/edit`} className="inline-flex h-7 items-center rounded-input border border-line px-2 text-sm">{t('strategy.action.edit')}</Link>
                    <Button size="sm" variant="secondary" onClick={() => run(archiveStrategy(user, s.id))}>{t('strategy.action.archive')}</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={rejecting !== null} onClose={() => setRejecting(null)} title={t('strategy.action.confirmReject')}>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rejecting) return;
            const r = rejectStrategy(user, rejecting.id, note);
            if (r.ok) setRejecting(null);
            else if (r.error === 'note_required') setNoteErr(true);
            else run(r);
          }}
        >
          <Field label={t('strategy.action.rejectNote')} error={noteErr ? t('strategy.err.note_required') : undefined}>
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)}>{t('strategy.action.cancel')}</Button>
            <Button type="submit" variant="destructive">{t('strategy.action.reject')}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={scheduling !== null} onClose={() => setScheduling(null)} title={t('strategy.schedule.title')}>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!scheduling || !scheduleAt) return;
            const r = activateStrategy(user, scheduling.id, { at: new Date(scheduleAt).toISOString() });
            if (r.ok) setScheduling(null);
            else run(r);
          }}
        >
          <p className="text-sm text-muted">{t('strategy.schedule.desc', { name: scheduling?.name ?? '' })}</p>
          <Field label={t('strategy.schedule.at')}>
            {(p) => <Input {...p} type="datetime-local" required value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />}
          </Field>
          <p className="text-xs text-faint">{t('strategy.schedule.honest')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setScheduling(null)}>{t('strategy.action.cancel')}</Button>
            <Button type="submit" disabled={!scheduleAt}>{t('strategy.action.schedule')}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
