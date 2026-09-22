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
| P-01 Command Center | `/overview` | ✅ | KPIs with MetricDefinition popovers, scope selector in shell, movers, activity, 7-step setup checklist (E.2) |
| P-02 Recommendations | `/recommendations` | ✅ | Attention tabs (decide/deploy/impact/stale/anomaly), owner + primary-driver on cards, facets, bulk checklist (B.1) |
| P-03 Recommendation Detail | `/recommendations/[recId]` | ✅ | RuleEvaluation drill-down (input→expected→actual→result), DecisionSummary consequence preview, inline adjust editor (B.2) |
| P-04 Price Catalog | `/catalog` | ✅ | Virtualized table, filters, saved views, override dialog, SKU drawer, detail nav |
| P-05 Simulator | `/simulation` | ✅ | Competitor avg + vs-market delta, break-even marker, run-state line with observation freshness (B.4) |
| P-06 Strategies | `/strategy` | 🟡 | List, wizard, versions, rollback, submit→manager approval exist. Missing: schedule, signal/rule selectors |
| P-07 Rules | `/rules` | ✅ | `Rule { when[], then, scope, priority }` + builder + deterministic evaluation + conflict resolution (C.2) |
| P-08 Guardrails | `/guardrails` | ✅ | Standalone center: effective bounds, MAP, max-change, auto-approve, margin floor, staleness coverage + per-SKU drill-down (C.3) |
| P-09 Approvals | `/approvals` | ✅ | Inbox with escalated/changes_requested/expired, 7-day TTL, stale re-check + ack, multi-level high-impact gate, delegation grants (C.4, E.3) |
| P-10 Publish Center | `/deployment` | ✅ | PublishJob batch model, preflight checklist, now/schedule, rollback with impact preview, partial-failure state (B.3) |
| P-11 Monitoring | `/monitoring` + `/alerts` + `/data` | ✅ | Anomalies + forecast-vs-actual + freshness strip; Alert Center with anomaly anatomy; service health on /data (D.1, D.3) |
| P-12 Audit Trail | `/audit` | ✅ | Timeline+table, filters, drawer, CSV, saved views |
| P-13 Data Sources | `/data` | ✅ | DataSource model, sync states, coverage, rejected records, ops-lead re-sync action (D.1) |
| P-14 Data Quality | `/data` | ✅ | Missing competitor input + >30-day stale prices derived per scope (D.1) |
| P-15 Competitors | `/competitors` | ✅ | Per-competitor aggregates (coverage, avg gap, freshest obs) + SKU drill-down (D.4) |
| P-16 Pricing Analytics | `/analytics` | ✅ | Acceptance rate, price index, margin leakage, decision latency, deploy success — all derivable (D.5) |
| P-17 Experiments | `/experiments` | ✅ | Builder, start (applies treatment prices + emits real outcomes), conclude, expected-vs-observed with honest framing (E.1) |
| P-18 Exceptions | `/exceptions` | ✅ | Unified queue (breach/stale/override/missing-input/stale-price), override-request workflow, override history (D.2) |
| P-19 Access Control | `lib/rbac.ts` + `/settings` | ✅ | Action-level RBAC (4 roles) enforced in actions + routes; read-only role×action policy matrix on /settings derived from PERMISSIONS — edits are intentionally code-only |
| P-20 Onboarding | `/overview` checklist | ✅ | 7-step setup, role-aware via RBAC gating, sample-workspace framing note (E.2) |

## 2. Foundation epics

| Backlog item | Status | Delta |
|---|---|---|
| EPIC 00 Blueprint (BP-001–004) | ✅ | **Resolved: not adopted.** Patterns were mapped onto the existing tokens+shadcn+React Bits foundation instead of a dependency swap |
| DS-001 tokens | ✅ | `styles/tokens.css` — color/type/spacing/radius/elevation/motion/density/z-index |
| DS-002/003 typography + density | ✅ | Type scale + compact/default/comfortable density via `--row-h`/`--card-pad` |
| DS-004 numeric system | ✅ | `formatPrice/Percent/Date/RelativeTime`, tabular numerals, count-up |
| DS-005 unified StatusBadge | ✅ | `StatusBadge` + `MestaStatus` union covers workflow/execution/health/governance/severity; chip components are aliases (A.1) |
| APP-001 shell | ✅ | Sidebar+TopBar+breadcrumbs+command menu+notifications+settings+ScopeSelector |
| APP-002 global scope | ✅ | Org→BU→Region→Store on `Product`, `ScopeSelector` in shell, scoped query hooks (C.1). Channel still not modeled — honest subset |
| APP-003 global search | ✅ | Command menu searches nav/quick-actions/SKUs/strategies/recommendations/rules/experiments + recents; rules/experiments deep-link to their pages (no detail routes) |
| TR-001/002 content standard | ✅ | `ActionSummary`, `ConsequencePreview`, `RecoveryNotice` on bulk approve, publish, rollback, override, experiment start (A.2) |
| TR-003 system status vocabulary | ✅ | `FreshnessBadge`, `SyncStatus`, `JobProgress`, `ExecutionTimeline` wired into deployment/simulation/monitoring (A.3) |
| TR-004 high-risk action pattern | ✅ | Consequence preview + recovery notice + undo window + acknowledge-stale pattern on risky CTAs |
| TR-005 docs context | ✅ | `DocsLink` + `MetricDefinition` on overview/analytics KPIs |
| TR-006 credibility gate | ✅ | Decision rules + coverage documented on `/design-system` |

## 3. Cross-cutting (§11–18)

| Requirement | Status | Delta |
|---|---|---|
| Table standards | 🟡 | MestaDataTable: sort/filter/select/sticky/density/virtualize/detail/export. Missing: column resize, grouping, pagination alternative |
| Filter system | ✅ | URL-serialized filters, chips, saved views + cross-page Org→BU→Region→Store scope filter (C.1) |
| Chart requirements | ✅ | Title/caption/table twin + `meta` line carrying explicit unit/window metadata on overview charts; simulation carries run-state/freshness line |
| Data trust block | ✅ | `MetricDefinition` popover (definition/scope/source/updated) on overview + analytics KPIs (A.2, D.5) |
| UX state matrix | ✅ | Loading/error/empty/stale/blocked/conflict all first-class; conflict state lands via optimistic-concurrency UI (E.4) |
| Error & recovery copy | ✅ | `RecoveryNotice` + `FreshnessBadge` ("synced X ago") + execution traces on deployments |
| Bulk confirmation anatomy | ✅ | Checklist + eligible/excluded counts + per-reason breakdown + immediate-apply disclosure |
| Nav rules (context/deep-link/dirty-guard) | ✅ | URL state + deep links + beforeunload on undo; rule builder has a two-step discard-confirm on unsaved edits; strategy wizard autosaves drafts to a persisted store (restore notice on return) — stronger than a guard |

## 4. Recommended delta plan (mapped onto current stack)

Ordered by dependency and leverage — NOT the backlog's literal order, since Phase 0's
Blueprint items are covered by the existing foundation.

**Wave A — trust vocabulary (small, unblock everything else) — ✅ shipped**
1. `StatusBadge` unified component + status→tone map covering extended states (draft, pending, approved, rejected, adjusted, stale, scheduled, publishing, published, failed, blocked, expired, rolled_back, conflicted). Migrate StatusChip/SeverityChip onto it or alias.
2. Trust components: `ActionSummary`, `ConsequencePreview`, `RecoveryNotice`, `DocsLink` + `MetricDefinition` popover. Apply to bulk approve, publish, rollback, override.
3. System-status primitives: `JobProgress`, `ExecutionTimeline`, `FreshnessBadge`, `SyncStatus`. Wire deployment + simulation run states.

**Wave B — core loop deltas (P0 pages) — ✅ shipped**
4. Attention Queue re-anatomy: category tabs derived from real fields (pending count, high impact >threshold, breach/stale health, anomalies, deploy failures) + owner/reason columns.
5. Recommendation detail upgrade: `RuleEvaluation` panel (per-check input→expected→actual→result→explanation — derivable from `checkPrice` + rationale + freshness), `ProposedPriceEditor`, pre-decision `DecisionSummary`.
6. Publish Center: `PublishJob` batch model (group channel records per recommendation), preflight checklist (approval valid, guardrails, data freshness, scope, duplicates), `RollbackDialog` with impact preview, partial-failure state.
7. Simulation deltas: competitor-impact outputs (position/index), break-even price, run-state UI ("analyzing N SKUs · competitor data 4 min ago").

**Wave C — pricing intelligence — ✅ shipped**
8. Rule model: `Rule { when: Condition[], then: PriceFormula, scope, priority }` + RuleBuilder + evaluation + priority/conflict resolution. Largest net-new domain piece — touches ontology, mock-data, checkPrice, strategy wizard.
9. Guardrail Center page + expanded constraint types (margin floor via `cost`, frequency, inventory) + evaluation drill-down.
10. Approval Inbox page + `changes_requested`/`escalated`/`expired` states + staleness re-check on approval (exists: `isStale` — wire to an "expired" transition).
11. Scope hierarchy: extend `Product` with `store`/`region` (+ derived BU), `ScopeSelector` + `ContextBar`, persist scope in ui store + URL. **Requires re-seeding; biggest data-model change.**

**Wave D — operations & governance — ✅ shipped**
12. Data Sources + Sync Health + Data Quality pages (mock `DataSource` model with sync states, coverage, rejected-record counts).
13. Exceptions queue (unify stale/breach/missing-input/override-requested) + override-request workflow + override history.
14. Alert Center (group anomalies + deploy failures + data-quality into one severity feed) + anomaly anatomy (what changed / expected / observed / investigate link).
15. Competitor workspace (aggregate observations per competitor × SKU).
16. Pricing Analytics page (acceptance rate, price index, margin leakage — derivable; no invented metrics).

**Wave E — P2 — ✅ shipped**
17. Experiments builder + results (expected vs observed with honest confidence framing).
18. 7-step setup checklist + role-based onboarding entry + sample-workspace framing.
19. Multi-level approval chain (Analyst→Manager→Finance→Operator) + delegation.
20. Concurrent-edit detection (`ConflictAlert` on version change — partially simulatable via `updatedAt`).

## 5. Open decisions — resolved during implementation

1. **Blueprint adoption (BP-001–004).** **Not adopted.** Patterns were mapped onto the existing tokens+shadcn+React Bits foundation; no `@blueprintjs/*` dependency was added. Rationale held: two competing primitive systems would have re-opened every a11y/visual baseline.
2. **Persona model.** **Resolved: 4 roles kept.** The backlog's Finance Approver maps to `manager` — the multi-level gate (E.3) treats manager as the second approval level, with `DelegationGrant` covering temporary analyst elevation. A dedicated `approver`/`admin` role remains available if the persona matrix is ever mandated.
3. **Scope hierarchy realism.** **Resolved: real version shipped.** `Product` carries `region`/`store` (BU derived); `ScopeSelector` + scoped query hooks filter every major surface. Channel remains unmodeled — no product carries a channel dimension, so the selector honestly stops at Store.
4. **Scheduling.** **Resolved: simulated, honestly labeled.** `runScheduledJob` promotes scheduled publish jobs; `triggerSourceSync` completes on a 2s timer. Both are documented in-code as frontend stand-ins for a backend job runner — out of scope for the frontend-only MVP.
5. **Experiments (EPIC 15).** **Resolved: shipped with honest semantics.** No variant-assignment backend exists, so `startExperiment` applies the treatment price to the whole SKU scope and emits outcomes from the demand model with deterministic noise. Results are labeled "directional signal only" — the UI never claims statistical confidence.

## 6. Shipped state

| Wave | Commit | Scope |
|---|---|---|
| A | `df1e254` | Unified status vocabulary, trust components, system-status primitives |
| B | `354b356` | Publish-job model, queue tabs, rule evaluation, simulation deltas |
| C | `22fd61d` | Scope hierarchy, rule engine, guardrail center, approval inbox |
| D | `01c635c` | Data health, exceptions, alert center, competitors, analytics |
| E | `4dbe573` | Experiments, 7-step onboarding, multi-level approval + delegation, optimistic concurrency |

Known honest gaps remaining: strategy scheduling/signal selectors (P-06), policy-management UI (P-19),
command-menu entity coverage (APP-003), chart metadata (units/date-range), table resize/grouping,
dirty-guard on wizard forms, and the Channel scope dimension.
