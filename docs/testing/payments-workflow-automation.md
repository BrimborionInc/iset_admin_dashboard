# Payments Workflow Automation

Status: R7 local safety regression green on 2026-07-12; the 2026-05-11 TEST rehearsal remains historical evidence and fresh TEST/PROD preflight/config is still required.

This note tracks the automated test strategy for PATH payments. The goal is to cover the workflow in layers so implementation changes are checked before PROD rollout and before real payment use is enabled.

## Current Automated Coverage

- `npm run test:payments:safety`
  - Checks that the legacy simple paid workflow is disabled.
  - Checks that the direct `/api/finance/payment-packets/:id/send-email` endpoint is retired.
  - Checks that packet creation cannot seed submitted packets or paid lines.
  - Checks that frontend submit helpers use the canonical packet status transition.
  - Checks that the old `Mark paid` action is hidden until explicit follow-up replaces it.
  - Checks that payment follow-up has schema/API/UI hooks instead of relying on the old line paid shortcut.
  - Checks that `/iset/payments` is populated as an operational dashboard rather than the old scaffold.
  - Checks that payment communications use selected-packet scope and no longer create a placeholder `finance@nwac.org` log on one click.
  - Checks that line-level payment evidence attach is supported by API and UI.
  - Checks that budget/reporting labels use PATH operational payment semantics (`Recorded paid`, `Recorded actual`) and that Financial Reports read explicit follow-up state.
  - Checks that follow-up evidence composes document authorization with packet containment, external handoff commits a durable attempt before dispatch, and Intacct success requires a documented envelope plus external ID.

- R7 focused concurrency/scope suites
  - `tests/paymentSubmissionAttempt.test.js` proves one provider dispatch for competing callers, accepted replay, known-failure retry, and ambiguous quarantine without a real provider call.
  - `tests/allocationApply.test.js` proves competing allocation applies transfer once and insufficient authority rolls back.
  - `tests/paymentFollowUpEvidence.test.js` proves both authorization layers are required.
  - `src/pages/finance/widgets/PaymentsDataContext.scope.test.jsx` proves case changes immediately mask old payment state, ignore stale packet/communication responses, and prevent an old-packet mutation.
  - `src/lib/__tests__/intacctRestEnvelope.test.js` proves current `ia::result` / `ia::meta` parsing and fail-closed object-ID rules.

- `DB_HOST=172.26.176.1 npm run payments:workflow:smoke`
  - Runs a rollback-only DEV database workflow smoke through `scripts/payments-workflow-smoke.js`.
  - Creates a synthetic client/case/application/intervention/budget pot/payment packet/payment line/evidence set inside a transaction.
  - Proves the target email-path data shape: submitted packet, submitted line without the legacy paid shortcut, line-scoped evidence, baseline evidence completeness, submitted operational finance transaction, packet-scoped communication log, and follow-up event history.
  - Rolls the transaction back and verifies no synthetic fixture rows remain.

- `DB_HOST=172.26.176.1 npm run payments:workflow:smoke:api`
  - Runs the authenticated DEV API layer when `PAYMENTS_SMOKE_ID_TOKEN` or `SMOKE_ID_TOKEN` is set.
  - Creates a safe fixture, exercises packet create/line evidence/validate/legacy-send blocking/follow-up/communications/list/detail routes, and cleans up unless `--keep-fixture` is used.
  - Does not send external Finance email by default. Use `--allow-email-submit` only when email routing and recipients have been deliberately configured for the environment.

- `DB_HOST=172.26.176.1 npm run payments:workflow:smoke:browser`
  - Runs the authenticated API smoke and then a Puppeteer UI smoke for the Case Workspace payment surface and `/iset/payments`.
  - Requires a live admin dev stack plus a staff Cognito token in `PAYMENTS_SMOKE_ID_TOKEN` or `SMOKE_ID_TOKEN`.
  - Use `--frontend-base http://localhost:3001` when testing against the React dev server rather than the backend-served build.
  - In deployed TEST-style runs, the browser smoke injects `window.__API_BASE__` before the app loads so the browser can exercise the deployed bundle against the local on-instance API without changing normal user-facing API routing.

Also run after payment route/frontend changes:

- `node --check isetadminserver.js`
- `npx eslint src/pages/Caseworking/ProgramPaymentsPage.jsx src/pages/Caseworking/CaseWorkspacePage.jsx src/pages/Caseworking/caseWorkspace/widgets/CasePaymentCommunicationWidget.jsx src/pages/Caseworking/caseWorkspace/widgets/FinancePanelWidget.jsx src/pages/finance/FinancePaymentsPage.jsx src/pages/finance/FinanceReportsPage.jsx src/pages/finance/financeInterventionReportExport.js src/pages/finance/widgets/PaymentCommunicationWidget.jsx src/pages/finance/widgets/PaymentDetailWidget.jsx src/pages/finance/widgets/PaymentsDataContext.jsx src/pages/finance/widgets/BudgetHierarchyWidget.jsx src/pages/finance/widgets/BudgetPotDetailWidget.jsx src/pages/finance/widgets/BudgetBurnRateWidget.jsx src/pages/finance/widgets/__tests__/paymentsWorkflowSafety.test.js src/pages/home/widgets/MetricsWidget.js src/routes/AppRoutes.js src/layouts/SideNavigation.js`
- `npm run db:migrate:plan -- --target-env dev`
- `npm run build`

DEV follow-up migration status on 2026-05-11:

- Applied `20260511_0001_add_payment_followup_model.sql`.
- Verified `payment_followup_event` exists and `payment_packet` / `payment_packet_line` expose `follow_up_status`, `follow_up_due_at`, and `follow_up_updated_at`.
- Follow-up migration plan returned zero pending migrations after apply.

DEV evidence alignment status on 2026-05-11:

- `POST /api/finance/payment-packets/:id/documents` accepts `lineId` / `paymentPacketLineId` / `payment_packet_line_id`.
- The endpoint validates the line belongs to the packet and writes `payment_packet_document.payment_packet_line_id`.
- The Payment Detail widget sends the active evidence row's `lineId` when linking or uploading evidence.

DEV reporting/budget semantics status on 2026-05-11:

- Financial Reports reads `payment_packet.follow_up_status` and uses it ahead of submitted/posted transaction fallback labels.
- Financial Reports UI/export uses `Recorded paid` for PATH-recorded paid/confirmed values.
- Case Finance Panel, Budgets hierarchy/detail/burn-rate, and homepage Metrics use recorded-actual language where PATH is not the system of financial record.

DEV workflow-smoke status on 2026-05-11:

- Added `scripts/payments-workflow-smoke.js` and npm aliases `payments:workflow:smoke`, `payments:workflow:smoke:api`, and `payments:workflow:smoke:browser`.
- Ran `DB_HOST=172.26.176.1 npm run payments:workflow:smoke`; rollback database smoke passed and verified cleanup.
- Ran `DB_HOST=172.26.176.1 PAYMENTS_SMOKE_ID_TOKEN=... npm run payments:workflow:smoke:api`; authenticated DEV API smoke passed and verified cleanup.
- Ran `DB_HOST=172.26.176.1 PAYMENTS_SMOKE_ID_TOKEN=... npm run payments:workflow:smoke:browser -- --frontend-base http://localhost:3001 --screenshot-dir tmp/payments-smoke`; authenticated Puppeteer smoke passed for both the Case Workspace payment surface and `/iset/payments`, with no browser console/page/API failures and verified cleanup.
- Browser evidence from the pass was written to `tmp/payments-smoke/payments-smoke-case-94968224e172.png` and `tmp/payments-smoke/payments-smoke-dashboard-94968224e172.png`.

TEST rehearsal status on 2026-05-11:

- TEST read-only preflight found zero payment packet/line/document/communication/follow-up rows, two historical `manual_backload_history` finance transactions, `finance.email.routing.enabled=false`, and Intacct disabled.
- TEST release `20260511-test-payments-workflow` applied pending migrations through `20260511_0001_add_payment_followup_model.sql` and deployed the admin app under the documented admin maintenance warning plus ALB fallback sequence.
- TEST rollback DB smoke passed on an app instance after staging the runner temporarily through `s3://nwac-test-artifacts`, then removing the staged object.
- Initial authenticated browser smoke exposed that the deployed authenticated `apiFetch` path ignored the existing runtime API-base override and used the build-time public TEST origin, which made on-instance browser automation fail even though the API smoke passed.
- TEST corrective admin release `20260511-test-payments-api-base` updated `src/auth/apiClient.js` to honor `window.__API_BASE__` for authenticated API calls, again deployed under admin warning plus ALB fallback.
- Authenticated TEST API + Puppeteer smoke then passed against the deployed admin bundle using `program.admin@awentech.ca`: packet create, evidence attach, validation, retired direct send endpoint, safe post-send state, communication logging, follow-up history, case-scoped list/detail hydration, Case Workspace rendering, `/iset/payments` rendering, no browser console/page/API failures, and cleanup verified.
- Final TEST cleanup query returned zero synthetic rows across smoke users, clients, cases, submissions, documents, packets, packet lines, finance transactions, communications, and follow-up events.
- Paused state: use this document plus `docs/planning/payments-transformation-plan-2026-05-11.md` when resuming. Do a fresh PROD read-only preflight before any PROD deploy or email-routing change.

## Target DEV Workflow Automation

Build the remaining automation in this order:

1. Rollback DB fixture script that creates a safe synthetic case, approved intervention, budget pot, packet, line, and evidence rows inside a transaction, then proves packet creation, line-level evidence attach, validation, submission blockers, and cleanup invariants. Status: implemented and passing in DEV.
2. Authenticated DEV API smoke for payment packet list/detail/create/validate/submit/follow-up routes using a temporary staff identity or documented DEV test user. Status: implemented and passing in DEV with `program.admin@awentech.ca`.
3. Puppeteer browser smoke for the Case Workspace payment surface: create draft packet, add/link evidence, validate, verify send controls and lock behavior without sending real external email. Status: implemented and passing in DEV.
4. Puppeteer browser smoke for the cross-client `/iset/payments` dashboard: create draft packet through case search, select it, verify detail/communications stay in sync, and validate send/follow-up controls without sending real external email. Status: implemented and passing in DEV.
5. TEST rehearsal smoke after deployment with safe email routing disabled or pointed at approved test recipients. Status: implemented and passing in TEST with email routing disabled.
6. PROD preflight stays read-only until Bill explicitly approves any real send/config change.

## Guardrails

- Do not send real Finance/applicant email in PROD without explicit approval for that exact action.
- Use documented DEV/TEST/PROD DB access paths; do not experiment with ad hoc connection attempts.
- Browser smokes should fail on console errors, failed API responses, backend `500`s, and visible workflow mismatches.
- Every persistent fixture mode must include cleanup verification.
- An attempt in `ambiguous` state must be reconciled by an authorized operator/provider check; automation must not resend it.
