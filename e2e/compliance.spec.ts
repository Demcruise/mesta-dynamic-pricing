import { expect, test } from '@playwright/test';
import { go, open } from './helpers';

test('compliance: audit and export visible, no write actions, blocked routes explain the missing permission', async ({ page }) => {
  await open(page, '/catalog', 'compliance');
  await expect(page.getByRole('button', { name: /Override price/ })).toHaveCount(0);
  await go(page, '/audit');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await go(page, '/deployment');
  // AUTH-09: forbidden routes keep the URL and explain the missing permission in place.
  await expect(page).toHaveURL(/\/deployment/);
  await expect(page.getByRole('heading', { name: "You don't have permission to open this page." })).toBeVisible();
  await expect(page.getByText('Required permission')).toBeVisible();
});
