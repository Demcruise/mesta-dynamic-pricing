import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('@smoke keyboard: Ctrl+K search → open SKU → back', async ({ page }) => {
  await open(page, '/overview');
  // Retry until hydrated — the global keydown listener mounts after first paint.
  for (let i = 0; i < 5 && !(await page.getByRole('dialog').isVisible()); i++) {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
  }
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = page.getByRole('combobox', { name: 'Search or jump to…' });
  await box.fill('RULE-001');
  await expect(page.getByRole('option', { name: /RULE-001/ }).first()).toBeVisible();
  await box.fill('EXP-002');
  await expect(page.getByRole('option', { name: /EXP-002/ }).first()).toBeVisible();
  await box.fill('SKU-1004');
  await expect(page.getByRole('option', { name: /SKU-1004/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/catalog\/SKU-1004/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /SKU-1004/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/overview/);
});

test('@smoke overview renders KPIs without horizontal overflow', async ({ page }) => {
  await open(page, '/overview');
  await expect(page.getByRole('region', { name: 'Key metrics' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
