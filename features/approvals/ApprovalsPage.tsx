'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ds/Drawer';
import { PriceValue } from '@/components/ds/PriceValue';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RecoveryNotice } from '@/components/ds/trust';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, inputCls } from '@/components/ui/field';
import { delegateApproval, revokeDelegation } from '@/lib/actions/ops';
import { approvalChain, expireStaleRecommendations, pendingApprovalLevel, recommendationHealth, resubmitRecommendation } from '@/lib/actions/recommendation';
import { formatDate, formatPrice, formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Recommendation } from '@/lib/ontology';
import { useDelegations, useScopedRecommendations, useSkuList } from '@/lib/queries';
import { USERS, useSessionStore, useToastStore } from '@/lib/stores';
import { RecommendationCard } from '@/features/recommendations/RecommendationCard';

export function ApprovalsPage() {
  const { t, locale } = useTranslation();
  const q = useScopedRecommendations();
  const skuList = useSkuList();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [resubmitting, setResubmitting] = useState<Recommendation | null>(null);
  const [note, setNote] = useState('');
  const [inspecting, setInspecting] = useState<Recommendation | null>(null);

  // The expiry sweep is a system maintenance step — run it whenever the inbox opens.
  useEffect(() => { expireStaleRecommendations(); }, []);

  const productsBySku = useMemo(() => new Map(skuList.data.map((p) => [p.sku, p])), [skuList.data]);

  const groups = useMemo(() => ({
    // APR-003: decidable recs whose approval chain is not yet complete, by pending level.
    chain: q.data.filter((r) => (r.status === 'pending' || r.status === 'escalated') && pendingApprovalLevel(r) !== null),
    escalated: q.data.filter((r) => r.status === 'escalated'),
    changes: q.data.filter((r) => r.status === 'changes_requested'),
    expired: q.data.filter((r) => r.status === 'expired'),
  }), [q.data]);

  const total = groups.chain.length + groups.escalated.length + groups.changes.length + groups.expired.length;

  const resubmit = () => {
    if (!resubmitting) return;
    const r = resubmitRecommendation(user, resubmitting.id, note);
    if (r.ok) { setResubmitting(null); setNote(''); }
    else toast(t(`recommendations.err.${r.error}`));
  };

  return (
    <>
      <PageHeader title={t('approvals.page.title')} subtitle={t('approvals.page.desc')} />

      <RoleGate action="approval.delegate">
        <DelegationStrip t={t} locale={locale} />
      </RoleGate>

      {q.isLoading ? <LoadingRows rows={3} rowHeight={96} /> : q.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={q.refetch} />
      ) : total === 0 ? (
        <EmptyState variant="caughtUp" title={t('approvals.empty')} />
      ) : (
        <div className="flex max-w-5xl flex-col gap-6">
          {groups.chain.length > 0 && (
            <section aria-label={t('approvals.chain.title')}>
              <h2 className="mb-2 text-sm font-semibold">
                {t('approvals.chain.title')} <span className="tabular text-muted">({groups.chain.length})</span>
              </h2>
              <p className="mb-2 text-xs text-muted">{t('approvals.chain.desc')}</p>
              {/* N-01 condensed queue: the chain group renders rows, not full cards. */}
              <CondensedQueue recs={groups.chain} products={productsBySku} locale={locale} t={t} onInspect={setInspecting} showChain />
            </section>
          )}

          {groups.escalated.length > 0 && (
            <section aria-label={t('approvals.escalated.title')}>
              <h2 className="mb-2 text-sm font-semibold">
                {t('approvals.escalated.title')} <span className="tabular text-muted">({groups.escalated.length})</span>
              </h2>
              <p className="mb-2 text-xs text-muted">{t('approvals.escalated.desc')}</p>
              <CondensedQueue recs={groups.escalated} products={productsBySku} locale={locale} t={t} onInspect={setInspecting} />
            </section>
          )}

          {groups.changes.length > 0 && (
            <WorkflowSection title={t('approvals.changes.title')} desc={t('approvals.changes.desc')} recs={groups.changes} locale={locale}
              resubmit={(r) => { setResubmitting(r); setNote(''); }} t={t} ctaKey="approvals.action.resubmit" />
          )}

          {groups.expired.length > 0 && (
            <WorkflowSection title={t('approvals.expired.title')} desc={t('approvals.expired.desc')} recs={groups.expired} locale={locale}
              resubmit={(r) => { setResubmitting(r); setNote(''); }} t={t} ctaKey="approvals.action.reopen" extra={t('approvals.expired.note')} />
          )}
        </div>
      )}

      <Dialog open={resubmitting !== null} onClose={() => setResubmitting(null)} title={t('approvals.resubmit.title')}>
        <form noValidate className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); resubmit(); }}>
          {resubmitting && <p className="tabular text-sm text-muted">{resubmitting.id} · {resubmitting.sku} — {formatPrice(resubmitting.proposedPrice, locale)}</p>}
          {resubmitting && recommendationHealth(resubmitting).stale && (
            <RecoveryNotice>{t('approvals.resubmit.staleNote')}</RecoveryNotice>
          )}
          <Field label={t('approvals.resubmit.noteLabel')}>
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResubmitting(null)}>{t('common.action.cancel')}</Button>
            <Button type="submit">{t('approvals.action.resubmit')}</Button>
          </div>
        </form>
      </Dialog>

      {/* N-02 investigate drawer: full evidence inline without leaving the queue. */}
      <Drawer
        open={inspecting !== null}
        onClose={() => setInspecting(null)}
        title={inspecting ? `${inspecting.id} · ${inspecting.sku}` : ''}
      >
        {inspecting && (
          <div className="flex flex-col gap-3">
            <RecommendationCard rec={inspecting} product={productsBySku.get(inspecting.sku)} defaultOpen />
            <Link href={`/recommendations/${inspecting.id}`} className="text-sm text-brand hover:underline">
              {t('approvals.action.openDetail')} →
            </Link>
          </div>
        )}
      </Drawer>
    </>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** N-01 condensed approval queue: one row per rec — identity, prices, impact, chain position, investigate. */
function CondensedQueue({ recs, products, locale, t, onInspect, showChain = false }: {
  recs: Recommendation[];
  products: Map<string, import('@/lib/ontology').Product>;
  locale: 'en' | 'id';
  t: T;
  onInspect: (r: Recommendation) => void;
  showChain?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-e1">
      <table className="mesta-table w-full min-w-[640px] text-sm">
        <caption className="sr-only">{t('approvals.queue.caption')}</caption>
        <thead className="bg-subtle text-xs text-muted">
          <tr className="h-row">
            <th scope="col" className="px-3 py-row text-left font-medium">{t('approvals.queue.rec')}</th>
            <th scope="col" className="px-3 py-row text-right font-medium">{t('approvals.queue.move')}</th>
            <th scope="col" className="px-3 py-row text-right font-medium">{t('approvals.queue.impact')}</th>
            {showChain && <th scope="col" className="px-3 py-row text-left font-medium">{t('approvals.queue.awaiting')}</th>}
            <th scope="col" className="px-3 py-row text-left font-medium">{t('approvals.queue.age')}</th>
            <th scope="col" className="px-3 py-row text-right font-medium"><span className="sr-only">{t('approvals.queue.investigate')}</span></th>
          </tr>
        </thead>
        <tbody>
          {recs.map((r) => {
            const level = pendingApprovalLevel(r);
            const chainLen = approvalChain(r).length;
            return (
              <tr key={r.id} className="h-row border-t border-line transition-colors duration-fast hover:bg-subtle">
                <td className="px-3 py-row">
                  <Link href={`/recommendations/${r.id}`} className="tabular font-medium text-brand hover:underline">{r.id}</Link>
                  <span className="tabular text-muted"> · {r.sku}</span>
                </td>
                <td className="tabular px-3 text-right">
                  {formatPrice(r.currentPrice, locale)} → {formatPrice(r.proposedPrice, locale)}
                </td>
                <td className="px-3 text-right"><PriceValue value={r.projectedMarginImpact} /></td>
                {showChain && (
                  <td className="px-3 text-xs text-muted">
                    {t('approvals.chain.waiting', { level: level ? t(`common.role.${level}`) : '—', done: r.approvals.length, total: chainLen })}
                  </td>
                )}
                <td className="px-3 text-xs text-muted">{formatRelativeTime(r.createdAt, locale)}</td>
                <td className="px-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => onInspect(r)}>{t('approvals.action.investigate')}</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Manager's delegation strip: a live grant lets the named user approve
 * high-impact recommendations until `until`. One active grant per user.
 */
function DelegationStrip({ t, locale }: { t: T; locale: 'en' | 'id' }) {
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const grants = useDelegations();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('u-analyst-1');
  const [hours, setHours] = useState('24');
  const [err, setErr] = useState('');

  const now = Date.now();
  const active = grants.data.filter((g) => new Date(g.until).getTime() > now);
  const nameOf = (id: string) => Object.values(USERS).find((u) => u.userId === id)?.name ?? id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = delegateApproval(user, target, Number(hours));
    if (r.ok) { toast(t('approvals.delegation.toast')); setOpen(false); setErr(''); }
    else setErr(t(`approvals.err.${r.error}`));
  };

  return (
    <section aria-label={t('approvals.delegation.title')} className="mb-6 max-w-3xl rounded-card border border-line bg-surface p-card shadow-e1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('approvals.delegation.title')}</h2>
          <p className="mt-0.5 text-xs text-muted">{t('approvals.delegation.desc')}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{t('approvals.delegation.grant')}</Button>
      </div>
      {active.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-1.5">
          {active.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-input bg-subtle px-3 py-2 text-xs">
              <span className="font-medium">{nameOf(g.toUserId)}</span>
              <span className="tabular text-muted">{formatRelativeTime(g.until, locale)}</span>
              <Button size="sm" variant="ghost" className="ms-auto" onClick={() => {
                const r = revokeDelegation(user, g.id);
                if (!r.ok) toast(t(`approvals.err.${r.error}`));
              }}>{t('approvals.delegation.revoke')}</Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={t('approvals.delegation.dialogTitle')}>
        <form noValidate className="flex flex-col gap-3" onSubmit={submit}>
          <Field label={t('approvals.delegation.to')}>
            {(p) => (
              <select {...p} value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
                {Object.values(USERS).filter((u) => u.userId !== user.userId).map((u) => (
                  <option key={u.userId} value={u.userId}>{u.name} · {u.userId}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('approvals.delegation.hours')}>
            {(p) => <Input {...p} type="number" min="1" max="168" step="1" className="tabular w-28" value={hours} onChange={(e) => setHours(e.target.value)} />}
          </Field>
          <RecoveryNotice>{t('approvals.delegation.note')}</RecoveryNotice>
          {err && <p role="alert" className="text-xs text-critical">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.action.cancel')}</Button>
            <Button type="submit">{t('approvals.delegation.grant')}</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}

function WorkflowSection({ title, desc, recs, locale, resubmit, t, ctaKey, extra }: {
  title: string; desc: string; recs: Recommendation[]; locale: 'en' | 'id';
  resubmit: (r: Recommendation) => void; t: T; ctaKey: string; extra?: string;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold">{title} <span className="tabular text-muted">({recs.length})</span></h2>
      <p className="mb-2 text-xs text-muted">{desc}</p>
      {extra && <RecoveryNotice className="mb-2">{extra}</RecoveryNotice>}
      <ul className="grid grid-cols-1 gap-2">
        {recs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-card border border-line bg-surface p-3 shadow-e1">
            <StatusBadge status={r.status} />
            <Link href={`/recommendations/${r.id}`} className="tabular text-sm font-medium text-brand hover:underline">{r.id}</Link>
            <span className="tabular text-sm">{r.sku}</span>
            <span className="tabular text-sm text-muted">{formatPrice(r.currentPrice, locale)} → {formatPrice(r.proposedPrice, locale)}</span>
            <span className="text-xs text-faint">{formatDate(r.createdAt, locale)}</span>
            {r.decisionNote && <span className="w-full text-xs text-muted">“{r.decisionNote}”</span>}
            <span className="ms-auto"><Button size="sm" variant="secondary" onClick={() => resubmit(r)}>{t(ctaKey)}</Button></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
