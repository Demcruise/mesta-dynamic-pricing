import { expect, test } from '@playwright/test';
import { go, open } from './helpers';

test('analyst: catalog → simulation → send → approve → audit', async ({ page }) => {
  await open(page, '/catalog');
  await page.getByRole('searchbox', { name: 'Search SKU or name' }).fill('SKU-1004');
  await expect(page.getByRole('link', { name: 'SKU-1004' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Simulate price SKU-1004' }).click();

  await expect(page.getByRole('heading', { name: 'Simulation' })).toBeVisible({ timeout: 15_000 });
  const price = page.locator('#price-0');
  const current = Number(await price.inputValue());
  await price.fill(String(current + 1000));
  await page.getByRole('button', { name: 'Send to Recommendations' }).click();
  await expect(page.getByText(/Sent as REC-S/)).toBeVisible();
  const recId = (await page.getByText(/Sent as REC-S\d+/).first().textContent())!.match(/REC-S\d+/)![0];

  await go(page, `/recommendations/${recId}`);
  await expect(page.getByRole('heading', { name: recId })).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await expect(page.locator('article header').getByText('Approved')).toBeVisible({ timeout: 15_000 });

  await go(page, '/audit');
  await expect(page.getByRole('button', { name: /Details AUD-/ }).filter({ hasText: 'Recommendation approved' }).first()).toBeVisible();
});

test('analyst: reject needs a note and undo leaves the item pending', async ({ page }) => {
  await open(page, '/recommendations');
  const card = page.locator('article').first();
  await card.getByRole('button', { name: 'Reject' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A note is required.' })).toBeVisible();
  await page.getByLabel('Note (required)').fill('data looked stale');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(card.getByRole('button', { name: 'Approve' })).toBeEnabled();
});
