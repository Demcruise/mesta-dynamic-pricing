import { expect, test, type Page } from '@playwright/test';
import { go, open } from './helpers';

const ROUTES = [
  '/overview', '/catalog', '/catalog/SKU-1004', '/strategy', '/strategy/new', '/simulation?sku=SKU-1004',
  '/recommendations', '/recommendations/REC-1000', '/deployment', '/monitoring', '/audit',
  '/data', '/exceptions', '/alerts', '/competitors', '/analytics',
];
const WIDTHS = [320, 768, 1024, 1440];

/** Text that is cut off (not intentionally truncated) inside controls, chips and labels. */
async function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const sel = 'button, a, label, th, [class*="rounded-full"], dt, h1, h2, h3';
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || el.offsetParent === null) continue;
      if (el.classList.contains('truncate') || el.closest('.truncate')) continue; // deliberate ellipsis
      if (el.classList.contains('sr-only')) continue; // visually hidden by design
      if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
        out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
      }
      const r = el.getBoundingClientRect();
      // control text spilling outside its own box
      if (['BUTTON', 'A'].includes(el.tagName) && el.scrollWidth > Math.ceil(r.width) + 1) {
        out.push(`${el.tagName.toLowerCase()} spill "${(el.textContent ?? '').trim().slice(0, 40)}"`);
      }
    }
    return out;
  });
}

for (const width of WIDTHS) {
  test(`Indonesian copy: no page overflow or clipped controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/overview', 'manager', 'id');
    const problems: string[] = [];
    for (const r of ROUTES) {
      await go(page, r);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${r}: page overflows by ${overflow}px`);
      for (const c of await clipped(page)) problems.push(`${r}: ${c}`);
    }
    expect(problems).toEqual([]);
  });
}
