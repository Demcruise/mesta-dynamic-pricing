'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LayoutList, ListTree } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/ds/Drawer';
import { PriceValue } from '@/components/ds/PriceValue';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/ds/states';
import { MestaDataTable, useColumnVisibility, type DataColumn } from '@/components/ds/table/DataTable';
import { SavedViewMenu } from '@/components/ds/table/SavedViewMenu';
import { RationaleBreakdown } from '@/components/ds/RationaleBreakdown';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { AuditFilterBar } from './AuditFilterBar';
import { formatDate } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { AuditEvent, AuditEventType } from '@/lib/ontology';
import { useAuditLog, useRecommendations } from '@/lib/queries';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { actionForPath } from '@/lib/rbac';
import { track } from '@/lib/telemetry';
import { AuditTimeline } from './AuditTimeline';
import { copyText, downloadJson, evidencePackage } from './export';
import { EMPTY_AUDIT_FILTERS, eventLinks, filterAudit, parseAuditFilters, serializeAuditFilters, type AuditFilters } from './audit-utils';

const TYPES: AuditEventType[] = [
  'strategy_submit', 'strategy_activate', 'strategy_reject', 'strategy_rollback', 'strategy_save', 'strategy_schedule', 'strategy_unschedule',
  'scenario_sent',
  'recommendation_approve', 'recommendation_reject', 'recommendation_adjust',
  'recommendation_request_changes', 'recommendation_escalate', 'recommendation_expire', 'recommendation_resubmit',
  'deployment_success', 'deployment_failure', 'deployment_retry', 'deployment_rollback', 'publish_scheduled', 'publish_cancelled',
  'rule_save', 'rule_run', 'override_request', 'override_approve', 'override_reject', 'datasource_sync',
  'experiment_save', 'experiment_start', 'experiment_conclude', 'experiment_cancel',
  'experiment_ready', 'experiment_complete', 'experiment_archive', 'delegation_grant', 'delegation_revoke',
  'policy_override', 'publish_window_end', 'model_review_feedback', 'manual_override',
  'notification_acknowledge', 'notification_snooze', 'notification_escalate', 'settings_change',
];
const PAGE = 100;

export function AuditPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const can = useCan();
  const role = useSessionStore((s) => s.user.role);
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const log = useAuditLog();
  const recs = useRecommendations();
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const columnVis = useColumnVisibility('audit');

  // Filters live in the URL so saved views and shared links agree.
  const query = sp.toString();
  const filters = useMemo(() => parseAuditFilters(new URLSearchParams(query)), [query]);
  const view = sp.get('view') === 'timeline' ? 'timeline' : 'list';
  const set = (p: Partial<AuditFilters>) => {
    setShown(PAGE);
    const s = serializeAuditFilters({ ...filters, ...p });
    if (view === 'timeline') s.set('view', 'timeline');
    const q = s.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  const setView = (v: 'list' | 'timeline') => {
    const s = serializeAuditFilters(filters);
    if (v === 'timeline') s.set('view', 'timeline');
    const q = s.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const rows = useMemo(() => filterAudit(log.data, filters), [log.data, filters]);
  const actors = useMemo(() => [...new Set(log.data.map((e) => e.actorId))].sort(), [log.data]);
  const scope = can('audit.view_all') ? 'all' : role === 'ops_lead' ? 'deployment' : 'own';

  const columns = useMemo<DataColumn<AuditEvent>[]>(() => [
    { id: 'time', defaultWidth: 200, header: t('audit.list.time'), cell: (e) => <span className="tabular whitespace-nowrap text-muted">{formatDate(e.timestamp, locale)}</span> },
    {
      id: 'event', defaultWidth: 320, header: t('audit.list.event'), required: true,
      cell: (e) => (
        // WCAG 2.5.3: the accessible name must contain the visible event label.
        <button type="button" aria-label={`${t(`common.event.${e.type}`)} — ${t('audit.list.open', { id: e.id })}`} onClick={() => setSelected(e)} className="text-left text-brand hover:underline">
          {t(`common.event.${e.type}`)}
        </button>
      ),
    },
    { id: 'actor', defaultWidth: 220, header: t('audit.list.actor'), cell: (e) => <>{e.actorId} <span className="text-xs text-faint">({t(`common.role.${e.actorRole}`)})</span></> },
    { id: 'source', defaultWidth: 140, header: t('audit.list.source'), cell: (e) => t(`common.source.${e.source}`) },
    { id: 'entity', defaultWidth: 180, header: t('audit.list.entity'), cell: (e) => <span className="tabular">{e.sku ?? e.entityId}</span> },
  ], [t, locale]);

  const groups = useMemo(() => [
    { id: 'day', label: t('audit.group.day'), value: (e: AuditEvent) => e.timestamp.slice(0, 10), format: (v: string) => formatDate(`${v}T12:00:00`, locale) },
    { id: 'type', label: t('audit.list.event'), value: (e: AuditEvent) => e.type, format: (v: string) => t(`common.event.${v}`) },
    { id: 'actor', label: t('audit.list.actor'), value: (e: AuditEvent) => e.actorId },
    { id: 'source', label: t('audit.list.source'), value: (e: AuditEvent) => e.source, format: (v: string) => t(`common.source.${v}`) },
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
      <p className="mb-4 text-caption text-muted">{t(`audit.scopeNote.${scope}`)}</p>

      <AuditFilterBar filters={filters} set={set} actors={actors} types={TYPES} />

      {/* AUD-015/016/023: VIEW (List/Timeline) on the left, DISPLAY/export on the right — separate from filtering. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t('audit.view.label')}
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: t('audit.view.list'), icon: LayoutList },
            { value: 'timeline', label: t('audit.view.timeline'), icon: ListTree },
          ]}
        />
        {/* AUD-009: CSV lives in the table toolbar; JSON + evidence package here. */}
        {can('audit.export') && (
          <div role="group" aria-label={t('audit.exportMenu.label')} className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { downloadJson('mesta-audit.json', rows); track('audit_exported', { rows: rows.length, format: 'json' }); }}>
              {t('audit.exportMenu.json')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { downloadJson('mesta-audit-evidence.json', evidencePackage(rows, { scope, exportedBy: user.userId })); track('audit_exported', { rows: rows.length, format: 'evidence' }); }}>
              {t('audit.exportMenu.evidence')}
            </Button>
          </div>
        )}
      </div>

      {log.isLoading ? <LoadingRows rows={8} /> : log.isError ? (
        <ErrorState title={t('common.state.error')} onRetry={log.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant={serializeAuditFilters(filters).toString() !== '' ? 'filter' : 'empty'}
          title={serializeAuditFilters(filters).toString() !== '' ? t('audit.list.empty') : t('audit.list.none')}
          {...(serializeAuditFilters(filters).toString() !== '' ? { action: { label: t('common.filter.clear'), onClick: () => set(EMPTY_AUDIT_FILTERS) } } : {})}
        >
          {serializeAuditFilters(filters).toString() !== '' && <p className="text-body-sm text-muted">{t('audit.list.emptyHint')}</p>}
        </EmptyState>
      ) : view === 'timeline' ? (
        <>
          <AuditTimeline events={rows.slice(0, shown)} onSelect={setSelected} />
          {rows.length > shown && <div className="mt-3 text-center"><Button variant="secondary" onClick={() => setShown(shown + PAGE)}>{t('recommendations.action.more', { n: rows.length - shown })}</Button></div>}
        </>
      ) : (
        <>
          <MestaDataTable
            tableId="audit"
            caption={t('audit.list.caption')}
            columns={columns}
            rows={rows.slice(0, shown)}
            getRowId={(e) => e.id}
            onRowClick={setSelected}
            minWidth={1060}
            resizable
            groups={groups}
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
            {/* AUD-009: the audit ID is the handle an auditor quotes — make it copyable. */}
            <Button size="sm" variant="secondary" className="self-start" onClick={() => { void copyText(selected.id); toast(t('audit.detail.copied')); }}>
              {t('audit.detail.copyId')}
            </Button>
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
