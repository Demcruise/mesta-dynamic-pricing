# Combined backlog v11 — implementation notes (2026-09-25)

Source: `Mesta_Dynamic_Pricing_Combined_Backlog_v11_Settings.md` (Strategy, SKU table, Guardrails, AI Recommendations,
Approvals, Exceptions, Alerts, Monitoring, Signals, Audit, Enterprise Settings) plus the Mesta logo.

## Brand
- Real Mesta logo (neuron mark + wordmark) in `public/brand/` with dark-ink and light-ink variants, swapped by theme
  (`components/shell/MestaLogo.tsx`). Expanded sidebar shows mark + wordmark, the icon rail shows the mark, the phone
  top bar shows the mark; favicon/apple icon are generated from the mark (`app/icon.png`, `app/apple-icon.png`).

## Foundations (DS-001…005, TABLE-001…022, VIS-001, MON-025)
- Tokens (`styles/tokens.css`): spacing scale `--space-1…9`, control heights (32 / 40 / 44), table contract
  (header 48, row 56, identity row 72 — 44/56 compact, 16px cell inset, `--table-divider`), radius aliases, and a
  type scale exposed as `text-heading / section / body / body-sm / label / caption / numeric-lg / numeric-md`.
  `cn()` is taught these names so tailwind-merge keeps them.
- **Tables are one continuous surface now** (supersedes the 2026-09-24 Vestra row bands, per VIS-001): header band,
  1px dividers, fixed column tracks through a shared `<colgroup>` (`MestaDataTable` `width`/`defaultWidth`, and
  `.mesta-table` with `table-layout: fixed`). `.num` cells are right-aligned tabular, `rows-lg` gives 72px rows,
  scroll containers reserve the scrollbar gutter.
- Control system: every toolbar/filter control is 40px; form fields are 44px (`fieldInputCls`, `AffixInput`).
- Shared components: SKU cell family (`components/ds/sku.tsx`), `SkuIdentity`/`ProductIdentity` (36/32/28px tiles,
  one-line name + meta), `Money` (minus never detaches), `PriceMove` (3-slot price → price), `CellStack`,
  `FilterTabs` (tablist, counts, arrow keys, disabled zero tabs), `useQueryState` (filters in the URL),
  `ConstraintRange` + `explainBounds` (effective bounds as an explained intersection).
- Drawer: 480–560px (42vw) desktop, 70vw tablet, full width phone, 24px inset.
- `MetricDefinition` tooltips render in a portal: never clipped by tables, wrap inside a 320px frame, flip above,
  one open at a time, hover/focus peek, click pins, Escape/outside click closes.

## Pages
| Area | What changed |
|---|---|
| Catalog | Deterministic column model, 72px identity rows, shared SKU cells, 88×28 trend slot, 32px row actions with 8px gap and `…` overflow, category/cost hidden by default (column menu). |
| Strategy | 360px step rail + form card stretched to one row height, `StrategyStepNavigation` (completed / current / upcoming / blocked, text + glyph), 2-col 44px field grid with IDR/% adornments and helpers, pinned footer, `ConstraintRange` effective-bounds explainer with per-SKU preview, binding terms, Max()/Min() derivation, “No minimum / No maximum”, equal and invalid states, scope summary. |
| Guardrails | Sticky filter bar separate from the data scope, status tabs with counts, type / editability / source filters in the URL, clear filters, subgrid-aligned card anatomy (identical baselines per row), compact table mode, breach summary, constraint drawer (definition, behaviour, why / how to enable for not-modelled), “View N breaches →”, breach table with expected bound / actual / severity, SKU drawer with `ConstraintRange`. |
| Recommendations | No purple rail (AgentBorderCard is neutral), fixed slot anatomy, equal-height 2-col grid, actions pinned to the bottom in a stable order, evidence collapsed, compact stale/manager states, 3-column impact block, FilterTabs + Segmented view switch. |
| Approvals | Fixed-track queue (PriceMove, signed Money, awaiting role over chain progress, age folds into identity below xl), drawer uses the sectioned `panel` variant, full detail page in a 1200px container with the two-level `detail` card and constraint evidence. |
| Exceptions | One row grid for every kind (severity · type · product · context · age · action), fixed 32px icon slot, context slot per kind (PriceMove / REC id / counts), ages in words, stacked layout below xl, FilterTabs in the URL. |
| Alerts | Severity FilterTabs (All / Critical / Warning / Info with live scoped counts), sort preserved, scroll-to-top on change, `?severity=` deep links, row grid, filtered-empty state with “Show all alerts”. |
| Monitoring | Chart data tables and the SKU outcome table on fixed tracks with right-aligned tabular figures, reserved scrollbar gutter, Segmented metric/mode switches. |
| Signals | Central column model with fixed tracks, metric columns left-aligned per spec, SkuIdentity names, short one-idea tooltip copy in the portal popover. |
| Audit | One toolbar: grouped date range, Filters popover (Actor → Source → Event type, Reset / Cancel / Apply), SKU search with clear, low-emphasis Clear; removable active-filter chips; List/Timeline segmented control separate from exports; fixed event-table tracks; helpful filtered-empty state. |
| Settings | Rebuilt as an enterprise settings app — see below. |

## Enterprise settings (SET-001…046)
- `/settings/<slug>` deep links, persistent 240px nav grouped Personal · Workspace · Governance · System, settings
  search, section picker on narrow screens, 1280px content cap.
- Personal (autosave): preferences (theme, language, density, time zone, date / currency / number format, landing
  page), notification delivery (admin-mandated routes locked on), saved views across tables.
- Workspace: general identity, scope & hierarchy (labels, source, tree preview, default scope), pricing engine
  (rounding with live example, cadence, explicit engine behaviour per missing/conflicting input, model transparency),
  data & integrations (integration center from live sources, freshness warn/block policies, source of truth),
  approval policies (tiers, SLA, auto-approve, segregation of duties with live violation check), guardrail defaults
  with Workspace → Strategy → SKU inheritance and effective value, workflow defaults, alert routing matrix.
- Governance: roles & permissions matrix (grouped, overrides audited), audit retention and captured events,
  API credentials (masked, revoke with confirmation), security policy. System: feature controls with dependencies.
- Drafts per section survive navigation (unsaved dot in the nav, `beforeunload` guard), sticky Save/Discard bar,
  contextual validation, high-impact changes need a from → to confirmation with affected scope, every save writes a
  `settings_change` audit event and shows “Last changed by … · View audit event”, JSON export without secrets.
- Read-only for non-admins: values stay visible, controls are disabled with “Managed by Workspace Admin”
  (`settings.manage` = Manager, the Workspace Admin stand-in).

## Deliberate calls
- One 40px control height for every toolbar (the backlog asks 40 in some places, 44 in others); 44px is used for
  form fields.
- Signals metric columns are left-aligned because SIG-002…006 say so explicitly; other tables right-align figures.
- Settings persist per browser (demo workspace, like the existing policy overrides); credentials are fixtures.
