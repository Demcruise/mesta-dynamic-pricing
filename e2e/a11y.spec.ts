import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { go, open } from './helpers';

const ROUTES = [
  '/overview', '/catalog', '/catalog/SKU-1004', '/strategy', '/strategy/new', '/simulation?sku=SKU-1004',
  '/rules', '/guardrails', '/approvals',
  '/recommendations', '/recommendations/REC-1000', '/deployment', '/monitoring', '/audit',
  '/data', '/exceptions', '/alerts', '/competitors', '/analytics', '/experiments', '/settings',
  '/settings/identity-sso', '/settings/users', '/settings/sessions',
];

async function violations(page: Page, label: string): Promise<string[]> {
  const res = await new AxeBuilder({ page })
    .options({
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      // axe ships this rule disabled (tagged `experimental`) even though it maps to
      // WCAG 2.5.3, so a visible label missing from the accessible name would ship.
      rules: { 'label-content-name-mismatch': { enabled: true } },
    })
    .analyze();
  return res.violations.map((v) => `[${label}] ${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const theme of ['light', 'dark'] as const) {
  test(`axe: every route has no WCAG A/AA violations (${theme})`, async ({ page }) => {
    // One axe pass per route is cumulative; 21 routes × nav+settle+scan needs headroom
    // beyond the shared 60s budget (heavier routes pushed it past 120s under load).
    test.setTimeout(240_000);
    await open(page, '/overview', 'manager');
    if (theme === 'dark') {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    }
    const found: string[] = [];
    for (const r of ROUTES) {
      await go(page, r);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForTimeout(600);
      // Client nav streams <title> async — axe's document-title rule needs it settled.
      await expect.poll(async () => (await page.title()).length, { timeout: 5_000 }).toBeGreaterThan(0);
      found.push(...(await violations(page, `${theme} ${r}`)));
    }
    expect(found).toEqual([]);
  });
}

test('axe: open dialogs and menus (command menu, override dialog, notifications, glossary)', async ({ page }) => {
  const found: string[] = [];
  await open(page, '/catalog');
  // Retry until hydrated — the global keydown listener mounts after first paint.
  for (let i = 0; i < 5 && !(await page.getByRole('dialog').isVisible()); i++) {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
  }
  await expect(page.getByRole('dialog')).toBeVisible();
  found.push(...(await violations(page, 'command menu')));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Override price SKU-/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  found.push(...(await violations(page, 'override dialog')));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open glossary' }).click();
  found.push(...(await violations(page, 'glossary')));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /Open notifications/ }).click();
  found.push(...(await violations(page, 'notifications')));
  expect(found).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: sign-in flow has no WCAG A/AA violations (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((t) => {
      localStorage.setItem('mesta-ui', JSON.stringify({ state: { density: 'comfortable', theme: t, locale: 'en', sidebarCollapsed: false }, version: 0 }));
    }, theme);
    const found: string[] = [];
    const scan = async (label: string) => { await page.waitForTimeout(400); found.push(...(await violations(page, `${theme} ${label}`))); };
    await page.goto('/login?expired=1');
    await expect(page.getByLabel('Work email')).toBeVisible({ timeout: 20_000 });
    await scan('/login expired');
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await scan('/login required');
    await page.getByLabel('Work email').fill('x@mestagroup.com');
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await expect(page.getByText('We found multiple workspaces')).toBeVisible();
    await scan('/login multiple');
    await page.goto('/login');
    await page.getByLabel('Work email').fill('budi@mesta.id');
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await expect(page.getByText('Mesta Retail').first()).toBeVisible();
    await scan('/login resolved');
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await expect(page.getByRole('button', { name: 'Approve sign-in' })).toBeVisible({ timeout: 20_000 });
    await scan('/auth/idp');
    await page.getByRole('button', { name: 'Approve sign-in' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 20_000 });
    await scan('/workspaces');
    await page.goto('/auth/error?reason=provider_unavailable');
    await expect(page.getByText("We couldn't complete sign-in.")).toBeVisible({ timeout: 20_000 });
    await scan('/auth/error');
    expect(found).toEqual([]);
  });
}
