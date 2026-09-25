# Enterprise SSO & access layer (AUTH-01…32, 2026-09-25)

Mesta signs people in through their organization's identity provider only — no passwords, no local
accounts. This build has no backend, so the auth service (`lib/auth/api.ts`) runs in the browser
against a mock directory (`lib/auth/directory.ts`) and a generic **demo identity provider** page.
The protocol steps are real, and every function maps to one backend endpoint, so swapping the bodies
for `fetch()` calls changes no UI. The backend stays the authoritative authorizer; the client only
hides and explains.

## Flow

```
/any/protected/route ──(no session)──▶ /login?returnTo=/any/protected/route
/login: work email ─▶ POST /auth/discover ─▶ organization + provider (or: multiple / unknown / not configured)
Continue with SSO ─▶ POST /auth/sso/start (state + nonce txn, 10 min, single use) ─▶ IdP
IdP ─▶ /auth/callback?state&code ─▶ verify state, expiry, signature, nonce, identity
     ─▶ provisioned? active? workspace membership + role?
     ─▶ 1 workspace: session ─▶ safe returnTo      n workspaces: /workspaces ─▶ session
```

| Endpoint (backend) | Demo function |
|---|---|
| `POST /auth/discover` | `discover(email)` |
| `POST /auth/sso/start` | `startSso({ email, orgHandle, returnTo })` |
| `GET /auth/callback` | `handleCallback({ state, code, error })` |
| `GET /auth/session` | `getSession()` |
| `GET /auth/workspaces` · `POST /auth/switch-workspace` | `getWorkspaces()` · `switchWorkspace(id)` |
| `GET /auth/permissions` | `getPermissions()` |
| `POST /auth/logout` | `logout(reason)` |

## Security properties
- **No credentials in the client.** The IdP response is validated and discarded; the stored session
  holds identity, organization, workspace, role, permissions and timestamps only.
- **No tenant ids in URLs.** The IdP leg is keyed by the opaque `state`; the login UI only sees an
  organization name and provider label.
- **Callback validation.** Missing/mismatched state, expired transaction, bad signature, nonce or
  identity mismatch → `/auth/error?reason=invalid_response`. The transaction is single use, success or not.
- **Safe redirects.** `safeReturnTo` accepts only same-origin relative paths and never returns to
  `/login`, `/auth/*` or `/workspaces`.
- **Tenant isolation.** A session can only switch to workspaces of the organization whose IdP
  authenticated it; another organization needs a fresh sign-in.
- **Errors are copy, not diagnostics.** Six user-facing reasons; provider codes, tenant ids and traces
  never reach the UI. Every failure is an `auth_sso_failed` audit event.

## Session
- Length comes from Settings → Security (`sessionMinutes`). Two minutes before expiry a dialog offers
  **Stay signed in**; at expiry the user is sent to sign in again and returns to the same page.
- Revoked or cleared sessions (another tab, an administrator) leave the app immediately.

## Authorization
- Route guard: every shell route requires a session. A signed-in user without the route's permission
  stays on the URL and sees `PermissionDeniedState` (required permission, role, Back, Request access),
  recorded once as `auth_access_denied`.
- Restricted actions explain themselves (e.g. strategy review: “Activation requires a Pricing Manager.”).
- Navigation groups Deployment and Settings under **Administration**.

## Administration (Settings → Access)
| Section | What it does |
|---|---|
| Identity & SSO | Provider, protocol, verified domains, entity id, redirect URI, certificate expiry, SCIM status; editable IdP group → role mapping, fallback role (or no access), unmapped-group warning. Saves `auth_sso_config_changed`. |
| Users | Directory users with workspaces, resolved role, status and last sign-in; deprovision / reactivate (blocks sign-in immediately). Saves `auth_user_deprovisioned` / `auth_user_provisioned`. |
| Roles & permissions | Moved here from Governance. |
| Sessions | Current session details, other active sessions, revoke (own session → signed out). Saves `auth_session_revoked`. |
| Security | Moved here from Governance. |

Non-admins see every Access section read-only.

## Audit events
`auth_sign_in`, `auth_sign_out`, `auth_sso_failed`, `auth_access_denied`, `auth_role_changed`,
`auth_workspace_switched`, `auth_session_revoked`, `auth_sso_config_changed`, `auth_user_provisioned`,
`auth_user_deprovisioned` — source `sso`, entity type `user`. Sign-in happens before the demo data is
seeded, so events wait in the auth store and merge into the audit log on bootstrap.

## Demo accounts
`rina@mesta.id` (analyst) · `budi@mesta.id` (manager, three workspaces across two organizations) ·
`andre@mesta.id` · `sari@mesta.id` · `dewi@mesta.id` · `tono@mestadist.co.id` (Okta/SAML) ·
`former@mesta.id` (deprovisioned) · `name@mestagroup.com` (two organizations) ·
`x@nusantaramart.co.id` (organization without SSO). The developer role switcher stays in the profile
menu under “Developer tools”.

## Tests
- `tests/auth.test.ts` — safe redirects, discovery, callback validation (state, signature, replay,
  nonce/identity), error mapping, deprovisioning, workspaces, tenant isolation, role resolution with
  admin overrides, logout, expiry/revocation.
- `e2e/auth.spec.ts` — deep link → login → IdP → deep link, unknown/unconfigured orgs, unsafe
  returnTo, multi-workspace, forged/denied responses, deprovisioned account, sign-out, in-place
  permission denial, Settings → Access admin actions, read-only for non-admins.
- `e2e/a11y.spec.ts` — axe on the sign-in flow (light/dark) and the new Settings sections.
- `e2e/helpers.ts#open` seeds a valid session for the requested role.
