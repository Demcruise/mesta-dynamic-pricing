/**
 * AUTH-01 / AUTH-19 — `returnTo` validation. Only same-origin application paths are allowed:
 * a single leading slash, no scheme or protocol-relative prefix, no backslashes or control
 * characters, and never an auth route (which would loop). Anything else falls back to the default.
 */
export const DEFAULT_DESTINATION = '/overview';

const AUTH_PREFIXES = ['/login', '/auth', '/workspaces'];

export function safeReturnTo(raw: string | null | undefined, fallback = DEFAULT_DESTINATION): string {
  if (!raw) return fallback;
  let value: string;
  try {
    value = decodeURIComponent(raw).trim();
  } catch {
    return fallback;
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;
  // Resolve against a dummy origin: anything that changes origin (or normalises away) is rejected.
  try {
    const url = new URL(value, 'https://mesta.invalid');
    if (url.origin !== 'https://mesta.invalid') return fallback;
    const path = url.pathname + url.search + url.hash;
    if (AUTH_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
