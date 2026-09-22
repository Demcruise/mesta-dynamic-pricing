# Enterprise backlog — gap analysis vs current implementation

Source backlog: `mesta_dynamic_pricing_enterprise_backlog.md` (Palantir AIP–derived, Blueprint-oriented).
Basis: current repo after the v4 polish backlog (Epics A–J, commits `60077a2`…`c4abd00`).

Per §29 of the backlog, items marked *recommended/inferred* were validated against the
actual data model (`lib/ontology.ts`), RBAC (`lib/rbac.ts`) and the existing routes.

Legend: ✅ exists · 🟡 partial / different shape · ❌ missing · ⚖️ decision required

---

## 1. Page inventory (§10)

| Backlog page | Current route | Status | Delta |
|---|---|---|---|
| P-01 Command Center | `/overview` | 🟡 | KPIs, movers, activity, onboarding exist. Missing: scope/date/freshness header, attention-category summary, health summary panel |
| P-02 Recommendations | `/recommendations` | 🟡 | Queue, facets, cards, bulk checklist, detail exist. Missing: attention categories (Needs Approval / High Impact / Blocked / Anomaly / Competitor / Data Quality / Publish Failure), owner column, rule-status column |
| P-03 Recommendation Detail | `/recommendations/[recId]` | 🟡 | Rationale, run timeline, guardrail verdict, adjust flow exist. Missing: per-rule evaluation drill-down (input→expected→actual→result), in-place price editor, pre-approve decision summary |
| P-04 Price Catalog | `/catalog` | ✅ | Virtualized table, filters, saved views, override dialog, SKU drawer, detail nav |
| P-05 Simulator | `/simulation` | 🟡 | Scenarios, comparison, demand curve + CI exist. Missing: competitor-impact outputs, break-even price, time horizon, explicit run states |
| P-06 Strategies | `/strategy` | 🟡 | List, wizard, versions, rollback exist. Missing: schedule, approval policy, signal/rule selectors |
| P-07 Rules | — | ❌ | No rule model at all. Current strategies carry guardrails only |
| P-08 Guardrails | inside `/strategy` | 🟡 | min/max, MAP, max-change, auto-approve threshold + `checkPrice` + GuardrailPreview. Missing: standalone center, more constraint types, PASS/WARN/BLOCK drill-down |
| P-09 Approvals | inside queue | 🟡 | Staged decisions + bulk approve exist. Missing: dedicated inbox, request-changes/delegate states, multi-level, expiration |
| P-10 Publish Center | `/deployment` | 🟡 | Per-channel deploy/retry, channel board, honest health metrics. Missing: job/batch model, scheduling, preflight, rollback, partial-failure |
| P-11 Monitoring | `/monitoring` | 🟡 | Anomalies, forecast-vs-actual, live strip, model feedback. Missing: service-health cards (data freshness, rule engine, jobs), alert center, anomaly anatomy |
| P-12 Audit Trail | `/audit` | ✅ | Timeline+table, filters, drawer, CSV, saved views |
| P-13 Data Sources | — | ❌ | No data-source model |
| P-14 Data Quality | — | ❌ | No quality metrics model |
| P-15 Competitors | inside SKU detail | 🟡 | Observations exist per SKU. Missing: workspace table (competitor × SKU × position) |
| P-16 Pricing Analytics | partial `/overview` | 🟡 | Margin trend, decision chart, movers. Missing: dedicated page + KPIs (price index, markdown, leakage, acceptance rate) |
| P-17 Experiments | — | ❌ | Net-new |
| P-18 Exceptions | partial | 🟡 | Stale/breach detection + excluded lists exist. Missing: dedicated queue, override-request workflow, override history page |
| P-19 Access Control | `lib/rbac.ts` | 🟡 | Action-level RBAC (4 roles) enforced in actions + routes. Missing: policy management UI |
| P-20 Onboarding | `/overview` checklist | 🟡 | 3-step checklist exists. Backlog wants 7-step setup + role-based entry + sample workspace |

## 2. Foundation epics

| Backlog item | Status | Delta |
|---|---|---|
| EPIC 00 Blueprint (BP-001–004) | ⚖️ | Adopting `@blueprintjs/*` would create a second primitive system alongside tokens+shadcn+React Bits. Recommend mapping its *patterns* (already implemented: dense table, overlay standard, select, command search) instead of a dependency swap. **Stakeholder decision.** |
| DS-001 tokens | ✅ | `styles/tokens.css` — color/type/spacing/radius/elevation/motion/density/z-index |
| DS-002/003 typography + density | ✅ | Type scale + compact/default/comfortable density via `--row-h`/`--card-pad` |
| DS-004 numeric system | ✅ | `formatPrice/Percent/Date/RelativeTime`, tabular numerals, count-up |
| DS-005 unified StatusBadge | 🟡 | `StatusChip` (workflow) + `SeverityChip` (severity) exist; no single badge covering the extended state machine (scheduled/publishing/published/expired/conflicted/rolled back) |
| APP-001 shell | ✅ | Sidebar+TopBar+breadcrumbs+command menu+notifications+settings |
| APP-002 global scope | ❌ | No Org→BU→Region→Store→Channel hierarchy. `Product` has no store/region fields — requires ontology extension + seed changes |
| APP-003 global search | 🟡 | Command menu searches nav/SKUs/strategies; not all entity types |
| TR-001/002 content standard | 🟡 | Consequence-adjacent CTAs exist in bulk dialog + undo ring; no shared `ActionSummary`/`ConsequencePreview`/`RecoveryNotice` components |
| TR-003 system status vocabulary | 🟡 | Deployment has pending/in_flight/synced/failed; no shared 10-state vocabulary or `JobProgress`/`ExecutionTimeline` primitives |
| TR-004 high-risk action pattern | 🟡 | Reject requires note, bulk has checklist, undo has ring; no shared pattern component |
| TR-005 docs context | ❌ | No `DocsLink`/metric-definition surface (glossary exists but isn't contextual) |
| TR-006 credibility gate | — | Process gate; can be encoded into the design-system page as a checklist |

## 3. Cross-cutting (§11–18)

| Requirement | Status | Delta |
|---|---|---|
| Table standards | 🟡 | MestaDataTable: sort/filter/select/sticky/density/virtualize/detail/export. Missing: column resize, grouping, pagination alternative |
| Filter system | 🟡 | URL-serialized filters, chips, saved views. Missing: active-filter count, cross-page scope filter |
| Chart requirements | 🟡 | Charts have title/caption/table twin. Missing: explicit unit/date-range/freshness/baseline metadata |
| Data trust block | ❌ | KPIs don't expose definition/scope/period/currency/freshness/coverage popover |
| UX state matrix | 🟡 | Default/hover/focus/disabled/loading/error/empty exist broadly; partial/stale/blocked/conflict not systematic |
| Error & recovery copy | 🟡 | ErrorState exists; copy not yet "last successful sync 37 min ago" style |
| Bulk confirmation anatomy | 🟡 | Checklist + excluded reasons exist; missing passed/warned/blocked count header |
| Nav rules (context/deep-link/dirty-guard) | 🟡 | URL state + deep links + beforeunload on undo. Missing: dirty-guard on wizard/builder forms |

## 4. Recommended delta plan (mapped onto current stack)

Ordered by dependency and leverage — NOT the backlog's literal order, since Phase 0's
Blueprint items are covered by the existing foundation.

**Wave A — trust vocabulary (small, unblock everything else)**
1. `StatusBadge` unified component + status→tone map covering extended states (draft, pending, approved, rejected, adjusted, stale, scheduled, publishing, published, failed, blocked, expired, rolled_back, conflicted). Migrate StatusChip/SeverityChip onto it or alias.
2. Trust components: `ActionSummary`, `ConsequencePreview`, `RecoveryNotice`, `DocsLink` + `MetricDefinition` popover. Apply to bulk approve, publish, rollback, override.
3. System-status primitives: `JobProgress`, `ExecutionTimeline`, `FreshnessBadge`, `SyncStatus`. Wire deployment + simulation run states.

**Wave B — core loop deltas (P0 pages)**
4. Attention Queue re-anatomy: category tabs derived from real fields (pending count, high impact >threshold, breach/stale health, anomalies, deploy failures) + owner/reason columns.
5. Recommendation detail upgrade: `RuleEvaluation` panel (per-check input→expected→actual→result→explanation — derivable from `checkPrice` + rationale + freshness), `ProposedPriceEditor`, pre-decision `DecisionSummary`.
6. Publish Center: `PublishJob` batch model (group channel records per recommendation), preflight checklist (approval valid, guardrails, data freshness, scope, duplicates), `RollbackDialog` with impact preview, partial-failure state.
7. Simulation deltas: competitor-impact outputs (position/index), break-even price, run-state UI ("analyzing N SKUs · competitor data 4 min ago").

**Wave C — pricing intelligence**
8. Rule model: `Rule { when: Condition[], then: PriceFormula, scope, priority }` + RuleBuilder + evaluation + priority/conflict resolution. Largest net-new domain piece — touches ontology, mock-data, checkPrice, strategy wizard.
9. Guardrail Center page + expanded constraint types (margin floor via `cost`, frequency, inventory) + evaluation drill-down.
10. Approval Inbox page + `changes_requested`/`escalated`/`expired` states + staleness re-check on approval (exists: `isStale` — wire to an "expired" transition).
11. Scope hierarchy: extend `Product` with `store`/`region` (+ derived BU), `ScopeSelector` + `ContextBar`, persist scope in ui store + URL. **Requires re-seeding; biggest data-model change.**

**Wave D — operations & governance**
12. Data Sources + Sync Health + Data Quality pages (mock `DataSource` model with sync states, coverage, rejected-record counts).
13. Exceptions queue (unify stale/breach/missing-input/override-requested) + override-request workflow + override history.
14. Alert Center (group anomalies + deploy failures + data-quality into one severity feed) + anomaly anatomy (what changed / expected / observed / investigate link).
15. Competitor workspace (aggregate observations per competitor × SKU).
16. Pricing Analytics page (acceptance rate, price index, margin leakage — derivable; no invented metrics).

**Wave E — P2**
17. Experiments builder + results (expected vs observed with honest confidence framing).
18. 7-step setup checklist + role-based onboarding entry + sample-workspace framing.
19. Multi-level approval chain (Analyst→Manager→Finance→Operator) + delegation.
20. Concurrent-edit detection (`ConflictAlert` on version change — partially simulatable via `updatedAt`).

## 5. Open decisions (need stakeholder input)

1. **Blueprint adoption (BP-001–004).** Recommendation: do NOT add `@blueprintjs/*`. Rationale: the repo already has the equivalent primitive system (tokens, dense table, native-dialog overlays, command menu, selects); adding Blueprint creates two competing foundations and re-opens every a11y/visual baseline. Adopt its *patterns* instead. If Blueprint is mandated, it becomes Phase 0 and every epic above re-baselines onto it.
2. **Persona model.** Backlog defines 6 personas; repo has 4 roles. Mapping: Pricing Manager→manager, Analyst→analyst, Operator→ops_lead, Finance Approver→new role or manager, Admin→new role, Category Mgr→analyst variant. Decide whether to add `approver`/`admin` roles or treat as manager.
3. **Scope hierarchy realism.** Region/store dimensions require extending `Product`, seeds, filters, and RBAC scoping. Cheap version: scope selector filters the existing category field. Real version: ontology v2.
4. **Scheduling.** `EXEC-002` implies wall-clock execution. Demo can simulate scheduled→publishing on a timer; a real implementation needs a backend job runner — flag as out of scope for a frontend-only MVP.
5. **Experiments (EPIC 15).** Requires variant assignment + outcome tracking semantics; recommend deferring to a real-backend phase.
