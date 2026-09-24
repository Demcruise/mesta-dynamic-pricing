# Design-system audit — Vestra reference alignment (2026-09-24)

Scope: the six asks from the review (Overview KPI cards, the margin trend chart card, Overview layout and colour,
pill badges, the SKU Catalog table, and a full audit), measured against the live reference
`vestra-dashboard01.vercel.app`. The raw reference capture and every colour mapping/deviation is in
[`vestra-reference-tokens.json`](./vestra-reference-tokens.json).

## 1. Foundations (applies to every page)

| Area | Before | After |
|---|---|---|
| Palette | Mesta-invented greys, `#2f5bea` brand, heavy borders `#d9dde5` | Reference palette from its live CSS: white page/card, `#f8f8f8` sidebar, 6%-alpha card edge, `#2563eb` action blue, `#f7f7f8` table head, 4% row bands |
| Gain / loss | `#0f7a3d` / `#b42318` | Reference hues: `#00B36A` / `#F14D6E` for graphics; same hue darkened to `#007f4c` / `#c42748` for text (AA) |
| Type | System font fallback (Inter was never loaded); figures in IBM Plex Mono | Inter Variable self-hosted; figures in Inter tabular numerals like the reference; mono kept as opt-in `.mono` |
| Radius | 10px cards, 6px controls | 8 row · 10 control · 12 card · 16 panel · full pill |
| Elevation | Drop shadow on every card | Flat, 1px edge only (reference); shadow reserved for popovers/modals |
| Page frame | 24px padding, `#f7f8fa` page | 28px inline / 16px top / 48px bottom, white page |
| Buttons | Solid brand, `opacity` hover | Reference CTA: brand fill, hairline light border, inset top highlight, `brand-hover` |
| Toggles | Toggled filters rendered as primary (blue) buttons, competing with real CTAs | New `selected` variant (soft brand) + `Segmented` control for either/or switches |
| Contrast | — | Every text pair re-verified AA in light and dark (`tests/a11y-contrast.test.ts`); reference `#94a3b8`/`#64748b` faint text would fail, so faint is `#5f6b7e` |

## 2. Overview

- **KPI cards** now use the reference metric-card anatomy: fixed 152px, 20px icon tile + 12px label, definition
  trigger right, 28px figure, delta line (coloured arrow + %, then "vs previous period"), 58×26 sparkline with
  gradient fill bottom-right. Delta and sparkline are coloured by **sentiment**, not direction (`polarity`):
  fewer anomalies is a green ↓, more pending approvals is a red ↑.
- **Average margin trend** is rebuilt as the reference "Total Portfolio Value" hero card: 16px radius, 36px padding
  on desktop, 26px icon box + muted title, 36px bold headline, reference "Weekly ▾" control and a segmented
  Chart/Data table switch top-right; smooth monotone line (2.5px) over a 14%→0 gradient area, grid lines only,
  12px axis labels, latest-point marker, hover/keyboard crosshair with tooltip.
- **Layout**: one 12px gap everywhere (reference `gap-3`); KPI grid 1→2→3/4 columns by count (no orphan card);
  12-column body (chart 8 / aside 4); every section is the same `Panel` (icon box, title, actions) with reference
  row bands for list items; setup checklist became a compact tile grid; persona picker uses row bands + icons.
- **Fixed**: the three Approver KPIs rendered raw i18n keys (`overview.kpi.awaitingExecutive` …).

## 3. Pills / badges

- New `Pill` primitive (`components/ds/Pill.tsx`): fixed height per size (20 / 24px), full radius, no wrap,
  icon + label centred, nine tones. `StatusBadge`, `StatusChip`, `SeverityChip` and `DeltaBadge` now build on it.
- 20 hand-rolled `rounded-full` spans across 13 files (approval chain, notifications, command menu, filter counts,
  rule conditions, guardrail flags, queue tabs/chips, experiments, competitors, strategy SKU chips, sidebar
  counters) migrated to `Pill`/`pillCls`; strategy status now uses the shared `StatusBadge`.
- Neutral pills are outlined (not filled) so they stay legible on tinted row bands.
- Any pill inside a table cell is forced to the compact size (CSS), so row height never depends on the call site.

## 4. SKU Catalog table

Reference "Holdings" spacing: header band (40px, 8px radius), separated row bands (8px radius, 6px gap), 10px cell
inset, 11px/600 headers, 12px/500 cells.

- Product column = 32px icon box + name (13px/600) + category line; standalone Category column hidden by default
  (still sortable via the column menu).
- Every numeric column is a two-line stack (figure over context) and right-aligned with its header:
  competitor avg + gap, margin bar + % + health, stock + status, date + relative time. Nothing wraps or clips
  (previously "IDR 49,600" was cut to "R 49,600" and "Personal Care" wrapped).
- Sort arrow shows only on the active column (and on hover), placed so right-aligned labels stay flush with figures.
- Row heights: 56px comfortable / 44px compact (two-line cells); other tables default to 48 / 40.
- Density switch and table toolbar buttons use the new control styling.

## 5. Full audit — other findings fixed

| Page | Finding | Fix |
|---|---|---|
| All tables (13 hand-built) | Each had its own header tint, row borders, text size | `mesta-table` class gives them the same grammar as `MestaDataTable` |
| Recommendations | Filter selects rendered full-width and stacked (`w-full` beat the `w-44` override) | All `inputCls` overrides routed through `cn()` (tailwind-merge) in 8 files |
| Recommendations | Two dropdowns both read "Confidence" (filter vs sort) | Sort options prefixed "Sort by:" |
| Tables | Group-by select read only "None" | Prefixed "Group by:" |
| Analytics | KPI titles never rendered (whole label was inside the "?" trigger) | Title shown; definition moved to the trigger; hint to the comparison line |
| Monitoring | X-axis ids overlapped; two columns both labelled "Source" | Width-aware, collision-free axis labels; columns "Origin" / "Linked record" |
| Simulation | Scenario comparison values overlapped their bars | Auto-sized value column |
| SKU detail / drawer / rec card | Legacy flat sparkline | Reference sparkline with gradient |
| Sidebar | "Recommendations" truncated next to its count | 240px width, 13px items, 8px radius |
| Axe (WCAG 2.2) | KPI label links and sort buttons under 24px target; inline record links distinguished by colour only; destructive button text 3.2:1 in dark | 24px min targets; underlined inline links; theme-aware destructive foreground |
| Dark mode | Native checkboxes/selects stayed light | `color-scheme` per theme |

## 6. Verification

- `tsc --noEmit` clean · 250/250 unit tests (incl. token contrast, token-compliance, i18n key hygiene)
- Playwright: persona flows, keyboard, axe WCAG A/AA on every route in light and dark plus open dialogs,
  Indonesian copy at 320/768/1024/1440px with no overflow or clipping, visual baselines regenerated for the new design.

## 7. Not done / follow-ups

- Recommendation card grid keeps uneven card heights in a two-column grid (content-dependent); a masonry or
  single-column list is a product decision.
- The reference uses 10px table headers; Mesta keeps 11px for legibility at enterprise density.
- Charts beyond the Overview hero and Monitoring (Simulation demand curve) still use their own renderer.
