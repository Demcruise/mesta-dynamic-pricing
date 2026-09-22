import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { go, open } from './helpers';

const ROUTES = [
  '/overview', '/catalog', '/catalog/SKU-1004', '/strategy', '/strategy/new', '/simulation?sku=SKU-1004',
  '/rules', '/guardrails', '/approvals',
  '/recommendations', '/recommendations/REC-1000', '/deployment', '/monitoring', '/audit', '/design-system',
];

async function violations(page: Page, label: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return res.violations.map((v) => `[${label}] ${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const theme of ['light', 'dark'] as const) {
  test(`axe: every route has no WCAG A/AA violations (${theme})`, async ({ page }) => {
    // One axe pass per route is cumulative; heavier routes (rule-eval table, publish jobs)
    // pushed the sweep past the shared 60s budget.
    test.setTimeout(120_000);
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
