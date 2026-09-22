'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/ds/Drawer';
import { PriceValue } from '@/components/ds/PriceValue';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { MestaDataTable, useColumnVisibility, type DataColumn } from '@/components/ds/table/DataTable';
import { SavedViewMenu } from '@/components/ds/table/SavedViewMenu';
import { RationaleBreakdown } from '@/components/ds/RationaleBreakdown';
import { Button } from '@/components/ui/button';
import { Input, inputCls } from '@/components/ui/field';
import { formatDate } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { AuditEvent, AuditEventType } from '@/lib/ontology';
import { useAuditLog, useRecommendations } from '@/lib/queries';
import { useSessionStore } from '@/lib/stores';
import { actionForPath } from '@/lib/rbac';
import { track } from '@/lib/telemetry';
import { eventLinks, filterAudit, parseAuditFilters, serializeAuditFilters, type AuditFilters } from './audit-utils';

const TYPES: AuditEventType[] = [
  'strategy_submit', 'strategy_activate', 'strategy_reject', 'strategy_rollback', 'scenario_sent', 'recommendation_approve', 'recommendation_reject',
  'recommendation_adjust', 'deployment_success', 'deployment_failure', 'deployment_retry', 'model_review_feedback', 'manual_override',
];
const PAGE = 100;

export function AuditPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const can = useCan();
  const role = useSessionStore((s) => s.user.role);
  const log = useAuditLog();
  const recs = useRecommendations();
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const columnVis = useColumnVisibility('audit');

  // Filters live in the URL so saved views and shared links agree.
  const query = sp.toString();
  const filters = useMemo(() => parseAuditFilters(new URLSearchParams(query)), [query]);
  const set = (p: Partial<AuditFilters>) => {
    setShown(PAGE);
    const s = serializeAuditFilters({ ...filters, ...p }).toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const rows = useMemo(() => filterAudit(log.data, filters), [log.data, filters]);
  const actors = useMemo(() => [...new Set(log.data.map((e) => e.actorId))].sort(), [log.data]);
  const scope = can('audit.view_all') ? 'all' : role === 'ops_lead' ? 'deployment' : 'own';

  const columns = useMemo<DataColumn<AuditEvent>[]>(() => [
    { id: 'time', header: t('audit.list.time'), cell: (e) => <span className="tabular whitespace-nowrap text-muted">{formatDate(e.timestamp, locale)}</span> },
    {
      id: 'event', header: t('audit.list.event'), required: true,
      cell: (e) => (
        <button type="button" aria-label={t('audit.list.open', { id: e.id })} onClick={() => setSelected(e)} className="text-left text-brand hover:underline">
          {t(`common.event.${e.type}`)}
        </button>
      ),
    },
    { id: 'actor', header: t('audit.list.actor'), cell: (e) => <>{e.actorId} <span className="text-xs text-faint">({t(`common.role.${e.actorRole}`)})</span></> },
    { id: 'source', header: t('audit.list.source'), cell: (e) => t(`common.source.${e.source}`) },
    { id: 'entity', header: t('audit.list.entity'), cell: (e) => <span className="tabular">{e.sku ?? e.entityId}</span> },
  ], [t, locale]);

  const rec = selected?.entityType === 'recommendation' || selected?.entityType === 'deployment'
    ? recs.data.find((r) => r.id === selected.entityId) : undefined;
  const primaryLink = selected
    ? eventLinks(selected).find((l) => { const a = actionForPath(l.href.split('?')[0] ?? l.href); return !a || can(a); })
    : undefined;

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle', { count: rows.length, total: log.data.length })}
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
        <Button variant="ghost" onClick={() => { setShown(PAGE); router.replace(pathname, { scroll: false }); }}>{t('common.state.clearFilters')}</Button>
      </div>

      {log.isLoading ? <LoadingRows rows={8} /> : log.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={log.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('audit.list.empty')} />
      ) : (
        <>
          <MestaDataTable
            tableId="audit"
            caption={t('audit.list.caption')}
            columns={columns}
            rows={rows.slice(0, shown)}
            getRowId={(e) => e.id}
            onRowClick={setSelected}
            minWidth={720}
            visibility={columnVis}
            toolbar={
              <SavedViewMenu
                tableId="audit"
                currentQuery={serializeAuditFilters(filters).toString()}
                hidden={[...columnVis.hidden]}
                onApply={({ query: q, hidden }) => {
                  router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
                  columnVis.setHidden(hidden);
                }}
              />
            }
            csv={can('audit.export') ? {
              filename: 'mesta-audit.csv',
              headers: ['id', 'timestamp', 'type', 'actorId', 'actorRole', 'entityType', 'entityId', 'sku', 'source', 'oldPrice', 'newPrice', 'note'],
              cells: (e) => [e.id, e.timestamp, e.type, e.actorId, e.actorRole, e.entityType, e.entityId, e.sku, e.source, e.snapshot?.oldPrice, e.snapshot?.newPrice, e.note],
              onDone: (n) => track('audit_exported', { rows: n }),
            } : undefined}
          />
          {rows.length > shown && <div className="mt-3 text-center"><Button variant="secondary" onClick={() => setShown(shown + PAGE)}>{t('recommendations.action.more', { n: rows.length - shown })}</Button></div>}
        </>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={t('audit.detail.title')}
        href={primaryLink?.href}
        hrefLabel={primaryLink ? t(`audit.detail.${primaryLink.key}`) : undefined}
      >
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-medium">{t(`common.event.${selected.type}`)} <span className="tabular text-xs text-muted">{selected.id}</span></p>
            <p className="text-xs text-muted"><span className="tabular">{formatDate(selected.timestamp, locale)}</span> · {selected.actorId} · {t(`common.source.${selected.source}`)}</p>
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
          </div>
        )}
      </Drawer>
    </>
  );
}
