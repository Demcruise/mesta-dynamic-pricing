'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { activateStrategy, archiveStrategy, rejectStrategy, submitStrategy, unscheduleStrategy } from '@/lib/actions/strategy';
import type { Result } from '@/lib/actions/result';
import { formatDate, formatPrice, formatRelativeTime } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useRules, useScopedRecommendations, useStrategies } from '@/lib/queries';
import { useSessionStore, useToastStore } from '@/lib/stores';

/**
 * I-03 strategy detail: the read surface between list and wizard edit.
 * Objective/scope/guardrails/bound rules/affected recommendations + a pinned
 * action bar carrying the same lifecycle actions as the list card.
 */
export function StrategyDetailPage({ strategyId }: { strategyId: string }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const strategies = useStrategies();
  const rules = useRules();
  const recs = useScopedRecommendations();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  const s = strategies.data.find((x) => x.id === strategyId);
  const affected = useMemo(
    () => (s ? recs.data.filter((r) => r.strategyId === s.id) : []),
    [s, recs.data],
  );
  const boundRules = useMemo(
    () => (s ? rules.data.filter((r) => s.ruleIds.includes(r.id)) : []),
    [s, rules.data],
  );

  const run = (r: Result) => { if (!r.ok) toast(t(`strategy.err.${r.error}`)); };

  if (strategies.isLoading || recs.isLoading) return <LoadingRows rows={4} rowHeight={80} />;
  if (strategies.isError) return <ErrorState title={t('common.state.error')} onRetry={strategies.refetch} />;
  if (!s) return <EmptyState title={t('strategy.detail.notFound')} action={{ label: t('strategy.detail.back'), onClick: () => router.push('/strategy') }} />;

  const decided = affected.filter((r) => r.status === 'approved' || r.status === 'adjusted' || r.status === 'rejected');
  const acceptance = decided.length ? decided.filter((r) => r.status !== 'rejected').length / decided.length : null;
  const pipeline = affected.filter((r) => r.status === 'pending' || r.status === 'escalated').length;
  const projected = affected.reduce((n, r) => n + r.projectedMarginImpact, 0);

  return (
    <>
      <Link href="/strategy" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors duration-fast hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />{t('strategy.detail.back')}
      </Link>
      <PageHeader
        title={s.name}
        subtitle={`${s.id} · ${t(`strategy.objective.${s.objective}`)}`}
        actions={<StatusBadge status={s.status} label={t(`strategy.status.${s.status}`)} />}
      />

      <div className="grid max-w-3xl grid-cols-1 gap-4 pb-16">
        <section className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 className="mb-2 text-sm font-semibold">{t('strategy.detail.scopeTitle')}</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">{t('strategy.field.skus')}</dt>
            <dd className="tabular">{t('strategy.list.scope', { skus: s.skuIds.length, cats: s.categories.length })}</dd>
            {s.categories.length > 0 && (
              <>
                <dt className="text-muted">{t('strategy.detail.categories')}</dt>
                <dd>{s.categories.join(', ')}</dd>
              </>
            )}
            {s.skuIds.length > 0 && s.skuIds.length <= 8 && (
              <>
                <dt className="text-muted">{t('strategy.detail.skuList')}</dt>
                <dd className="tabular">{s.skuIds.join(', ')}</dd>
              </>
            )}
            <dt className="text-muted">{t('strategy.list.owner')}</dt>
            <dd>{s.ownerId}</dd>
            <dt className="text-muted">{t('strategy.list.updated')}</dt>
            <dd>{formatRelativeTime(s.updatedAt, locale)}</dd>
            {s.status === 'scheduled' && s.activateAt && (
              <>
                <dt className="text-muted">{t('strategy.list.activatesAt')}</dt>
                <dd>{formatDate(s.activateAt, locale)}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 className="mb-2 text-sm font-semibold">{t('strategy.step.guardrail')}</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">{t('strategy.detail.maxChange')}</dt>
            <dd className="tabular">±{s.guardrail.maxChangePercent}%</dd>
            <dt className="text-muted">{t('strategy.detail.autoApprove')}</dt>
            <dd className="tabular">{formatPrice(s.guardrail.autoApproveThreshold, locale)}</dd>
            <dt className="text-muted">{t('strategy.detail.map')}</dt>
            <dd>{s.guardrail.mapEnforced ? t('strategy.detail.mapOn') : t('strategy.detail.mapOff')}</dd>
            {(s.guardrail.minPrice !== null || s.guardrail.maxPrice !== null) && (
              <>
                <dt className="text-muted">{t('strategy.detail.bounds')}</dt>
                <dd className="tabular">
                  {s.guardrail.minPrice !== null ? formatPrice(s.guardrail.minPrice, locale) : '—'}
                  {' – '}
                  {s.guardrail.maxPrice !== null ? formatPrice(s.guardrail.maxPrice, locale) : '—'}
                </dd>
              </>
            )}
          </dl>
        </section>

        <section className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 className="mb-2 text-sm font-semibold">{t('strategy.detail.rulesTitle')}</h2>
          {boundRules.length === 0 ? (
            <p className="text-sm text-muted">{t('strategy.detail.noRules')}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {boundRules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <Link href="/rules" className="font-medium text-brand hover:underline">{r.name}</Link>
                    <span className="tabular text-muted"> · {r.id}</span>
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface p-card shadow-e1">
          <h2 className="mb-2 text-sm font-semibold">{t('strategy.detail.impactTitle')}</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
            <dt className="text-muted">{t('strategy.detail.recs')}</dt>
            <dd className="tabular">{affected.length}</dd>
            <dt className="text-muted">{t('strategy.detail.pendingRecs')}</dt>
            <dd className="tabular">{pipeline}</dd>
            <dt className="text-muted">{t('strategy.detail.acceptance')}</dt>
            <dd className="tabular">{acceptance === null ? '—' : `${Math.round(acceptance * 100)}%`}</dd>
            <dt className="text-muted">{t('strategy.detail.projected')}</dt>
            <dd className="tabular">{formatPrice(Math.round(projected), locale)}</dd>
          </dl>
          {affected.length > 0 && (
            <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
              {affected.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                  <Link href={`/recommendations/${r.id}`} className="tabular font-medium text-brand hover:underline">{r.id}</Link>
                  <span className="tabular text-muted">{r.sku}</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* I-03 sticky action bar: lifecycle actions stay reachable while evidence scrolls;
          bottom-14 clears the mobile bottom nav, md:bottom-0 on desktop. */}
      <RoleGate action="strategy.create">
        <div className="sticky bottom-14 z-20 -mx-4 -mb-20 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur md:bottom-0 md:-mx-6 md:-mb-6 md:px-6">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            {s.status === 'draft' && (
              <>
                <Link href={`/strategy/${s.id}/edit`} className="inline-flex h-9 items-center rounded-input border border-line px-3 text-sm">
                  {t('strategy.action.edit')}
                </Link>
                <Button size="sm" onClick={() => run(submitStrategy(user, s.id))}>{t('strategy.action.submit')}</Button>
              </>
            )}
            <RoleGate action="strategy.activate">
              {s.status === 'pending_manager_approval' && (
                <>
                  <Button size="sm" onClick={() => run(activateStrategy(user, s.id))}>{t('strategy.action.approve')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setScheduling(true); setScheduleAt(''); }}>{t('strategy.action.schedule')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setRejecting(true); setNote(''); setNoteErr(false); }}>{t('strategy.action.reject')}</Button>
                </>
              )}
              {s.status === 'scheduled' && (
                <>
                  <Button size="sm" onClick={() => run(activateStrategy(user, s.id))}>{t('strategy.action.activateNow')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => run(unscheduleStrategy(user, s.id))}>{t('strategy.action.unschedule')}</Button>
                </>
              )}
              {s.status === 'active' && (
                <>
                  <Link href={`/strategy/${s.id}/edit`} className="inline-flex h-9 items-center rounded-input border border-line px-3 text-sm">
                    {t('strategy.action.edit')}
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => run(archiveStrategy(user, s.id))}>{t('strategy.action.archive')}</Button>
                </>
              )}
            </RoleGate>
            <span className="tabular ml-auto text-xs text-faint">{t(`strategy.status.${s.status}`)}</span>
          </div>
        </div>
      </RoleGate>

      <Dialog open={rejecting} onClose={() => setRejecting(false)} title={t('strategy.action.confirmReject')}>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const r = rejectStrategy(user, s.id, note);
            if (r.ok) setRejecting(false);
            else if (r.error === 'note_required') setNoteErr(true);
            else run(r);
          }}
        >
          <Field label={t('strategy.action.rejectNote')} error={noteErr ? t('strategy.err.note_required') : undefined}>
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>{t('strategy.action.cancel')}</Button>
            <Button type="submit" variant="destructive">{t('strategy.action.reject')}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={scheduling} onClose={() => setScheduling(false)} title={t('strategy.schedule.title')}>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!scheduleAt) return;
            const r = activateStrategy(user, s.id, { at: new Date(scheduleAt).toISOString() });
            if (r.ok) setScheduling(false);
            else run(r);
          }}
        >
          <p className="text-sm text-muted">{t('strategy.schedule.desc', { name: s.name })}</p>
          <Field label={t('strategy.schedule.at')}>
            {(p) => <Input {...p} type="datetime-local" required value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />}
          </Field>
          <p className="text-xs text-faint">{t('strategy.schedule.honest')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setScheduling(false)}>{t('strategy.action.cancel')}</Button>
            <Button type="submit" disabled={!scheduleAt}>{t('strategy.action.schedule')}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
