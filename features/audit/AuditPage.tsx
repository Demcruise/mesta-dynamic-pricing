'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { RationaleBreakdown } from '@/components/ds/RationaleBreakdown';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, inputCls } from '@/components/ui/field';
import { formatDate } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { AuditEvent, AuditEventType } from '@/lib/ontology';
import { useAuditLog, useRecommendations } from '@/lib/queries';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { track } from '@/lib/telemetry';
import { eventLinks, filterAudit, toCsv, EMPTY_AUDIT_FILTERS, type AuditFilters } from './audit-utils';

const TYPES: AuditEventType[] = [
  'strategy_submit', 'strategy_activate', 'strategy_reject', 'strategy_rollback', 'scenario_sent', 'recommendation_approve', 'recommendation_reject',
  'recommendation_adjust', 'deployment_success', 'deployment_failure', 'deployment_retry', 'model_review_feedback', 'manual_override',
];
const PAGE = 100;

export function AuditPage() {
  const { t, locale } = useTranslation();
  const sp = useSearchParams();
  const can = useCan();
  const role = useSessionStore((s) => s.user.role);
  const toast = useToastStore((s) => s.push);
  const log = useAuditLog();
  const recs = useRecommendations();
  const [filters, setFilters] = useState<AuditFilters>(() => ({ ...EMPTY_AUDIT_FILTERS, sku: sp.get('sku') ?? '' }));
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const rows = useMemo(() => filterAudit(log.data, filters), [log.data, filters]);
  const actors = useMemo(() => [...new Set(log.data.map((e) => e.actorId))].sort(), [log.data]);
  const set = (p: Partial<AuditFilters>) => { setShown(PAGE); setFilters((f) => ({ ...f, ...p })); };
  const scope = can('audit.view_all') ? 'all' : role === 'ops_lead' ? 'deployment' : 'own';

  const exportCsv = () => {
    if (!can('audit.export')) return;
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mesta-audit.csv';
    a.click();
    URL.revokeObjectURL(url);
    track('audit_exported', { rows: rows.length });
    toast(t('audit.exported', { n: rows.length }));
  };

  const rec = selected?.entityType === 'recommendation' || selected?.entityType === 'deployment'
    ? recs.data.find((r) => r.id === selected.entityId) : undefined;

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle', { count: rows.length, total: log.data.length })}
        actions={<RoleGate action="audit.export"><Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>{t('audit.export')}</Button></RoleGate>}
      />
      <p className="mb-3 text-xs text-muted">{t(`audit.scopeNote.${scope}`)}</p>

      <div className="mb-3 flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col gap-1 text-xs text-muted">{t('audit.filter.from')}<Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">{t('audit.filter.to')}<Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></label>
        <select aria-label={t('audit.filter.actor')} className={`${inputCls} w-44`} value={filters.actor} onChange={(e) => set({ actor: e.target.value })}>
          <option value="">{t('audit.filter.actor')}</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select aria-label={t('audit.filter.source')} className={`${inputCls} w-36`} value={filters.source} onChange={(e) => set({ source: e.target.value })}>
          <option value="">{t('audit.filter.source')}</option>
          {(['ui', 'agent', 'system'] as const).map((s) => <option key={s} value={s}>{t(`common.source.${s}`)}</option>)}
        </select>
        <select aria-label={t('audit.filter.type')} className={`${inputCls} w-56`} value={filters.type} onChange={(e) => set({ type: e.target.value })}>
          <option value="">{t('audit.filter.type')}</option>
          {TYPES.map((x) => <option key={x} value={x}>{t(`common.event.${x}`)}</option>)}
        </select>
        <Input type="search" aria-label={t('audit.filter.sku')} placeholder={t('audit.filter.search')} className="w-40" value={filters.sku} onChange={(e) => set({ sku: e.target.value })} />
        <Button variant="ghost" onClick={() => { setShown(PAGE); setFilters(EMPTY_AUDIT_FILTERS); }}>{t('common.state.clearFilters')}</Button>
      </div>

      {log.isLoading ? <LoadingRows rows={8} /> : log.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={log.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('audit.list.empty')} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[680px] text-sm">
              <caption className="sr-only">{t('audit.list.caption')}</caption>
              <thead className="bg-subtle text-xs text-muted">
                <tr>{(['time', 'event', 'actor', 'entity'] as const).map((c) => <th key={c} scope="col" className="px-3 py-2 text-left font-medium">{t(`audit.list.${c}`)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map((e) => (
                  <tr key={e.id} className="border-t border-line hover:bg-subtle">
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDate(e.timestamp, locale)}</td>
                    <td className="px-3">
                      <button type="button" aria-label={t('audit.list.open', { id: e.id })} onClick={() => setSelected(e)} className="text-left text-brand hover:underline">
                        {t(`common.event.${e.type}`)}
                      </button>
                    </td>
                    <td className="px-3">{e.actorId} <span className="text-xs text-faint">({t(`common.role.${e.actorRole}`)})</span></td>
                    <td className="tabular px-3">{e.sku ?? e.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > shown && <div className="mt-3 text-center"><Button variant="secondary" onClick={() => setShown(shown + PAGE)}>{t('recommendations.action.more', { n: rows.length - shown })}</Button></div>}
        </>
      )}

      <Dialog open={selected !== null} onClose={() => setSelected(null)} title={t('audit.detail.title')} className="max-w-lg">
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-medium">{t(`common.event.${selected.type}`)} <span className="tabular text-xs text-muted">{selected.id}</span></p>
            <p className="text-xs text-muted">{formatDate(selected.timestamp, locale)} · {selected.actorId} · {t(`common.source.${selected.source}`)}</p>
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted">{t('audit.detail.price')}</h3>
              {selected.snapshot?.oldPrice !== undefined || selected.snapshot?.newPrice !== undefined ? (
                <p className="flex items-center gap-2">
                  {t('audit.detail.before')}: {selected.snapshot?.oldPrice !== undefined ? <PriceValue value={selected.snapshot.oldPrice} /> : '—'}
                  {' → '}{t('audit.detail.after')}: {selected.snapshot?.newPrice !== undefined ? <PriceValue value={selected.snapshot.newPrice} /> : '—'}
                </p>
              ) : <p className="text-muted">{t('audit.detail.noSnapshot')}</p>}
            </div>
            {selected.note && <p><strong>{t('audit.detail.note')}:</strong> {selected.note}</p>}
            {rec && <RationaleBreakdown factors={rec.rationale} />}
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted">{t('audit.detail.links')}</h3>
              <ul className="flex flex-wrap gap-3">
                {eventLinks(selected).map((l) => (
                  <li key={`${l.key}-${l.href}`}><Link href={l.href} className="text-brand underline">{t(`audit.detail.${l.key}`)}: <span className="tabular">{l.label}</span></Link></li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end"><Button variant="secondary" onClick={() => setSelected(null)}>{t('audit.detail.close')}</Button></div>
          </div>
        )}
      </Dialog>
    </>
  );
}
