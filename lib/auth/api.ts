import { isBootstrapped } from '../bootstrap';
import type { AuditEvent, AuditEventType, Role } from '../ontology';
import { can, PERMISSIONS, type Action } from '../rbac';
import { useAuditStore } from '../stores/audit';
import { isSessionValid, useAuthStore, type AuthSession } from '../stores/auth';
import { useSessionStore, USERS } from '../stores/session';
import { useWorkspaceSettingsStore } from '../stores/workspace-settings';
import { useSsoAdminStore } from '../stores/sso-admin';
import {
  DIRECTORY_USERS, orgById, orgsForEmail, resolveRole, workspaceById, WORKSPACES, type DirectoryUser, type Organization,
} from './directory';
import { safeReturnTo } from './redirect';

/*
 * Mesta auth service (AUTH-27 contract). Every function maps 1:1 to a backend endpoint:
 *
 *   POST /auth/discover        → discover()
 *   POST /auth/sso/start       → startSso()
 *   GET  /auth/callback        → handleCallback()
 *   GET  /auth/session         → getSession()
 *   POST /auth/logout          → logout()
 *   GET  /auth/workspaces      → getWorkspaces()
 *   GET  /auth/permissions     → getPermissions()
 *   POST /auth/switch-workspace → switchWorkspace()
 *
 * This demo build has no server, so the service runs in the browser against the mock directory
 * and a simulated IdP. The protocol steps are still real — state + nonce transaction, single-use
 * code, expiry, signature and nonce checks, safe returnTo — so replacing these bodies with fetch()
 * calls to the real backend (which is the authoritative authorizer) changes no UI.
 */

export type DiscoveryResult =
  | { kind: 'resolved'; organization: PublicOrg }
  | { kind: 'multiple'; organizations: PublicOrg[] }
  | { kind: 'unknown' }
  | { kind: 'not_configured'; organizationName: string };

/** What the login UI may know about an organization — no tenant ids beyond an opaque handle, no raw IdP config. */
export interface PublicOrg { handle: string; name: string; provider: string }

export type AuthErrorReason =
  | 'invalid_response' | 'provider_unavailable' | 'account_disabled' | 'not_configured' | 'not_provisioned' | 'session_failed';

export type CallbackResult =
  | { kind: 'session'; returnTo: string }
  | { kind: 'select_workspace'; returnTo: string }
  | { kind: 'error'; reason: AuthErrorReason };

export interface WorkspaceOption { id: string; organization: string; businessUnit: string; location: string; role: Role; current: boolean }

const TXN_KEY = 'mesta-auth-txn';
const PENDING_KEY = 'mesta-auth-pending';
const TXN_TTL_MS = 10 * 60_000;
const DEMO_IDP_SECRET = 'mesta-demo-idp';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomId = (bytes = 16) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Demo IdP signature — a keyed FNV-1a hash. A real backend verifies the IdP's JWS/SAML signature. */
function sign(payload: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${DEMO_IDP_SECRET}.${payload}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const publicOrg = (o: Organization): PublicOrg => ({ handle: o.id, name: o.name, provider: o.idp?.label ?? '' });

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidWorkEmail(raw: string): boolean {
  return EMAIL_RE.test(normalizeEmail(raw));
}

// ── Audit (AUTH-20) ─────────────────────────────────────────────────────────────────────────
export function recordAuthEvent(type: AuditEventType, e: { actorId: string; actorRole: Role; entityId: string; note?: string }) {
  const event: AuditEvent = {
    id: `AUD-${Date.now().toString(36)}-${randomId(3)}`,
    timestamp: new Date().toISOString(),
    type, actorId: e.actorId, actorRole: e.actorRole, entityType: 'user', entityId: e.entityId, sku: null, source: 'sso', note: e.note ?? null,
  };
  useAuthStore.getState().pushEvent(event);
  if (isBootstrapped()) useAuditStore.setState((s) => ({ events: [event, ...s.events] }));
}

// ── POST /auth/discover ─────────────────────────────────────────────────────────────────────
export async function discover(rawEmail: string): Promise<DiscoveryResult> {
  await wait(450);
  const orgs = orgsForEmail(normalizeEmail(rawEmail));
  if (orgs.length === 0) return { kind: 'unknown' };
  const configured = orgs.filter((o) => o.idp);
  if (configured.length === 0) return { kind: 'not_configured', organizationName: orgs[0]!.name };
  if (configured.length > 1) return { kind: 'multiple', organizations: configured.map(publicOrg) };
  return { kind: 'resolved', organization: publicOrg(configured[0]!) };
}

// ── POST /auth/sso/start ────────────────────────────────────────────────────────────────────
/** Creates the state/nonce transaction and returns the IdP authorization URL. */
export async function startSso(input: { email: string; orgHandle: string; returnTo: string | null }): Promise<string> {
  await wait(300);
  const org = orgById(input.orgHandle);
  if (!org?.idp) throw new Error('not_configured');
  const txn = { state: randomId(), nonce: randomId(), email: normalizeEmail(input.email), orgId: org.id, returnTo: safeReturnTo(input.returnTo), createdAt: Date.now() };
  sessionStorage.setItem(TXN_KEY, JSON.stringify(txn));
  // No tenant id in the URL (AUTH-03): the IdP leg is keyed by the opaque state only.
  const q = new URLSearchParams({ state: txn.state, nonce: txn.nonce, login_hint: txn.email });
  return `/auth/idp?${q}`;
}

/** Simulated IdP: issues a signed, nonce-bound authorization code for the approved identity. */
export function idpIssueCode(input: { email: string; orgId: string; nonce: string }): string {
  const payload = btoa(JSON.stringify({ sub: input.email, org: input.orgId, nonce: input.nonce, iat: Date.now() }));
  return `${payload}.${sign(payload)}`;
}

/** Simulated IdP: the organization it is signing into, looked up from the opaque state. */
export function idpContext(state: string): { orgId: string; organization: string; provider: string } | null {
  const raw = sessionStorage.getItem(TXN_KEY);
  if (!raw) return null;
  const txn = JSON.parse(raw) as { state: string; orgId: string };
  const org = txn.state === state ? orgById(txn.orgId) : null;
  return org ? { orgId: org.id, organization: org.name, provider: org.idp?.label ?? '' } : null;
}

// ── GET /auth/callback ──────────────────────────────────────────────────────────────────────
export async function handleCallback(params: { state: string | null; code: string | null; error: string | null }): Promise<CallbackResult> {
  await wait(400);
  const raw = sessionStorage.getItem(TXN_KEY);
  sessionStorage.removeItem(TXN_KEY); // single use, success or not
  const fail = (reason: AuthErrorReason, note: string, actor = 'anonymous'): CallbackResult => {
    recordAuthEvent('auth_sso_failed', { actorId: actor, actorRole: 'analyst', entityId: actor, note });
    return { kind: 'error', reason };
  };
  if (!raw) return fail('invalid_response', 'no pending sign-in transaction');
  const txn = JSON.parse(raw) as { state: string; nonce: string; email: string; orgId: string; returnTo: string; createdAt: number };
  if (!params.state || params.state !== txn.state) return fail('invalid_response', 'state mismatch');
  if (Date.now() - txn.createdAt > TXN_TTL_MS) return fail('invalid_response', 'transaction expired');
  if (params.error) return fail(params.error === 'temporarily_unavailable' ? 'provider_unavailable' : 'invalid_response', `idp error: ${params.error}`, txn.email);
  const [payload, sig] = (params.code ?? '').split('.');
  if (!payload || !sig || sign(payload) !== sig) return fail('invalid_response', 'signature invalid', txn.email);
  let claims: { sub: string; org: string; nonce: string; iat: number };
  try { claims = JSON.parse(atob(payload)); } catch { return fail('invalid_response', 'malformed code', txn.email); }
  if (claims.nonce !== txn.nonce || claims.org !== txn.orgId || claims.sub !== txn.email) return fail('invalid_response', 'nonce/identity mismatch', txn.email);

  const user = DIRECTORY_USERS.find((u) => u.email === claims.sub);
  if (!user) return fail('not_provisioned', 'user not provisioned', claims.sub);
  if (statusOf(user) === 'disabled') return fail('account_disabled', 'account disabled', user.id);
  const workspaces = user.memberships.map((m) => workspaceById(m.workspaceId)).filter((w) => w && w.orgId === claims.org && roleFor(user, w.id));
  if (workspaces.length === 0) return fail('not_provisioned', 'no workspace membership', user.id);
  if (workspaces.length === 1) {
    return establish(user, workspaces[0]!.id) ? { kind: 'session', returnTo: txn.returnTo } : { kind: 'error', reason: 'session_failed' };
  }
  // Identity verified, workspace pending (AUTH-07.2): keep only the verified subject, briefly.
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ userId: user.id, orgId: claims.org, returnTo: txn.returnTo, at: Date.now() }));
  return { kind: 'select_workspace', returnTo: txn.returnTo };
}

/** Role with the administrator's group mapping applied (AUTH-18). */
export function roleFor(user: DirectoryUser, workspaceId: string): Role | null {
  const { groupRoles, fallbackRole } = useSsoAdminStore.getState();
  return resolveRole(user, workspaceId, { groupRoles, fallbackRole });
}

/** Provisioning status with SCIM/admin deprovisioning applied (AUTH-17). */
export function statusOf(user: DirectoryUser): 'active' | 'disabled' {
  return useSsoAdminStore.getState().userStatus[user.id] ?? user.status;
}

// ── Session ─────────────────────────────────────────────────────────────────────────────────
export function permissionsFor(role: Role): Action[] {
  return (Object.keys(PERMISSIONS) as Action[]).filter((a) => can(role, a));
}

function sessionMinutes(): number {
  return useWorkspaceSettingsStore.getState().config.security.sessionMinutes || 30;
}

function establish(user: DirectoryUser, workspaceId: string, previous?: AuthSession): AuthSession | null {
  const ws = workspaceById(workspaceId);
  const org = ws ? orgById(ws.orgId) : null;
  const role = roleFor(user, workspaceId);
  if (!ws || !org || !role) return null;
  const now = Date.now();
  const session: AuthSession = {
    sessionId: `sess_${randomId(8)}`,
    userId: user.id, name: user.name, email: user.email,
    organizationId: org.id, organizationName: org.name, workspaceId,
    role, permissions: permissionsFor(role), identityProvider: org.idp?.label ?? '',
    sessionCreatedAt: new Date(now).toISOString(),
    sessionExpiry: new Date(now + sessionMinutes() * 60_000).toISOString(),
  };
  useAuthStore.getState().setSession(session);
  applySessionToApp(session);
  if (previous) {
    recordAuthEvent('auth_workspace_switched', { actorId: user.id, actorRole: role, entityId: user.id, note: `${previous.workspaceId} → ${workspaceId}` });
    if (previous.role !== role) recordAuthEvent('auth_role_changed', { actorId: user.id, actorRole: role, entityId: user.id, note: `${previous.role} → ${role}` });
  } else {
    recordAuthEvent('auth_sign_in', { actorId: user.id, actorRole: role, entityId: user.id, note: `${org.idp?.label ?? 'SSO'} · ${workspaceId}` });
  }
  return session;
}

/** Push the session identity into the app's user context (role drives every permission check). */
export function applySessionToApp(s: AuthSession) {
  const base = USERS[s.role];
  useSessionStore.setState({ user: { ...base, userId: s.userId, name: s.name, role: s.role }, personaChosen: true });
}

export function getSession(): AuthSession | null {
  const { session, revoked } = useAuthStore.getState();
  return isSessionValid(session, revoked) ? session : null;
}

/** "Stay signed in" (AUTH-06.2): slide the expiry forward by the workspace session length. */
export function extendSession() {
  useAuthStore.getState().extend(new Date(Date.now() + sessionMinutes() * 60_000).toISOString());
}

// ── Workspaces ──────────────────────────────────────────────────────────────────────────────
function pendingIdentity(): { user: DirectoryUser; orgId: string; returnTo: string } | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (raw) {
    const p = JSON.parse(raw) as { userId: string; orgId: string; returnTo: string; at: number };
    const user = DIRECTORY_USERS.find((u) => u.id === p.userId);
    if (user && Date.now() - p.at < TXN_TTL_MS) return { user, orgId: p.orgId, returnTo: p.returnTo };
  }
  // A signed-in session only reaches workspaces of the organization whose IdP authenticated it;
  // another tenant's workspaces need a fresh sign-in through that tenant's IdP.
  const s = getSession();
  const user = s ? DIRECTORY_USERS.find((u) => u.id === s.userId) : undefined;
  return user && s ? { user, orgId: s.organizationId, returnTo: '/overview' } : null;
}

export async function getWorkspaces(): Promise<{ options: WorkspaceOption[]; returnTo: string } | null> {
  await wait(250);
  const p = pendingIdentity();
  if (!p) return null;
  const current = getSession()?.workspaceId;
  const options = p.user.memberships
    .map((m) => workspaceById(m.workspaceId))
    .filter((w): w is NonNullable<typeof w> => !!w && w.orgId === p.orgId)
    .flatMap((w) => {
      const role = roleFor(p.user, w.id);
      return role ? [{ id: w.id, organization: w.name, businessUnit: w.businessUnit, location: w.location, role, current: w.id === current }] : [];
    });
  return { options, returnTo: p.returnTo };
}

/** POST /auth/switch-workspace — also completes a multi-workspace sign-in. */
export async function switchWorkspace(workspaceId: string): Promise<boolean> {
  await wait(350);
  const p = pendingIdentity();
  if (!p || !p.user.memberships.some((m) => m.workspaceId === workspaceId) || workspaceById(workspaceId)?.orgId !== p.orgId) return false;
  const previous = getSession() ?? undefined;
  sessionStorage.removeItem(PENDING_KEY);
  return !!establish(p.user, workspaceId, previous);
}

export function workspaceLabel(workspaceId: string): string {
  const w = workspaceById(workspaceId);
  return w ? `${w.name} · ${w.businessUnit} · ${w.location}` : workspaceId;
}

/** Workspaces reachable from the current session (same organization) — drives "Switch workspace". */
export function workspaceCount(userId: string, organizationId: string): number {
  const user = DIRECTORY_USERS.find((u) => u.id === userId);
  return user ? user.memberships.filter((m) => workspaceById(m.workspaceId)?.orgId === organizationId && roleFor(user, m.workspaceId)).length : 0;
}

export async function getPermissions(): Promise<Action[]> {
  const s = getSession();
  return s ? permissionsFor(s.role) : [];
}

// ── POST /auth/logout ───────────────────────────────────────────────────────────────────────
export function logout(reason: 'user' | 'expired' | 'revoked' = 'user') {
  const s = useAuthStore.getState().session;
  if (s) recordAuthEvent(reason === 'revoked' ? 'auth_session_revoked' : 'auth_sign_out', { actorId: s.userId, actorRole: s.role, entityId: s.userId, note: reason });
  useAuthStore.getState().setSession(null);
  sessionStorage.removeItem(PENDING_KEY);
}

export { WORKSPACES };
