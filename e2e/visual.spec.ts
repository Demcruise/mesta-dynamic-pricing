import { expect, test } from '@playwright/test';
import { go, open } from './helpers';

/**
 * Visual regression baseline: the /design-system page renders every primitive and
 * pattern statically, so screenshots are deterministic across runs (seeded mock
 * data, no time-dependent content). Rebaseline with --update-snapshots when a
 * design change is intentional.
 */
const SECTIONS = [
  'ds-PriceValue', 'ds-DeltaBadge', 'ds-ConfidenceBar', 'ds-Sparkline',
  'ds-AgentBorderCard', 'ds-AgentRunTimeline', 'ds-RationaleBreakdown',
  'ds-StatusChip', 'ds-SeverityChip / LiveDot', 'ds-MestaDataTable',
  'ds-Drawer / Dialog', 'ds-Field / Input', 'ds-RoleGate', 'ds-OnboardingChecklist',
  'ds-TopMoversPanel', 'ds-Charts (ChartWithTable)',
  'ds-KpiCard / PageHeader / EmptyState / LoadingRows / PageSkeleton', 'ds-Button',
  'ds-blocks', 'ds-guide',
];

for (const theme of ['light', 'dark'] as const) {
  test(`design system primitives match baseline (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, '/overview', 'manager');
    if (theme === 'dark') {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    }
    await go(page, '/design-system');
    await expect(page.getByRole('main')).toBeVisible();
    for (const id of SECTIONS) {
      const section = page.locator(`section[aria-labelledby="${id}"]`);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toHaveScreenshot(`${id.replaceAll(' ', '-').replaceAll('/', '-')}-${theme}.png`, {
        animations: 'disabled',
        caret: 'hide',
      });
    }
  });
}
