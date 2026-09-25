import type { AuditEvent, AuditEventType } from '@/lib/ontology';

/** Workspace settings section key → its deep-link slug (SET-042/043). */
const SETTINGS_SLUG: Record<string, string> = { pricing: 'pricing-engine', data: 'integrations', scope: 'scope-hierarchy' };

export interface AuditFilters {
  from: string; // yyyy-mm-dd
  to: string;
  actor: string;
  source: string;
  type: string;
  sku: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = { from: '', to: '', actor: '', source: '', type: '', sku: '' };

/** Filters live in the URL so saved views and shared links reproduce the same slice. */
export function parseAuditFilters(sp: URLSearchParams): AuditFilters {
  return {
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    actor: sp.get('actor') ?? '',
    source: sp.get('source') ?? '',
    type: sp.get('type') ?? '',
    sku: sp.get('sku') ?? '',
  };
}

export function serializeAuditFilters(f: AuditFilters): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of ['from', 'to', 'actor', 'source', 'type', 'sku'] as const) if (f[k]) sp.set(k, f[k]);
  return sp;
}

export function filterAudit(events: AuditEvent[], f: AuditFilters): AuditEvent[] {
  const from = f.from ? new Date(`${f.from}T00:00:00`).getTime() : null;
  const to = f.to ? new Date(`${f.to}T23:59:59.999`).getTime() : null;
  const sku = f.sku.trim().toLowerCase();
  return events.filter((e) => {
    const at = new Date(e.timestamp).getTime();
    if (from !== null && at < from) return false;
    if (to !== null && at > to) return false;
    if (f.actor && e.actorId !== f.actor) return false;
    if (f.source && e.source !== f.source) return false;
    if (f.type && e.type !== f.type) return false;
    if (sku && !(e.sku ?? '').toLowerCase().includes(sku)) return false;
    return true;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

const esc = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(events: AuditEvent[]): string {
  const head = ['id', 'timestamp', 'type', 'actorId', 'actorRole', 'entityType', 'entityId', 'sku', 'source', 'oldPrice', 'newPrice', 'note'];
  const rows = events.map((e) => [e.id, e.timestamp, e.type, e.actorId, e.actorRole, e.entityType, e.entityId, e.sku, e.source, e.snapshot?.oldPrice, e.snapshot?.newPrice, e.note]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

/** Visual tone per event family so the timeline is scannable by color alone. */
export type AuditTone = 'brand' | 'agent' | 'up' | 'down' | 'warn' | 'info';
export function eventTone(type: AuditEventType): AuditTone {
  if (type.startsWith('strategy_')) return 'brand';
  if (type === 'recommendation_approve') return 'up';
  if (type === 'recommendation_reject') return 'down';
  if (type === 'recommendation_adjust') return 'warn';
  if (type === 'deployment_success') return 'up';
  if (type === 'deployment_failure') return 'down';
  if (type === 'deployment_retry') return 'warn';
  if (type === 'deployment_rollback' || type === 'publish_cancelled') return 'warn';
  if (type === 'manual_override') return 'warn';
  if (type === 'scenario_sent') return 'agent';
  if (type === 'auth_sso_failed' || type === 'auth_access_denied' || type === 'auth_session_revoked') return 'down';
  if (type === 'auth_sign_in') return 'up';
  return 'info';
}

export interface AuditDayGroup { day: string; label: string; events: AuditEvent[] }

/** Groups events (already sorted desc) into per-day buckets for the timeline view. */
export function groupEventsByDay(events: AuditEvent[], locale: string): AuditDayGroup[] {
  const tag = locale === 'id' ? 'id-ID' : 'en-US';
  const fmt = new Intl.DateTimeFormat(tag, { dateStyle: 'full' });
  const keyFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const groups = new Map<string, AuditDayGroup>();
  for (const e of events) {
    const d = new Date(e.timestamp);
    const day = keyFmt.format(d);
    const g = groups.get(day) ?? { day, label: fmt.format(d), events: [] };
    g.events.push(e);
    groups.set(day, g);
  }
  return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day));
}

/** Where each event points, so a reviewer can jump from the log to the thing that changed. */
export function eventLinks(e: AuditEvent): { key: 'sku' | 'recommendation' | 'deployment' | 'strategy' | 'scenario' | 'settings'; label: string; href: string }[] {
  const out: { key: 'sku' | 'recommendation' | 'deployment' | 'strategy' | 'scenario' | 'settings'; label: string; href: string }[] = [];
  if (e.sku) out.push({ key: 'sku', label: e.sku, href: `/catalog/${e.sku}` });
  if (e.entityType === 'recommendation') out.push({ key: 'recommendation', label: e.entityId, href: `/recommendations/${e.entityId}` });
  if (e.entityType === 'deployment') {
    out.push({ key: 'recommendation', label: e.entityId, href: `/recommendations/${e.entityId}` });
    out.push({ key: 'deployment', label: e.entityId, href: '/deployment' });
  }
  if (e.entityType === 'strategy') out.push({ key: 'strategy', label: e.entityId, href: '/strategy' });
  if (e.entityType === 'scenario') out.push({ key: 'scenario', label: e.entityId, href: `/simulation/${e.entityId}` });
  if (e.entityType === 'settings') out.push({ key: 'settings', label: e.entityId, href: `/settings/${SETTINGS_SLUG[e.entityId] ?? e.entityId}` });
  return out;
}
