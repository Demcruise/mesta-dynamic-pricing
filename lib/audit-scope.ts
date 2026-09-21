import type { AuditEvent, UserSession } from './ontology';
import { can } from './rbac';

/**
 * Which audit events a user may see. Enforced in the query selector, not the UI:
 * manager/compliance see everything, ops leads only deployment events, analysts only
 * events they authored or on SKUs they own (by actorId, never by generic role).
 */
export function selectAuditForUser(events: AuditEvent[], user: UserSession): AuditEvent[] {
  if (can(user.role, 'audit.view_all')) return events;
  if (user.role === 'ops_lead') return events.filter((e) => e.entityType === 'deployment');
  return events.filter((e) => e.actorId === user.userId || (e.sku !== null && user.ownedSkuIds.includes(e.sku)));
}
