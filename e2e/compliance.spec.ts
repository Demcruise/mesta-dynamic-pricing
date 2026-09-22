import { expect, test } from '@playwright/test';
import { go, open } from './helpers';

test('compliance: audit and export visible, no write actions, blocked routes redirect', async ({ page }) => {
  await open(page, '/catalog', 'compliance');
  await expect(page.getByRole('button', { name: /Override price/ })).toHaveCount(0);
  await go(page, '/audit');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await go(page, '/deployment');
  await expect(page).toHaveURL(/\/overview/);
  await expect(page.getByRole('status').filter({ hasText: 'do not have permission' })).toBeVisible();
});
