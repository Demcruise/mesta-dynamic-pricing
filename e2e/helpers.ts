import { expect, type Page } from '@playwright/test';
import { can, PERMISSIONS, type Action } from '../lib/rbac';

export type RoleKey = 'analyst' | 'manager' | 'approver' | 'ops_lead' | 'compliance';

const PEOPLE: Record<RoleKey, { userId: string; name: string; email: string }> = {
  analyst: { userId: 'u-analyst-1', name: 'Rina Analyst', email: 'rina@mesta.id' },
  manager: { userId: 'u-manager-1', name: 'Budi Manager', email: 'budi@mesta.id' },
  approver: { userId: 'u-approver-1', name: 'Andre Finance', email: 'andre@mesta.id' },
  ops_lead: { userId: 'u-ops-1', name: 'Sari Ops', email: 'sari@mesta.id' },
  compliance: { userId: 'u-compliance-1', name: 'Dewi Compliance', email: 'dewi@mesta.id' },
};

/** A signed-in SSO session for `role`, as the auth service would persist it after /auth/callback. */
export function sessionFor(role: RoleKey) {
  const now = Date.now();
  return {
    sessionId: `sess_e2e_${role}`, ...PEOPLE[role], organizationId: 'org-mesta-retail', organizationName: 'Mesta Retail',
    workspaceId: 'ws-retail-jkt', role, permissions: (Object.keys(PERMISSIONS) as Action[]).filter((a) => can(role, a)),
    identityProvider: 'Microsoft Entra ID', sessionCreatedAt: new Date(now).toISOString(), sessionExpiry: new Date(now + 8 * 3_600_000).toISOString(),
  };
}

/** English UI, fresh demo data and a valid session for `role` in every test. */
export async function open(page: Page, path: string, role: RoleKey = 'analyst', locale: 'en' | 'id' = 'en') {
  await page.addInitScript(([l, session]) => {
    localStorage.setItem('mesta-ui', JSON.stringify({ state: { density: 'comfortable', theme: 'light', locale: l, sidebarCollapsed: false }, version: 0 }));
    // Only seed once per test so sign-out / revocation inside a test is not undone by a reload.
    if (!sessionStorage.getItem('e2e-seeded')) {
      localStorage.setItem('mesta-auth', JSON.stringify({ state: { session, revoked: [], events: [] }, version: 1 }));
      sessionStorage.setItem('e2e-seeded', '1');
    }
  }, [locale, sessionFor(role)] as const);
  await page.goto(path);
  // Demo-data bootstrap + on-demand route compile can exceed the default 5s under parallel load.
  await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
}

export async function setRole(page: Page, role: RoleKey) {
  // Dev role switcher lives in the sidebar profile card (desktop) and the topbar
  // user menu (all viewports). Prefer the profile card; fall back to the user menu
  // (the Next.js dev overlay can cover the bottom-left trigger at md widths).
  const profile = page.getByLabel(/Account menu|Menu akun/);
  const userMenu = page.getByLabel(/User menu|Menu pengguna/);
  const sel = page.getByLabel(/Switch role|Ganti peran/);
  for (let attempt = 0; attempt < 4 && !(await sel.isVisible()); attempt++) {
    try {
      await profile.click({ timeout: 3_000 });
    } catch {
      await userMenu.click();
    }
    await page.waitForTimeout(200);
  }
  await sel.selectOption(role);
  await page.keyboard.press('Escape');
}

/** Client-side navigation keeps in-memory store state; a full reload would reset the demo data. */
export async function go(page: Page, path: string) {
  await page.evaluate((p) => (window as unknown as { next: { router: { push: (x: string) => void } } }).next.router.push(p), path);
  await page.waitForURL(`**${path.split('?')[0]}*`);
}
