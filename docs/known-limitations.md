# Known limitations (frontend MVP)

Everything here is deliberate or not yet done. Nothing below is hidden behind a passing test.

## Mock-only by design
- All data is generated in `lib/mock-data.ts` and lives in memory (Zustand). A full page reload resets it; the seed is deterministic.
- UI preferences, strategy drafts, catalog filter presets, feedback and command-menu recents persist in `localStorage`.
- Deployment is simulated: 700 ms latency, and some channels fail their first attempt (`willFail`), retries succeed.
- Roles are a dev switcher in the top bar. There is no authentication; RBAC is enforced in the actions layer (`lib/actions/*`), route guard and query selectors, but a real backend must enforce it again.
- The forecast model is constant elasticity with a fixed 1,000 units/month baseline (disclosed on the Simulation page).

## Not done or not verified
- **Storybook** is not set up. `/design-system` is an in-app reference instead (props, states, a11y notes, do/don't, decision guide).
- **Visual regression baselines** are not captured.
- **Automated axe / Lighthouse audits were not run.** Covered instead: WCAG AA contrast of every token pair in both themes (`tests/a11y-contrast.test.ts`), semantic tables with captions and `scope`, `role="meter"`, native `<dialog>` focus trapping, `prefers-reduced-motion`, keyboard flows in Playwright. A manual screen-reader pass has not been done.
- **Catalog virtual table has no jsdom component test** (jsdom has no layout, so the virtualizer renders nothing). Virtualization was verified in a real browser with 5,000 SKUs (`/catalog?skus=5000`, ~18 rows in the DOM) and filter+sort of 5,000 rows is benchmarked in unit tests.
- **Indonesian string-length QA** for overflow was not done systematically.
- Playwright uses the system Chrome (`channel: 'chrome'`) because the bundled Chromium build did not match the installed Playwright version.
- `React Bits Pro` blocks are registered in `components.json` but no block is installed (needs a licence token).

## Behaviours worth knowing
- Approve/reject/adjust are staged for 10 seconds; closing the tab during that window drops the decision (no audit event is written).
- Bulk approve applies immediately (no undo) and skips stale or guardrail-breaching items.
- Recommendation staleness = product price changed, or a newer competitor observation exists, since the recommendation was created.
- `useAuditLog` filters by `actorId` and owned SKUs for analysts. `ownedSkuIds` is empty for all mock users, so analysts see only their own actions.
