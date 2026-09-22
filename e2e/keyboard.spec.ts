import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('@smoke keyboard: Ctrl+K search → open SKU → back', async ({ page }) => {
  await open(page, '/overview');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox', { name: 'Search or jump to…' }).fill('SKU-1004');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/catalog\/SKU-1004/);
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
