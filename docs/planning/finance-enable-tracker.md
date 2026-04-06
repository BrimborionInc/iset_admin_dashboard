Purpose: Single source for Finance module enablement decisions, milestones, and next actions.  
Audience: Finance/Casework engineers, product, ops.  
Last Updated: 2026-01-30

# Finance Module Enablement Tracker

## Scope
- Wire Finance dashboards from scaffold to production: budgets, allocations, payments, reconciliation, monitoring, reporting, forecasting, settings.
- Track shared decisions, dependencies, and cross-thread progress. Keep concise and current.

## Milestones (working list)
- M0 — Baseline pots live (DB + API) and Budgets dashboard reads real data.
- M1 — Case interventions can tag pots; payment requests created against pots.
- M2 — Finance approvals + reconciliation write back to pots; evidence linked.
- M3 — Monitoring/reporting live with certified exports; forecasting published.
- M4 — Settings (hierarchy/approvals/mapping) editable in-app; roles finalized.

## Decision Log
- 2026-04-06: Retired the legacy intervention-level `finance_transaction` shortcut for live PATH workflows. Approved interventions now represent funding authority only; committed finance starts when a payment packet is sent to finance, and actuals start when PATH records a posted/confirmed payment.
- 2026-04-06: Settled finance-facing packet language on `Draft`, `Awaiting release`, `Ready to send`, `Sent to finance`, `Payment confirmed`, `Closed`, and `Cancelled`, with Sage Intacct overlays such as `Accepted in Sage Intacct` and `Sage Intacct exceptions` when the integration is enabled.
- 2026-02-03: Reconciliation source-of-truth is the case-management transaction feed ingested into finance; exceptions are derived from mapping, evidence, and policy checks. UI copy and help text aligned to this model.
- 2026-02-03: Reconciliation dashboard now reads live `finance_transaction` data and stores resolution/request state in transaction metadata (until dedicated reconciliation tables are added).
- 2025-02-06: Core entities to add — `budget_pot`, `budget_snapshot`, `budget_allocation` (transfer), `finance_transaction` (case-linked), optional pot lookup view. Start Budgets wiring first with real pot API, plus case→pot picker reuse.
- 2025-02-06: Migration added `budget_pot`, `budget_snapshot`, `budget_snapshot_pot`, `budget_allocation`, `finance_transaction` with full dummy hierarchy seed (files: `db/migrations/20250206_0007_create_finance_budget_tables.sql` for reference; active runner uses `sql/20250206_create_finance_budget_tables.sql`).
- 2025-02-06: Finance pot API live (list/get/create/update + lookup); Budgets UI now consumes API instead of demo data; case Intervention modal uses lookup.
- 2025-02-06: Lookup route ordering for finance pot assignment was fixed after an early shadowing issue on `/:id`.
- 2025-02-06: Structure Manager wired to live pot API; snapshots backed by `budget_snapshot`/`budget_snapshot_pot` with list/create/read endpoints; Budgets loads snapshots.
- 2025-12-05: Draft workflows live in Budgets: Draft Budgets tab shows/controls drafts; Structure manager edits selected draft only; publish replaces Active after taking a safety snapshot; restore snapshot creates a new draft. Snapshots and drafts have delete/restore modals; draft labels inline-editable. Pot parent guard prevents self-parenting. Admin % column now reads `adminTargetPct`.
- 2025-12-05: Roles for finance endpoints limited to `System Administrator` and `Program Administrator`. Snapshot creator stored as NULL to avoid FK issues.
- 2025-12-05: Forecast column remains manual (placeholder); variance = forecast - adjusted. Auto-forecasting deferred.
- 2025-12-07: Saved views rewired to real API + DB table (`finance_saved_view`); UI now creates/edits/deletes views per active budget version. Loaded view/summary widgets moved to palette by default.
- 2025-12-07: Pot detail widget refreshed (3-col overview, tabs, actions/export dropdown); CSV export endpoint added (`GET /api/finance/budget-pots/:id/export?format=csv`).
- 2025-12-07: Burn-rate widget now reads live pot metrics (adjusted/actual/forecast/variance) with simple risk tagging; risk filter listens to loaded view presets.
- 2025-12-07: Payments board scaffolded (queue/detail/comms/SLA widgets) on mock data per addendum; waiting on services/GL/evidence wiring.

## Current Focus
- Budgets dashboard now runs live: pot CRUD, draft/publish, snapshots, and pot selection for case interventions. Draft/snapshot UX refined; saved views and pot detail widgets now backed by API + CSV export; burn-rate widget uses live metrics with risk tagging. Live commitments now come from payment packets sent to finance, while actuals come from posted/confirmed payments.

## Payments — Remaining MUSTs
- None. All current MUST items completed for payments enablement.

## Payments — Sage Intacct XML Web Services (AP Bill) integration plan
Goal: Submit payment packets directly to Sage Intacct as AP Bills using the XML Web Services API.

### What the Intacct owner/admin must provide
- **Company ID** (tenant/company identifier).
- **Web Services enabled** for the tenant.
- **Sender ID + Sender password** (developer license credentials authorized for the tenant).
- **Web Services user** (user ID + password) or approval to use **session authentication** via `getAPISession`.
- **Authorized dimensions**:
  - Location/Entity IDs (if required by the tenant).
  - Department IDs (if required by the tenant).
  - Currency/base currency rules (if multi-currency is enabled).
- **Vendor setup**:
  - Vendor IDs for payees (preferred), or agreement on how vendor records will be created/mapped.
  - Required vendor fields in the tenant (e.g., email, contact, payment terms).
- **GL account mapping**:
  - Account numbers or account labels to use for each budget pot or payment type.
  - Confirmation of which dimension drives GL distribution (pot, payment type, program).
- **Permissions/roles** for the Web Services user to create AP Bills and (optionally) attachments.
- **API environment**: production vs sandbox tenant details.

### Engineering tasks to move from preview → live submission
- **Server endpoint**: add a secure backend route to build XML and POST to the Intacct XML gateway.
- **Authentication**:
  - Implement `getAPISession` (recommended for repeat calls) or login auth per request.
  - Store credentials and session tokens server-side only (never in the client).
- **Request/response handling**:
  - Use unique `controlid` values per submission.
  - Handle Intacct error responses and log full response payloads.
  - Capture Intacct bill identifiers (e.g., `RECORDNO`) and store them on the packet.
- **Field mapping + validation**:
  - Map packet header to `APBILL` fields (VENDORID, BILLNO, WHENCREATED, WHENDUE, DESCRIPTION, ACTION=Draft/Submit).
  - Map lines to `APBILLITEM` (ACCOUNTNO/ACCOUNTLABEL, TRX_AMOUNT, ENTRYDESCRIPTION, optional LOCATIONID/DEPARTMENTID).
  - Block submission if required data is missing; surface the exact missing fields in the UI.
- **Idempotency + retries**:
  - Use Intacct `uniqueid` and stable `controlid` for retry safety.
  - Implement retry rules for transient gateway errors.
- **Audit + observability**:
  - Persist XML payload snapshots and response logs for compliance/audit.
  - Add a submission status timeline entry and success/failure notifications.
- **Security + access control**:
  - Restrict submission to finance/admin roles.
  - Protect endpoint with auth + rate limiting.

## Payments — Completion Plan (proposed order)
1. Auto-generate packets from approved interventions (define trigger, map approval data to packet/line, default statuses, audit event). ✅
2. Evidence verification UI + verified gating (verify/unverify controls; approvals require verified evidence). ✅
3. Proof-of-payment upload in Mark Paid (upload file, link to line, enforce proof document requirement). ✅
4. Annual Report ledger extract export (API + download from Finance Payments; required fields aligned to reporting spec). ✅
5. Override UX (modal with reason + type; role gating; surfaced in timeline/history). ✅
6. Program ↔ Finance notes/requests thread (persistent communication log beyond status timeline). ✅

## Payments — Recently completed
- Payments board wired to live data with packets, lines, evidence checklists, and status timeline.
- Evidence rules engine (baseline + payment-type gates) enforced on program/finance approvals.
- Funding-authorization caps with remaining-authorized tracking per intervention (blocks overages).
- Batch creation/approval gate + CSV export from the Payments detail view.
- Mark-paid requires paid date + payment reference; auto-post `finance_transaction` on confirm.
- Duplicate payment detection with override history logging (client/intervention/type/period/amount/vendor).
- Recurring payment scheduler for living allowance/childcare (auto “Needs Evidence” lines) + no-backdating and EI-claim eligibility gates.
- Communications log + “Send to finance” email hook (routing config lives in Finance Settings).
- Program-side packet/line creation in-app (case/client/intervention selection, payee, amount, pot, service period, draft edits).
- Auto-generate payment packets from approved interventions (draft packet + line defaults).
- Evidence verification (verify/unverify) enforced in approval gating.
- Mark Paid now uploads proof-of-payment and requires proof document before paid/confirmed.
- Annual Report ledger extract export available from Payments queue.
- Override modal with reason capture for evidence, duplicate, and approval gates.
- Program ↔ Finance internal notes thread in packet detail view.

## Next Actions (short)
- Add auto-forecasting (system-generated) and clarify variance vs adjusted; remove manual placeholder.
- Wire Allocations/reallocation flows to draft/publish pattern; expose transfers and approvals.
- Expose pot transaction history endpoint and UI; harden status transitions (draft→submitted→posted) for reconciliation.
- Add guarded recalc endpoint for pot rollups and background consistency checks.
- Extend exports beyond CSV (PDF/JSON) and align with saved views filters.
- Wire Payments board to services (packet ingest, confirmations, evidence, GL/regional context) and replace mock data context.

## Links
- Workflow map: `docs/planning/finance-workflow-map.md`
- CR log: `docs/change-requests/CR-0003-Implementation-Log.md`
- FM user guide: `docs/change-requests/CR-0003-Financial-Management-User-Guide.md`
- Addendum plan: `docs/change-requests/CR-0003-Addendum-Plan.md`
- Dashboard guardrails: `docs/guides/configurable-dashboard-notes.md`
