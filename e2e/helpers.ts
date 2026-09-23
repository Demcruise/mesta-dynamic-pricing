import { expect, type Page } from '@playwright/test';

export type RoleKey = 'analyst' | 'manager' | 'approver' | 'ops_lead' | 'compliance';

/** English UI and fresh demo data for every test. */
export async function open(page: Page, path: string, role: RoleKey = 'analyst', locale: 'en' | 'id' = 'en') {
  await page.addInitScript((l) => {
    localStorage.setItem('mesta-ui', JSON.stringify({ state: { density: 'comfortable', theme: 'light', locale: l, sidebarCollapsed: false }, version: 0 }));
  }, locale);
  // Switch role on a page every role may open, then navigate client-side (route guard would redirect otherwise).
  await page.goto(role === 'analyst' ? path : '/overview');
  // Demo-data bootstrap + on-demand route compile can exceed the default 5s under parallel load.
  await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
  if (role !== 'analyst') {
    await setRole(page, role);
    if (path !== '/overview') await go(page, path);
  }
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
