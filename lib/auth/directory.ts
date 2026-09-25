import type { Role } from '../ontology';

/*
 * Demo identity directory — stands in for the tenant/IdP/membership tables a real Mesta backend
 * owns. The shapes mirror the backlog model (Identity → Organization → Workspace → Role →
 * Permissions); `lib/auth/api.ts` is the only consumer, so swapping this for real endpoints does
 * not touch the UI.
 */

export type ProviderType = 'oidc' | 'saml';
export type IdentityProviderKind = 'entra' | 'okta' | 'google' | 'generic';

export interface IdentityProviderConfig {
  kind: IdentityProviderKind;
  type: ProviderType;
  /** Display label shown to users (never a raw config id). */
  label: string;
  entityId: string;
  redirectUri: string;
  certificateExpiresAt: string;
  scim: 'active' | 'not_configured';
}

export interface Organization {
  id: string;
  name: string;
  domains: string[];
  /** Null = the organization exists but SSO is not configured for Mesta. */
  idp: IdentityProviderConfig | null;
  /** IdP group → Mesta role (AUTH-18). */
  groupRoles: Record<string, Role>;
  fallbackRole: Role | null;
}

export interface Workspace {
  id: string;
  orgId: string;
  name: string;
  businessUnit: string;
  location: string;
}

export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  /** IdP groups asserted at sign-in; roles are derived per workspace from the org's mapping. */
  groups: string[];
  memberships: { workspaceId: string; role?: Role }[];
  lastSignInAt: string | null;
}

export const ORGANIZATIONS: Organization[] = [
  {
    id: 'org-mesta-retail', name: 'Mesta Retail', domains: ['mesta.id', 'mestaretail.co.id'],
    idp: {
      kind: 'entra', type: 'oidc', label: 'Microsoft Entra ID', entityId: 'https://login.mesta.id/retail',
      redirectUri: '/auth/callback', certificateExpiresAt: '2027-03-01T00:00:00+07:00', scim: 'active',
    },
    groupRoles: {
      'pricing-analysts': 'analyst', 'pricing-managers': 'manager', 'finance-approvers': 'approver',
      'retail-ops': 'ops_lead', 'compliance': 'compliance',
    },
    fallbackRole: null,
  },
  {
    id: 'org-mesta-distribution', name: 'Mesta Distribution', domains: ['mestadist.co.id'],
    idp: {
      kind: 'okta', type: 'saml', label: 'Okta', entityId: 'urn:mesta:distribution',
      redirectUri: '/auth/callback', certificateExpiresAt: '2026-11-15T00:00:00+07:00', scim: 'not_configured',
    },
    groupRoles: { 'dist-pricing': 'analyst', 'dist-leads': 'manager' },
    fallbackRole: 'analyst',
  },
  // Exists as a customer but has not configured SSO for Mesta yet (AUTH-12 "not configured").
  { id: 'org-nusantara', name: 'Nusantara Mart', domains: ['nusantaramart.co.id'], idp: null, groupRoles: {}, fallbackRole: null },
];

/** Group mailboxes shared by several organizations → "We found multiple workspaces" (AUTH-03). */
export const SHARED_DOMAINS: Record<string, string[]> = { 'mestagroup.com': ['org-mesta-retail', 'org-mesta-distribution'] };

export const WORKSPACES: Workspace[] = [
  { id: 'ws-retail-jkt', orgId: 'org-mesta-retail', name: 'Mesta Retail', businessUnit: 'ID-West', location: 'Jakarta HQ' },
  { id: 'ws-retail-bdg', orgId: 'org-mesta-retail', name: 'Mesta Retail', businessUnit: 'ID-West', location: 'Bandung' },
  { id: 'ws-dist-jawa', orgId: 'org-mesta-distribution', name: 'Mesta Distribution', businessUnit: 'Java', location: 'Surabaya' },
];

export const DIRECTORY_USERS: DirectoryUser[] = [
  { id: 'u-analyst-1', email: 'rina@mesta.id', name: 'Rina Analyst', status: 'active', groups: ['pricing-analysts'], memberships: [{ workspaceId: 'ws-retail-jkt' }], lastSignInAt: '2026-09-24T08:12:00+07:00' },
  { id: 'u-manager-1', email: 'budi@mesta.id', name: 'Budi Manager', status: 'active', groups: ['pricing-managers'], memberships: [{ workspaceId: 'ws-retail-jkt' }, { workspaceId: 'ws-retail-bdg' }, { workspaceId: 'ws-dist-jawa', role: 'manager' }], lastSignInAt: '2026-09-24T09:40:00+07:00' },
  { id: 'u-approver-1', email: 'andre@mesta.id', name: 'Andre Finance', status: 'active', groups: ['finance-approvers'], memberships: [{ workspaceId: 'ws-retail-jkt' }], lastSignInAt: '2026-09-23T15:02:00+07:00' },
  { id: 'u-ops-1', email: 'sari@mesta.id', name: 'Sari Ops', status: 'active', groups: ['retail-ops'], memberships: [{ workspaceId: 'ws-retail-jkt' }], lastSignInAt: '2026-09-24T06:30:00+07:00' },
  { id: 'u-compliance-1', email: 'dewi@mesta.id', name: 'Dewi Compliance', status: 'active', groups: ['compliance'], memberships: [{ workspaceId: 'ws-retail-jkt' }], lastSignInAt: '2026-09-22T11:20:00+07:00' },
  { id: 'u-dist-1', email: 'tono@mestadist.co.id', name: 'Tono Distribution', status: 'active', groups: ['dist-pricing'], memberships: [{ workspaceId: 'ws-dist-jawa' }], lastSignInAt: '2026-09-20T10:00:00+07:00' },
  { id: 'u-disabled-1', email: 'former@mesta.id', name: 'Former Employee', status: 'disabled', groups: ['pricing-analysts'], memberships: [{ workspaceId: 'ws-retail-jkt' }], lastSignInAt: '2026-06-01T10:00:00+07:00' },
];

export const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

export function orgsForEmail(email: string): Organization[] {
  const domain = domainOf(email);
  const shared = SHARED_DOMAINS[domain];
  if (shared) return ORGANIZATIONS.filter((o) => shared.includes(o.id));
  return ORGANIZATIONS.filter((o) => o.domains.includes(domain));
}

export const orgById = (id: string) => ORGANIZATIONS.find((o) => o.id === id) ?? null;
export const workspaceById = (id: string) => WORKSPACES.find((w) => w.id === id) ?? null;

/** Role for a user in a workspace: explicit membership role, else IdP group mapping, else fallback. */
export function resolveRole(
  user: DirectoryUser, workspaceId: string,
  overrides?: { groupRoles?: Record<string, Record<string, Role>>; fallbackRole?: Record<string, Role | null> },
): Role | null {
  const m = user.memberships.find((x) => x.workspaceId === workspaceId);
  if (!m) return null;
  if (m.role) return m.role;
  const org = orgById(workspaceById(workspaceId)?.orgId ?? '');
  if (!org) return null;
  const mapping = overrides?.groupRoles?.[org.id] ?? org.groupRoles;
  for (const g of user.groups) if (mapping[g]) return mapping[g]!;
  return overrides?.fallbackRole && org.id in overrides.fallbackRole ? overrides.fallbackRole[org.id] ?? null : org.fallbackRole;
}
