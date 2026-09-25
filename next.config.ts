import type { NextConfig } from 'next';

/**
 * Baseline security headers (Lighthouse "Best Practices"). A Content-Security-Policy is
 * deliberately omitted: it needs a real policy for the deployed origin and a strict one
 * would break the dev server's inline scripts. HSTS is likewise pointless over plain HTTP.
 */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // SSO uses full-page redirects, never popups, so the window can be isolated from other origins.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
