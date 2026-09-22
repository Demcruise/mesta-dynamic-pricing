# components/blocks — React Bits Pro vendored blocks

Raw blocks installed from the `@reactbits-pro` registry (`pro.reactbits.dev`). These are
**UI accelerators, not production components**. Rules (backlog v4, Epic A.3):

1. Never import a raw `*-N.tsx` registry file from `features/` or `app/` — enforced by
   `tests/block-boundary.test.ts`.
2. Wrap each block in a Mesta component before use: either a domain wrapper here
   (e.g. `MestaDataTable.tsx`) or an extension of an existing `components/ds/*` primitive.
3. Theme hooks: blocks read `--rb-accent`, `--rb-accent-fg` and the `--rb-r-*` radius scale,
   all aliased to `styles/tokens.css` in `app/globals.css`. Dark mode works via
   `data-theme="dark"` (the `dark:` custom variant is patched to match it).
   Do not reintroduce raw hex or a `.dark` class dependency.
4. Re-run axe-core (`e2e/a11y.spec.ts`) on any route that adopts a block — blocks are not
   guaranteed WCAG AA out of the box.

## Installed inventory (Epic A.2)

| Block | File | Destination (per backlog v4) |
| --- | --- | --- |
| app-sidebar-1 | `app-sidebar-1.tsx` | Global shell (C.1) |
| app-shell-1 | `app-shell-1.tsx` | Global shell, optional all-in-one (C) |
| navbar-6 | `navbar-6.tsx` | TopBar (C.2) |
| command-menu-1 | `command-menu-1.tsx` | Global command menu (C.2) |
| data-table-1 | `data-table-1.tsx` | Catalog, Audit, Deployment (D.1) |
| agent-approval-2 | `agent-approval-2.tsx` | Recommendations, Audit (E.2, E.3) |
| agent-activity-2 | `agent-activity-2.tsx` | Recommendations (E.1) |
| tool-calls-1 | `tool-calls-1.tsx` | Recommendations evidence (E.1) |
| agent-plan-1 | `agent-plan-1.tsx` | Bulk approval plan, Strategy (E.3, E.4) |
| dashboard-1 | `dashboard-1.tsx` | Overview (F.1, F.2) |
| analytics-2 | `analytics-2.tsx` | Simulation, Overview (F.4) |
| monitoring-1 | `monitoring-1.tsx` | Monitoring (F.5) |
| card-9 | `card-9.tsx` | Catalog SKU detail (G.1) |
| wizard-5 | `wizard-5.tsx` | Strategy builder (G.2) |
| integrations-6 | `integrations-6.tsx` | Deployment status board (G.3) |
| list-3 | `list-3.tsx` | Audit timeline, side panels (F.3, G.4) |
| filtering-3 | `filtering-3.tsx` | Catalog/Recommendations/Audit filters (G.5) |
| notifications-1 | `notifications-1.tsx` | Toast stack + notification center (H.2) |
| empty-state-1 | `empty-state-1.tsx` | All list/table pages (H.4) |
| app-dialog-6 | `app-dialog-6.tsx` | Drawers/sheets, row detail (D.3, E.3) |
| onboarding-3 | `onboarding-3.tsx` | Overview first-run checklist (I.2) |

Install more: `REACTBITS_LICENSE_KEY` must be in `.env.local`, then
`npx shadcn@latest add @reactbits-pro/<name>`. Registry config lives in `components.json`.
