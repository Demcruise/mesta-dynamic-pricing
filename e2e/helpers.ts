import { expect, type Page } from '@playwright/test';

export type RoleKey = 'analyst' | 'manager' | 'ops_lead' | 'compliance';

/** English UI and fresh demo data for every test. */
export async function open(page: Page, path: string, role: RoleKey = 'analyst', locale: 'en' | 'id' = 'en') {
  await page.addInitScript((l) => {
    localStorage.setItem('mesta-ui', JSON.stringify({ state: { density: 'comfortable', theme: 'light', locale: l, sidebarCollapsed: false }, version: 0 }));
  }, locale);
  // Switch role on a page every role may open, then navigate client-side (route guard would redirect otherwise).
  await page.goto(role === 'analyst' ? path : '/overview');
  await expect(page.getByRole('main')).toBeVisible();
  if (role !== 'analyst') {
    await setRole(page, role);
    if (path !== '/overview') await go(page, path);
  }
}

export async function setRole(page: Page, role: RoleKey) {
  await page.getByLabel(/Switch role|Ganti peran/).selectOption(role);
}

/** Client-side navigation keeps in-memory store state; a full reload would reset the demo data. */
export async function go(page: Page, path: string) {
  await page.evaluate((p) => (window as unknown as { next: { router: { push: (x: string) => void } } }).next.router.push(p), path);
  await page.waitForURL(`**${path.split('?')[0]}*`);
}
