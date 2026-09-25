import { beforeEach, describe, expect, it } from 'vitest';
import {
  discover, getSession, getWorkspaces, handleCallback, idpIssueCode, logout, startSso, switchWorkspace,
} from '@/lib/auth/api';
import { DIRECTORY_USERS, resolveRole } from '@/lib/auth/directory';
import { safeReturnTo } from '@/lib/auth/redirect';
import { isSessionValid, useAuthStore } from '@/lib/stores/auth';
import { useSsoAdminStore } from '@/lib/stores/sso-admin';

const user = (email: string) => DIRECTORY_USERS.find((u) => u.email === email)!;

/** Runs the full SSO leg the way the /login → /auth/idp → /auth/callback pages do. */
async function signIn(email: string, orgHandle: string, returnTo: string | null = null) {
  const url = await startSso({ email, orgHandle, returnTo });
  const q = new URL(url, 'http://x').searchParams;
  const code = idpIssueCode({ email, orgId: orgHandle, nonce: q.get('nonce')! });
  return handleCallback({ state: q.get('state'), code, error: null });
}

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({ session: null, revoked: [], events: [] });
  useSsoAdminStore.setState({ groupRoles: {}, fallbackRole: {}, userStatus: {} });
});

describe('safeReturnTo (AUTH-27)', () => {
  it.each([
    ['/catalog?category=Dairy', '/catalog?category=Dairy'],
    ['/recommendations/REC-1#why', '/recommendations/REC-1#why'],
    [null, '/overview'],
    ['', '/overview'],
    ['https://malicious-site.com', '/overview'],
    ['//malicious-site.com/x', '/overview'],
    ['/\\malicious-site.com', '/overview'],
    ['javascript:alert(1)', '/overview'],
    ['catalog', '/overview'],
    ['/login?returnTo=/x', '/overview'],
    ['/auth/callback', '/overview'],
    ['/workspaces', '/overview'],
  ])('%s → %s', (raw, out) => expect(safeReturnTo(raw)).toBe(out));
});

describe('discovery (AUTH-02/03)', () => {
  it('resolves by domain, case- and whitespace-insensitive, without exposing IdP config', async () => {
    const r = await discover('  Rina@MESTA.id ');
    expect(r).toEqual({ kind: 'resolved', organization: { handle: 'org-mesta-retail', name: 'Mesta Retail', provider: 'Microsoft Entra ID' } });
  });
  it('distinguishes multiple, unknown and not-configured organizations', async () => {
    expect((await discover('x@mestagroup.com')).kind).toBe('multiple');
    expect((await discover('x@unknown.org')).kind).toBe('unknown');
    expect(await discover('x@nusantaramart.co.id')).toEqual({ kind: 'not_configured', organizationName: 'Nusantara Mart' });
  });
});

describe('callback validation (AUTH-05)', () => {
  it('establishes a session and keeps a safe returnTo', async () => {
    const r = await signIn('rina@mesta.id', 'org-mesta-retail', '/catalog?category=Dairy');
    expect(r).toEqual({ kind: 'session', returnTo: '/catalog?category=Dairy' });
    const s = getSession()!;
    expect(s.role).toBe('analyst');
    expect(s.workspaceId).toBe('ws-retail-jkt');
    expect(s.permissions).toContain('catalog.export');
    expect(JSON.stringify(s)).not.toMatch(/token|password|secret/i);
    expect(useAuthStore.getState().events[0]!.type).toBe('auth_sign_in');
  });

  it('rejects a state mismatch, a forged signature and a replayed code', async () => {
    const url = await startSso({ email: 'rina@mesta.id', orgHandle: 'org-mesta-retail', returnTo: null });
    const q = new URL(url, 'http://x').searchParams;
    const code = idpIssueCode({ email: 'rina@mesta.id', orgId: 'org-mesta-retail', nonce: q.get('nonce')! });
    expect(await handleCallback({ state: 'forged', code, error: null })).toEqual({ kind: 'error', reason: 'invalid_response' });
    // The transaction is single-use: the genuine state cannot be replayed after any attempt.
    expect(await handleCallback({ state: q.get('state'), code, error: null })).toEqual({ kind: 'error', reason: 'invalid_response' });
    expect(getSession()).toBeNull();

    const url2 = await startSso({ email: 'rina@mesta.id', orgHandle: 'org-mesta-retail', returnTo: null });
    const q2 = new URL(url2, 'http://x').searchParams;
    const good = idpIssueCode({ email: 'rina@mesta.id', orgId: 'org-mesta-retail', nonce: q2.get('nonce')! });
    const tampered = `${good.split('.')[0]}.deadbeef`;
    expect(await handleCallback({ state: q2.get('state'), code: tampered, error: null })).toEqual({ kind: 'error', reason: 'invalid_response' });
  });

  it('rejects a code bound to another nonce or identity', async () => {
    const url = await startSso({ email: 'rina@mesta.id', orgHandle: 'org-mesta-retail', returnTo: null });
    const q = new URL(url, 'http://x').searchParams;
    const code = idpIssueCode({ email: 'budi@mesta.id', orgId: 'org-mesta-retail', nonce: q.get('nonce')! });
    expect(await handleCallback({ state: q.get('state'), code, error: null })).toEqual({ kind: 'error', reason: 'invalid_response' });
  });

  it('maps IdP errors and account state to user-facing reasons', async () => {
    const url = await startSso({ email: 'rina@mesta.id', orgHandle: 'org-mesta-retail', returnTo: null });
    const state = new URL(url, 'http://x').searchParams.get('state');
    expect(await handleCallback({ state, code: null, error: 'temporarily_unavailable' })).toEqual({ kind: 'error', reason: 'provider_unavailable' });
    expect(await signIn('former@mesta.id', 'org-mesta-retail')).toEqual({ kind: 'error', reason: 'account_disabled' });
    useSsoAdminStore.getState().setUserStatus('u-analyst-1', 'disabled');
    expect(await signIn('rina@mesta.id', 'org-mesta-retail')).toEqual({ kind: 'error', reason: 'account_disabled' });
    expect(useAuthStore.getState().events.every((e) => e.type === 'auth_sso_failed')).toBe(true);
  });
});

describe('workspaces and roles (AUTH-07/08/15/18)', () => {
  it('asks multi-workspace users to choose, then switches with a fresh role', async () => {
    expect((await signIn('budi@mesta.id', 'org-mesta-retail', '/strategy')).kind).toBe('select_workspace');
    expect(getSession()).toBeNull();
    const ws = await getWorkspaces();
    expect(ws!.options.map((o) => o.id)).toEqual(['ws-retail-jkt', 'ws-retail-bdg']);
    expect(ws!.returnTo).toBe('/strategy');
    expect(await switchWorkspace('ws-retail-bdg')).toBe(true);
    expect(getSession()!.workspaceId).toBe('ws-retail-bdg');
    expect(await switchWorkspace('ws-dist-jawa')).toBe(false); // other organization — not reachable from this session
  });

  it('resolves roles from explicit membership, group mapping, admin overrides and fallback', () => {
    expect(resolveRole(user('budi@mesta.id'), 'ws-dist-jawa')).toBe('manager');
    expect(resolveRole(user('sari@mesta.id'), 'ws-retail-jkt')).toBe('ops_lead');
    expect(resolveRole(user('sari@mesta.id'), 'ws-retail-bdg')).toBeNull();
    expect(resolveRole(user('sari@mesta.id'), 'ws-retail-jkt', { groupRoles: { 'org-mesta-retail': { 'retail-ops': 'analyst' } } })).toBe('analyst');
    expect(resolveRole(user('sari@mesta.id'), 'ws-retail-jkt', { groupRoles: { 'org-mesta-retail': {} }, fallbackRole: { 'org-mesta-retail': 'compliance' } })).toBe('compliance');
    expect(resolveRole(user('sari@mesta.id'), 'ws-retail-jkt', { groupRoles: { 'org-mesta-retail': {} } })).toBeNull();
  });
});

describe('session lifecycle (AUTH-06/14)', () => {
  it('logout clears the session and records the event', async () => {
    await signIn('rina@mesta.id', 'org-mesta-retail');
    logout('user');
    expect(getSession()).toBeNull();
    expect(useAuthStore.getState().events[0]!.type).toBe('auth_sign_out');
  });

  it('expired or revoked sessions are invalid', async () => {
    await signIn('rina@mesta.id', 'org-mesta-retail');
    const s = useAuthStore.getState().session!;
    expect(isSessionValid(s, [], new Date(s.sessionExpiry).getTime() + 1)).toBe(false);
    expect(isSessionValid(s, [s.sessionId])).toBe(false);
    useAuthStore.getState().revoke(s.sessionId);
    expect(getSession()).toBeNull();
  });
});
