import { expect, test } from '@playwright/test';
import { go, open } from './helpers';

test('ops: deploy an approved change, retry failures, audit records success', async ({ page }) => {
  await open(page, '/deployment', 'ops_lead');
  await page.getByRole('button', { name: 'Deploy to all channels' }).first().click();
  // Publish Center: preflight dialog must confirm before channels fan out.
  await page.getByRole('button', { name: 'Publish to all channels' }).click();

  const retry = page.getByRole('button', { name: 'Retry' });
  await expect
    .poll(async () => {
      if (await retry.count()) await retry.first().click();
      return page.locator('tbody tr', { hasText: 'Failed' }).count();
    }, { timeout: 30_000 })
    .toBe(0);

  await go(page, '/audit');
  await expect(page.getByRole('button', { name: /Details AUD-/ }).filter({ hasText: 'Deployment succeeded' }).first()).toBeVisible({ timeout: 15_000 });
});
