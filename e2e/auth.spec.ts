import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

/** Enterprise SSO (AUTH-01…32): discovery, IdP round trip, workspaces, guards, logout, admin. */

async function english(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mesta-ui', JSON.stringify({ state: { density: 'comfortable', theme: 'light', locale: 'en', sidebarCollapsed: false }, version: 0 }));
  });
}

async function continueWith(page: Page, email: string) {
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Continue with SSO' }).click();
}

test.describe('sign-in', () => {
  test.beforeEach(async ({ page }) => english(page));

  test('protected route → login → IdP → back to the original deep link @smoke', async ({ page }) => {
    await page.goto('/catalog?category=Dairy');
    await page.waitForURL('**/login?returnTo=*', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Sign in to Mesta' })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await expect(page.getByText('Enter your work email address.')).toBeVisible();

    await continueWith(page, '  Rina@Mesta.id ');
    await expect(page.getByText('Mesta Retail').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await page.waitForURL('**/auth/idp?*');
    expect(page.url()).not.toContain('org-');
    await page.getByRole('button', { name: 'Approve sign-in' }).click();
    await page.waitForURL('**/catalog?category=Dairy', { timeout: 30_000 });
    await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
  });

  test('unknown and unconfigured organizations get a clear message', async ({ page }) => {
    await page.goto('/login');
    await continueWith(page, 'someone@unknown.org');
    await expect(page.getByText("We couldn't identify your organization from this email address.")).toBeVisible();
    await continueWith(page, 'ops@nusantaramart.co.id');
    await expect(page.getByText('Your organization is not configured for Mesta SSO.')).toBeVisible();
  });

  test('unsafe returnTo is ignored; multi-workspace users choose a workspace', async ({ page }) => {
    await page.goto('/login?returnTo=https://malicious-site.com');
    await continueWith(page, 'budi@mesta.id');
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await page.getByRole('button', { name: 'Approve sign-in' }).click();
    await page.waitForURL('**/workspaces', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.getByRole('button', { name: /Bandung/ }).click();
    await page.waitForURL('**/overview', { timeout: 30_000 });
    expect(page.url()).not.toContain('malicious');
  });

  test('a forged or denied IdP response never creates a session', async ({ page }) => {
    await page.goto('/auth/callback?state=forged&code=abc.def');
    await page.waitForURL('**/auth/error?reason=invalid_response', { timeout: 30_000 });
    await expect(page.getByText('The sign-in response could not be verified. Start sign-in again.')).toBeVisible();

    await page.goto('/login');
    await continueWith(page, 'rina@mesta.id');
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await page.getByRole('button', { name: 'Simulate provider outage' }).click();
    await page.waitForURL('**/auth/error?reason=provider_unavailable');
    await page.goto('/overview');
    await page.waitForURL('**/login?returnTo=*', { timeout: 30_000 });
  });

  test('deprovisioned accounts are blocked at callback', async ({ page }) => {
    await page.goto('/login');
    await continueWith(page, 'former@mesta.id');
    await page.getByRole('button', { name: 'Continue with SSO' }).click();
    await page.getByRole('button', { name: 'Approve sign-in' }).click();
    await page.waitForURL('**/auth/error?reason=account_disabled', { timeout: 30_000 });
    await expect(page.getByText('Your Mesta access has been disabled.')).toBeVisible();
  });
});

test.describe('signed in', () => {
  test('sign out ends the session and protects routes again', async ({ page }) => {
    await open(page, '/overview');
    await page.getByLabel('User menu').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.waitForURL('**/login?signedOut=1', { timeout: 30_000 });
    await expect(page.getByText('You have signed out of Mesta.')).toBeVisible();
    await page.goto('/strategy');
    await page.waitForURL('**/login?returnTo=%2Fstrategy', { timeout: 30_000 });
  });

  test('forbidden routes show an in-place permission state', async ({ page }) => {
    await open(page, '/overview', 'compliance');
    await page.goto('/strategy/new');
    await expect(page.getByRole('heading', { name: "You don't have permission to open this page." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Required permission')).toBeVisible();
  });

  test('administrators manage SSO mapping, users and sessions in Settings → Access', async ({ page }) => {
    await open(page, '/settings/identity-sso', 'manager');
    await expect(page.getByRole('heading', { name: 'Identity & SSO' })).toBeVisible();
    await expect(page.getByText('OpenID Connect')).toBeVisible();
    await page.getByLabel('Mesta role — compliance').selectOption('analyst');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('SSO configuration saved')).toBeVisible();

    await page.goto('/settings/users');
    const row = page.getByRole('row', { name: /Tono Distribution/ });
    await row.getByRole('button', { name: 'Deprovision' }).click();
    await expect(row.getByText('Deprovisioned')).toBeVisible();

    await page.goto('/settings/sessions');
    const other = page.getByRole('row', { name: /Sari Ops/ });
    await other.getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
    await expect(other.getByText('Revoked')).toBeVisible();

    await page.goto('/audit');
    await expect(page.getByText(/SSO configuration changed|auth_sso_config_changed/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('non-admins see access settings read-only', async ({ page }) => {
    await open(page, '/settings/users', 'analyst');
    await expect(page.getByText('Managed by Workspace Admin')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deprovision' }).first()).toBeDisabled();
  });
});
