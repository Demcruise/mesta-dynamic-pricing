import { expect, test } from '@playwright/test';
import { go, open } from './helpers';

test('manager: activate strategy, bulk approve, verify audit', async ({ page }) => {
  await open(page, '/strategy', 'manager');
  const card = page.locator('li', { hasText: 'Snack competitor match' });
  await card.getByRole('button', { name: 'Approve activation' }).click();
  await expect(card.getByText('Active', { exact: true })).toBeVisible();

  await go(page, '/recommendations');
  await page.getByRole('button', { name: 'Bulk actions' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/recommendations will be approved/)).toBeVisible();
  await dialog.getByRole('button', { name: /^Approve \d+$/ }).click();
  await expect(page.getByText(/recommendations approved/)).toBeVisible();

  await go(page, '/audit');
  await expect(page.getByRole('button', { name: /Details AUD-/ }).filter({ hasText: 'Strategy activated' }).first()).toBeVisible();
});
