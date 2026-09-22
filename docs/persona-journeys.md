# Persona journeys (v4 acceptance criteria)

Each journey lists what the user actually sees at every step, the decision
points, and the handoff to the next role. Handoffs are only "done" when the
target role receives a notification — see the handoff table at the end.

## 1. Analyst — find risk, propose, hand over

```
Catalog scan ──► filter margin health ──► SKU detail ──► Simulation
     │                                                   │
     │                                              compare ≤3 scenarios
     │                                                   │ decision: send?
     │                                                   ▼
Audit (verify own action) ◄── wait ◄── Recommendation queued ── send
```

- **Catalog** — KPI row (avg margin, below-MAP, pending AI, avg gap) counts up
  on refresh; grid of 500+ SKUs with margin `meter`, trend sparkline, price.
  Filter bar (search, category, margin health, sort) → removable chips.
- **SKU detail** — price card, competitor table, history chart + a11y table,
  prev/next inside the active filter context, breadcrumb back keeps filters.
- **Simulation** — scenario rows with demand curve + CI band, honest
  constant-elasticity disclosure; "Send to review" is disabled until the
  scenario is saved (idempotent: `already_sent`).
- **Handoff out** — sending a scenario creates `REC-*` pending and notifies
  `manager` (`recPending`, deep link to the recommendation).
- **Waiting state** — the queue card shows status `pending` with the agent
  run timeline; the decision lands in the notification centre.
- **Audit** — own events only (`actorId` scope): sees `scenario_sent` and,
  after the window, `recommendation_*` with old→new price snapshot.

## 2. Manager — approve work, keep margin healthy

```
Overview KPIs ──► pending strategy ──► activate/reject (note required)
      │                                        │
      ▼                                        ▼
Queue facet chips ──► bulk approve (checklist + excluded) ──► margin KPI
```

- **Overview** — role KPIs with sparklines + deltas, top-movers panel,
  margin trend chart (weekly/monthly/quarterly), quick links.
- **Strategy approval** — `/strategy` pending list; reject requires a note
  (guardrail). Handoffs out: `strategyActive`/`strategyRejected` → `analyst`.
- **Queue** — facet chips (status/category/source/confidence/magnitude) +
  clear-all; card shows agent run timeline, rationale accordion, guardrail
  verdict, undo-staged approve/reject/adjust (10 s ring).
- **Bulk approve** — checklist dialog: every eligible item pre-checked,
  per-item uncheck keeps the rest; excluded items listed with reason
  (`stale`/`breach`). Applies immediately (no undo) — the checklist is the
  safeguard. Handoff out: `recBulkReady` → `ops_lead`.
- **Verification** — Overview "Approved margin impact" KPI and per-category
  decision chart reflect decisions once the undo window commits.

## 3. Ops Lead — ship approved prices, watch channels

```
Overview (channel health strip) ──► Deployment queue ──► deploy/retry
                                                          │
                          ◄── notification `recReadyDeploy`/`recBulkReady`
                                                          ▼
                              channel board: success rate, retries, log
                                                          │
                                                          ▼
                                    Catalog — new price counts up live
```

- **Overview** — channel-failure + pending-sync KPIs, last deployment.
- **Deployment** — channel cards (success rate, avg retries, last event,
  channel-level retry), queue of approved-not-deployed recs, records table
  with drawer (idempotency: locked records can't re-run).
- **Failure recovery** — failed channel rows carry the reason and a retry
  that re-runs just that channel; retries are audited (`deployment_retry`).
- **Verification** — deployed SKU's price animates in Catalog; Monitoring
  gains a forecast-vs-actual outcome automatically.

## 4. Compliance — reconstruct and export

```
Audit filter (date/actor/SKU) ──► timeline or table ──► drawer rationale
                                                          │
                                                          ▼
                              CSV export ──► Overview guardrail-exception KPI
```

- **Audit** — facet filters + saved views, hybrid timeline (per-day groups,
  icon per event family) or dense table, row drawer shows actor, snapshot,
  note. `audit_exported` is itself audited.
- **Drawer** — decision snapshots show old→new price and the rationale at
  decision time; links respect RBAC (`actionForPath` picks a permitted
  target — compliance never sees a dead link).
- **Export** — CSV of the *filtered* set, gated by `catalog.export`/
  `deployment.export` equivalents.
- **Oversight** — Overview KPIs: audit volume, manual overrides, guardrail
  exceptions. Deploy notifications reach `all` roles, including compliance.

## First-run journey (I.2)

A fresh analyst/manager sees the setup checklist on Overview (adapted
from the `onboarding-3` block) — seven steps covering the whole loop:
**review catalog → verify data feeds → activate strategy → enable a rule →
run a simulation → clear the decision queue → publish a price change**.
Every step completes from real store state (active strategy exists, all
sources healthy, zero pending/escalated recs, …) and is gated by RBAC, so a
role only sees steps it can act on; the card disappears once every visible
step is done. The subtitle is honest that this is a seeded sample workspace —
several steps may already be complete.

## Error & recovery journeys (I.4)

| Failure | What the user sees | Recovery path |
|---|---|---|
| Channel deploy fails | Card goes `failed` with reason; `deployFailed` notification to ops_lead | Per-channel retry button (retries succeed in the demo); audit records both events |
| Guardrail breach at submit | Wizard shows `invalid` + `GuardrailPreview` zones show the offending price | Edit guardrail step inline, resubmit — never a dead end |
| Undo window lapses | Ring drains to 0; decision commits + audit event | Intended: audit log is the recovery surface |
| **Tab closed mid-undo** | Browser `beforeunload` confirm while any decision is staged | User can stay and undo; if they leave, the staged decision is dropped silently — accepted limitation, now gated by a confirm prompt |
| Empty filtered result | `filter` EmptyState (FilterX icon) + clear-filters action | One click resets the facet chips |
| All work done | `caughtUp` EmptyState (CheckCircle2, green) | None needed — honest "nothing pending" |
| Blocked route | `PermissionDeniedState` names the current role | Role switcher (dev) or navigate back |

## Handoff → notification matrix (I.3)

| Handoff | Trigger (code) | Target | Message key | Deep link |
|---|---|---|---|---|
| Analyst → Manager (strategy) | `submitStrategy` | `manager` | `strategyPending` | `/strategy` |
| Manager → Analyst (activate) | `activateStrategy` | `analyst` | `strategyActive` | `/strategy` |
| Manager → Analyst (reject) | `rejectStrategy` | `analyst` | `strategyRejected` | `/strategy` |
| Analyst → Manager (recommendation) | `sendScenario` | `manager` | `recPending` | `/recommendations/{id}` |
| Approver → Ops (single decision) | `commit` after undo window, approve/adjust only | `ops_lead` | `recReadyDeploy` | `/deployment` |
| Approver → Ops (bulk) | `bulkApprove` | `ops_lead` | `recBulkReady` | `/deployment` |
| System → Ops (deploy failure) | `run` failure branch | `ops_lead` | `deployFailed` | `/deployment?status=failed` |
| System → everyone (deploy success) | `finalize` | `all` | `deployed` | `/deployment` |
| Any role → self (model flag) | `flagForModelReview` | actor role | `flagged` | `/monitoring` |

Every toast also mirrors into the notification centre (`toast:*` groups), so
ephemeral feedback never disappears without a durable record.
