# Payments Transformation Plan, 2026-05-11

Purpose: plan the transformation from the current experimental/legacy payment implementation to the agreed PATH business model for NWAC's email-based payment workflow.

Target operating model: `docs/planning/payments-target-operating-model-2026-05-11.md`.

This plan focuses on the email handoff workflow NWAC uses. Experimental Sage/Intacct integration work is out of scope except where current copy, settings, or code paths confuse or interfere with the email path.

## Agreed Business Frame

- Finance/Sage is the financial system of record.
- PATH is the ISET operations system for preparing payment requests, sending the Finance email handoff, and tracking operations-side follow-up where Finance feedback is unreliable.
- PATH payment state after email submission is an operational confidence/follow-up state, not authoritative AP/accounting truth.
- The distinction should be recorded in design docs and help guidance, not over-explained in every widget with warnings or heavy labels.
- Payments has two surfaces over the same data and business actions: a case-scoped Case Workspace surface and a cross-client Payments dashboard surface.
- The two surfaces differ by scope, filtering, and queue context. They should not diverge into separate workflows.

## PROD Baseline From Read-Only Review

Checked on 2026-05-11 through the documented `scripts/run-prod-sql-via-ssm.sh` SSM path with aggregate, non-PII SQL only.

- `payment_packet`: 0 rows
- `payment_packet_line`: 0 rows
- `payment_packet_document`: 0 rows
- `payment_packet_communication`: 0 rows
- `payment_status_event`: 0 rows
- `payment_batch`: 0 rows
- `payment_batch_line`: 0 rows
- `payment_line_transaction`: 0 rows
- `payment_override`: 0 rows
- `linked_payment_transactions`: 0 rows
- `finance_transaction`: 2 posted rows, both `metadata.source = manual_backload_history`, total `40695.62`
- Payment status enums in PROD are already canonical:
  - packet: `draft`, `ready_to_send`, `submitted`, `confirmed`, `cancelled`
  - line: `needs_evidence`, `ready_to_send`, `submitted`, `paid`, `held`, `cancelled`
  - batch: `draft`, `approved`, `exported`, `closed`
- PROD finance email routing exists but has `enabled = false`; current code suppresses payment emails when that flag is false.
- PROD runtime route matrix currently allows `/finance/payments` for `System Administrator`, `NWAC Administrator`, and `Regional Manager`; `/iset/payments` and `/cases/:caseId` allow System/NWAC/Regional/ISET Coordinator.

Implication: there is likely no live payment-packet data migration burden yet. Transformation can focus on code, schema additions, route/config cleanup, and launch configuration, while preserving the two historical manual-backload ledger rows.

## Current Implementation Mismatches

The list below records the issues found during the implementation review. The 2026-05-11 safety tranche has already retired or fenced several bypasses; see **Implementation Progress** for current status.

1. **Email handoff is not the only submit path.** `POST /api/finance/payment-packets/:id/status` is the good path because it validates gates, sends the email, records communication, updates status, and creates submitted `finance_transaction` rows. But `POST /api/finance/payment-packets/:id/send-email` can send externally from draft without the normal status/ledger transition.
2. **Packet create accepts non-draft statuses.** The UI creates drafts, but the API accepts submitted/confirmed statuses and timestamps at creation time, bypassing the transition model.
3. **`SIMPLE_PAYMENT_WORKFLOW` preserves an old internal-payment model.** In simple mode, a submitted line can be marked `paid` without administrator access, proof, reference, batch, or maker-checker checks. This is not the right fix for NWAC's unreliable Finance-feedback problem; it just turns PATH into false payment authority.
4. **Post-email follow-up is under-modeled.** Current line `paid`/packet `confirmed` statuses are doing too much. PATH needs explicit operations follow-up/confidence tracking: sent, follow-up needed, reported paid, confirmed by evidence, stale/no response, cancelled/not proceeding.
5. **Two surfaces were not in parity.** Case Workspace widgets were the action surface while the old cross-client dashboard was mostly inspection/read-only. The 2026-05-11 two-surface tranche now makes `/iset/payments` the cross-client operational surface, while `/finance/payments` remains a separate administrator oversight route pending a later route decision.
6. **The standalone `/iset/payments` page was a scaffold.** This is fixed in DEV as of 2026-05-11: the page now hosts the shared queue, detail, and communications widgets in operational mode.
7. **Cross-client scope filtering is not designed for real dashboard scale.** The list endpoint queries the first capped result set and then filters each row through packet access. That is acceptable for small/unused data, but not for an operational cross-client queue.
8. **Communications are now partially aligned with scoped use.** The data provider now reloads communications for the selected packet with `packetId`, and the Case Workspace manage-payments layout includes the communications widget. Remaining work: richer email/reply tracking and browser/API smoke coverage.
9. **Line-level evidence attach is now implemented in DEV.** The schema, checklist model, manual attach route, and upload/link UI all carry `payment_packet_document.payment_packet_line_id` for line-scoped evidence.
10. **Budget/reporting labels are now partially aligned.** `submitted` finance transactions support operational committed/requested amounts. `posted` finance transactions drive PATH-recorded actual/confirmation values, with widgets/help now avoiding Sage-authoritative wording. Remaining work is deeper reporting/budget test coverage and any role-specific reporting refinements found during browser automation.
11. **Route and label language is mid-cleanup.** Main route/header/help copy has moved back to "Payments", but the remaining reporting/help pass still needs to check optional batch wording against the operations-owned request/follow-up model and the external Finance boundary.

## Target Business Workflows

### 1. Payment Request Preparation

Operations staff create a payment packet against an approved intervention for the specific month, invoice, receipt, or claim period being requested. Required data: case/client, intervention, payment type, payee, amount, budget pot, reporting unit, service period/requested date where applicable, and supporting evidence.

Both surfaces should support this workflow where role/scope allows. The case surface starts with the current case preselected; the dashboard starts with a cross-client queue and lets the user select/search case context.

### 2. Finance Email Handoff

PATH validates the packet and sends the finance email through one canonical transition: draft/ready to sent-to-Finance. The transition records the communication, locks normal edits, and creates operational committed/requested rows for budget visibility.

The direct send-email bypass should be removed, retired, or converted to call the same transition path.

### 3. Post-Handoff Follow-Up

After email submission, PATH tracks operational follow-up because Finance feedback is unreliable. Follow-up states should be explicit and auditable, with notes and optional supporting evidence:

- sent to Finance
- follow-up needed
- follow-up sent/logged
- reported paid
- confirmed by evidence
- stale/no response
- cancelled/not proceeding

This should replace the current blunt "Mark paid" behavior. If a "record paid" action remains, it should be framed as operational follow-up and require enough context to avoid silently hardening assumptions into accounting fact.

### 4. Budget And Case Finance Visibility

PATH should support approved funding from approved interventions, operational committed/requested amount after email handoff, operationally recorded actual/fulfilled amount after follow-up confirmation, and stale/unresolved requests that may affect planning.

Reports and case finance panels should use concise labels, with detail/caveat in help text. Avoid turning every table into an accounting disclaimer.

### 5. Audit And Exception Handling

PATH must preserve the packet, lines, evidence, email/communication history, status/follow-up events, overrides, duplicates, cancellations, resubmissions, and audit bundle traceability. This is what makes the operations-side workflow defensible even when Finance feedback is inconsistent.

## Recommended Transformation Workstreams

### A. Submission Contract Cleanup

- Make the packet status endpoint the only path that sends the Finance email.
- Retire or hard-block `POST /api/finance/payment-packets/:id/send-email`, or make it delegate to the normal submit transition.
- Reject non-draft packet creation except for a deliberately designed import/admin path.
- Keep packet edits and line edits locked after submission except for controlled reopen/resend and follow-up fields.
- Add tests that prove direct send and non-draft create cannot bypass gates.

### B. Follow-Up Model

Preferred direction: add explicit follow-up state instead of relying only on line `paid` and packet `confirmed`.

Possible minimal schema:

- `payment_packet.follow_up_status` or packet metadata for current aggregate status.
- `payment_packet_line.follow_up_status` for line-level operational fulfillment.
- `payment_followup_event` table for immutable follow-up history linked to packet/line, with actor, status, note, optional document id, and timestamp.

Use computed packet status from lines/events where practical. Keep existing packet/line workflow statuses for request preparation and sent/closed lifecycle.

### C. Two-Surface Parity

- Refactor frontend mode flags away from `finance` vs `program`; use scope/context concepts such as `case` and `dashboard`.
- Drive action availability by role/scope/status, not by dashboard identity.
- Revive `/iset/payments` or create the agreed Payments dashboard as the cross-client operational surface.
- Decide whether `/finance/payments` becomes an alias, admin-only oversight route, or retired route.
- Add the communications/follow-up widget to both surfaces.
- Ensure the dashboard can create/edit/validate/send/log follow-up for any packet the user is allowed to access.

### D. Access And Scale

- Keep System Administrator / NWAC Administrator global access and Regional Manager / ISET Coordinator case-scoped access.
- For cross-client dashboard use, implement SQL-level scope filters for Regional Manager/ISET Coordinator access instead of broad query then per-row filtering.
- Resolved 2026-08-24: align the route matrix and backend to the four actual Cognito roles only. Finance remains external and has no PATH group.
- Preserve object-scope checks for packet details, documents, PDFs, communications, and generated files.

### E. Evidence Alignment

- Line-level evidence linking is the chosen model for payment-type gates.
- `POST /api/finance/payment-packets/:id/documents` now accepts and validates line-scoped document links.
- Ensure evidence checklists, uploads, existing-document links, and audit bundles all use the same packet/line evidence semantics.
- Keep generated global finance artifacts out of `iset_document` unless they are genuinely case/client-scoped.

### F. Budget And Reporting Semantics

- Keep `finance_transaction` as PATH's operational shadow ledger unless/until a separate Sage import exists.
- Treat `submitted` rows as operational committed/requested.
- Treat `posted` rows as operationally recorded actual/fulfilled, not Sage authoritative actual.
- Update UI/help labels carefully: concise in widgets, richer explanation in help panels.
- Review Financial Reports and Case Finance Panel copy so it supports operational planning without claiming accounting authority.

### G. PROD Launch Configuration

- Before enabling real payment use in PROD, configure and verify `finance.email.routing` with `enabled=true` and the approved recipients.
- Smoke the email path in TEST with safe recipients and no real applicant data.
- Keep PROD rollout app-first/schema-first as needed, with no broad data migration expected because payment packet tables are empty.
- Run read-only PROD preflight again immediately before deploy/release to verify payment tables are still unused or identify any new rows.

## Suggested Implementation Phases

1. **Design lock:** confirm follow-up states, dashboard route ownership, and role/scope behavior.
2. **Safety cleanup:** remove direct send bypass, enforce draft-only create, isolate or remove simple paid workflow behavior.
3. **Follow-up model:** add schema/API/UI for operational follow-up events and current state.
4. **Surface parity:** make the dashboard and case workspace share the same action set with different scope/filter context.
5. **Evidence alignment:** implement line-level document links or deliberately flatten rules to packet level.
6. **Budget/reporting language:** adjust concise labels and help text to reflect operational shadow semantics.
7. **Verification and launch:** TEST smoke, route-scope denial tests, email-routing config, final PROD read-only preflight, then deploy.

## Implementation Progress

### 2026-07-12 Engineering-Audit R7 Local Safety Tranche

- Added canonical migration `20260712_0001_add_payment_submission_attempt.sql`. Submission attempts are claimed and committed before any Finance email/Intacct call; accepted/suppressed outcomes replay without resending, known failures can retry, and uncertain/expired sends stop as `ambiguous` for review.
- The canonical packet status transition now finalizes packet/line/follow-up/ledger state in a separate transaction after the durable external outcome. A scoped read route exposes attempt status without raw request/result bodies.
- Payment follow-up evidence requires both ordinary document access and packet client/case containment before any status/event write.
- Payment Workspace packet/selection/communication state is filter-owned; case changes mask prior data immediately, discard stale responses, and block out-of-scope mutations.
- No payment routing, real email, Intacct provider, database, TEST, or PROD environment was accessed or enabled. Full local tests pass; schema and authenticated provider workflow still require a separately authorized TEST rehearsal before any activation.

### 2026-05-11 Safety Tranche Started

- Added target operating-model memory in `docs/planning/payments-target-operating-model-2026-05-11.md`.
- Disabled `SIMPLE_PAYMENT_WORKFLOW` in `isetadminserver.js`.
- Retired direct `POST /api/finance/payment-packets/:id/send-email` with `410 payment_email_endpoint_retired`; the canonical packet status transition remains the route that sends Finance email.
- Enforced draft-only packet creation and rejected non-draft line statuses at packet creation.
- Updated the frontend send helper to use the packet `submitted` status transition instead of the direct email endpoint.
- Hid the old `Mark paid` action pending the explicit follow-up model.
- Added focused safety regression coverage with `npm run test:payments:safety`.
- Payment workflow automation plan lives in `docs/testing/payments-workflow-automation.md`.

### 2026-05-11 Follow-Up Tranche Started

- Added canonical migration `sql/migrations/20260511_0001_add_payment_followup_model.sql`.
- Added current follow-up state fields on `payment_packet` and `payment_packet_line`.
- Added immutable `payment_followup_event` history with optional packet/line/document links.
- Added backend follow-up status normalization, hydration, event recording, and packet aggregate recompute from line follow-up state.
- Added `GET /api/finance/payment-followups`, `POST /api/finance/payment-packets/:id/follow-up`, and `POST /api/finance/payment-lines/:id/follow-up`.
- Packet submission now initializes follow-up as `sent_to_finance`; cancellation/reopen transitions update follow-up state consistently.
- The Payment Detail widget now shows packet and line follow-up state and exposes `Log follow-up` for submitted/non-draft packets.
- DEV migration was applied and verified locally on 2026-05-11; follow-up schema plan now reports zero pending DEV migrations.
- Focused tests, focused lint, server syntax check, and production build passed. The build still shows the existing repo-wide warning baseline.

### 2026-05-11 Two-Surface Parity Tranche Started

- Populated `/iset/payments` as the cross-client operational Payments dashboard using the shared payment packet queue, detail, communications, and SLA widgets.
- The `/iset/payments` widgets run in operational/program mode, so creation, validation, send-to-finance, follow-up, evidence, and manual communication actions are available subject to route/API scope and status checks.
- Added a Payments link under Case Management navigation for users who have access to `/iset/payments`.
- Added the Payment Communications widget to the Case Workspace manage-payments layout, so case-scoped and cross-client payment surfaces expose the same communication history model.
- Updated communication loading to use the selected packet scope when available, avoiding the old all-communications request for case-scoped users.
- Replaced the old one-click "Log manual email" placeholder behavior with a modal that records the actual direction, people/email addresses, subject, and notes.
- Hid the experimental Intacct XML preview from operational payment surfaces by default; `/finance/payments` can still opt into that preview through explicit widget metadata while the email workflow remains the operational focus.
- Focused lint and `npm run test:payments:safety -- --runInBand` passed after the parity changes.

### 2026-05-11 Evidence Alignment Tranche Started

- Removed the `line_level_documents_not_supported` rejection from `POST /api/finance/payment-packets/:id/documents`.
- The attach endpoint now accepts a line id, validates that the line belongs to the target packet, and writes `payment_packet_document.payment_packet_line_id`.
- The Payment Detail widget now sends the active evidence row's `lineId` when linking existing documents or uploading new evidence, so line-scoped checklist rows persist as line-scoped evidence.
- `mapPaymentDocumentRow` now returns packet and line ids for payment document links.
- Focused server syntax, focused lint, and `npm run test:payments:safety -- --runInBand` passed after the evidence changes.

### 2026-05-11 Reporting And Budget Semantics Tranche Started

- The annual Financial Reports follow-up map now reads `payment_packet.follow_up_status` and prefers explicit operations follow-up state before falling back to submitted/posted transaction amounts.
- Financial Reports UI/export labels now use `Recorded paid` wording for PATH-recorded paid/confirmed amounts rather than implying Sage/AP authority.
- Case Finance Panel and Budgets hierarchy/detail/burn-rate labels now use `Recorded actual` for PATH-side actuals while keeping normal table labels concise.
- Homepage Metrics now labels the paid currency tile `Funds recorded actual`.
- Help-panel and docs language now explains the Finance/Sage distinction in guidance text rather than adding repetitive in-widget alerts.

### 2026-05-11 DEV Workflow Automation Tranche Started

- Added `scripts/payments-workflow-smoke.js` with three layers: rollback-only DEV DB smoke, authenticated DEV API smoke, and authenticated Puppeteer UI smoke.
- Added npm aliases `payments:workflow:smoke`, `payments:workflow:smoke:api`, and `payments:workflow:smoke:browser`.
- The rollback DB smoke passed against DEV with `DB_HOST=172.26.176.1`, proving the target submitted-packet, submitted-line, line-evidence, communication, follow-up, and cleanup invariants without persisting rows.
- The authenticated API smoke passed against the local DEV backend using `program.admin@awentech.ca`, proving packet create, draft-only creation, line evidence attach, validation, retired send-email behavior, safe post-send follow-up state, communication logging, follow-up history, detail/list hydration, and cleanup.
- The authenticated Puppeteer smoke passed against the local React dev server on `http://localhost:3001`, proving the same synthetic packet renders on both the Case Workspace payment surface and `/iset/payments` with no browser console/page/API failures and cleanup verified.

### 2026-05-11 TEST Rehearsal Tranche Completed

- Read-only TEST preflight found payment workflow tables empty, two historical manual-backload finance transactions, Finance email routing present but disabled, and Intacct disabled.
- Admin release `20260511-test-payments-workflow` deployed to TEST with schema migrations through `20260511_0001_add_payment_followup_model.sql`, using the documented admin maintenance warning, ALB fallback, target-group smoke, and warning-clear sequence.
- TEST rollback DB smoke passed on the app instance and verified no persistent synthetic rows.
- Authenticated TEST API smoke passed with `program.admin@awentech.ca`, covering packet creation, evidence attach, validation, retired direct send, safe post-send state, communication logging, follow-up history, selected-packet communications, detail/list hydration, and cleanup.
- The first TEST browser pass exposed a deploy-bundle testing issue: authenticated `apiFetch` used the build-time public API base and did not honor the existing runtime API override. `src/auth/apiClient.js` now resolves `window.__API_BASE__` before build-time env for authenticated API calls, and the smoke injects the local API base before the app loads.
- Corrective admin release `20260511-test-payments-api-base` deployed to TEST under the same warning/fallback sequence, with zero pending migrations.
- Authenticated TEST API + Puppeteer smoke passed against the deployed admin bundle, proving the same synthetic packet renders in Case Workspace and `/iset/payments` with no console/page/API failures and verified cleanup.
- Final TEST SQL cleanup check returned zero smoke rows across users, clients, cases, submissions, documents, packets, packet lines, finance transactions, communications, and follow-up events.
- Residual unrelated verification note: `npm run smoke:privacy-routes` currently fails an admin-feedback report-detail role-pattern check, not a payments route. Do not treat that as a payment workflow blocker, but do not call the whole repo privacy-route gate green until the admin-feedback check is resolved.

## Paused State, 2026-05-11

Paused after completing the TEST rehearsal. The active code/docs now represent the NWAC email-path target model through TEST, but no PROD payment workflow rollout or PROD payment-email enablement has been performed.

Resume point for the next thread:

- Re-read this plan, `docs/planning/payments-target-operating-model-2026-05-11.md`, `docs/testing/payments-workflow-automation.md`, and the indexed thread entry `Overall look at PATH payments features`.
- Run a fresh read-only PROD preflight before any PROD deploy: payment packet workflow row counts, `finance_transaction` manual-backload rows, `finance.email.routing`, Intacct runtime config, and pending migration plan.
- Decide the PROD email-routing posture with Bill before enabling any real Finance email send. Do not enable `finance.email.routing.enabled=true` or send external Finance/applicant email without explicit approval for that exact action.
- Use the documented PROD maintenance-window deploy sequence; the TEST rehearsal used admin warning, admin ALB fallback, deploy, target-group smoke, clear fallback, then clear warning.
- After PROD deploy, run the payments safety tests locally and the authenticated workflow smoke in the appropriate environment without sending real Finance email unless separately approved.

## Open Design Decisions

- Should `/finance/payments` remain an admin/finance oversight route, become an alias to `/iset/payments`, or be retired once the operational dashboard is fully validated?
- Should `confirmed` remain the packet terminal status label internally, or should the visible label become something like `Resolved` / `Follow-up closed`?
- Should line `paid` be retained as an internal status with visible label `Recorded paid`, or replaced by separate follow-up status while line workflow remains `submitted`?
- Which roles should perform cross-client payment work: System/NWAC only, Regional Managers by region, ISET Coordinators for assigned cases, or a new operational payment role?
- What is the minimum evidence/note required to move a line from sent to reported/confirmed by operations?
