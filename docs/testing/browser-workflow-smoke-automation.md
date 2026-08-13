# Browser Workflow Smoke Automation

Status: current guidance from the 2026-05-08/09 application-assessment containment release, updated with the 2026-08-09 intervention identity and correction matrix.

Audience: Codex threads and developers building or rehearsing browser-level workflow smokes for PATH.

Last Updated: 2026-08-13

## Purpose

Use this note when a workflow defect needs more than route health checks or SQL counts, especially approval, assessment, letter-generation, queue, and workspace flows where the bug depends on selected case/application/proposal state.

The core lesson from the repeat-application assessment release is that browser testing should prove workflow invariants, not merely click through screens. The useful automation combined database fixtures, authenticated API checks, browser route checks, and post-run SQL cleanup verification.

## Release-Suite Child Result Contracts

The compiled release browser suite runs 13 native children. Their product
assertions and native failure decisions remain authoritative; the suite only
normalizes their existing top-level result envelopes. The admitted contracts
are finite and bound to the configured child ID:

| Native envelope | Configured children | Admitted success | Admitted failure |
| --- | --- | --- | --- |
| `ok-conditional-failures` | `app-shell-navigation`, `manual-intake` | `ok: true`; no top-level `failures` or `error` | `ok: false`; non-empty object-array `failures` |
| `ok-conditional-failures-or-error` | `home-overdue` | `ok: true`; no top-level `failures` or `error` | `ok: false`; object-array `failures`, with a non-empty `error` permitted when the array is empty |
| `pass-conditional-failures` | `esdc-participants`, `case-assignment`, `manage-components`, `modify-component`, `application-workspace` | `pass: true`; no top-level `failures` or `error` | `pass: false`; non-empty object-array `failures` |
| `pass-conditional-failures-or-diagnostic-error` | `application-overview` | `pass: true`; no top-level failure fields | `pass: false`; either non-empty object-array `failures`, or one non-empty `error` plus a diagnostic record |
| `pass-nested-scenarios` | `application-assessment`, `intervention-workflow` | `pass: true` exactly agrees with non-empty successful `scenarios`; every scenario has an empty `failures` array | `pass: false` exactly agrees with at least one failed scenario carrying native failure objects |
| `pass-required-failures` | `intervention-posting-context`, `intervention-recall` | `pass: true` with an empty `failures` array | `pass: false` with a non-empty object-array `failures` |

The normalizer retains the complete native result beside the normalized child
ID, contract, pass value, and failures. Unknown child IDs, mixed `ok`/`pass`
flags, malformed or truncated JSON, undocumented failure containers,
success-with-failure evidence, scenario-summary disagreement, and disagreement
between native authority and process exit status fail closed. Child-specific
semantic assertions, including the posting-context final-record proof, run
against the retained native result after normalization.

## Layered Pattern

1. Start with DB/API fixture automation.
   - Create a rollback fixture mode for fast proof that can run inside a transaction.
   - Add a persistent fixture mode when a browser needs stable IDs and late workflow state.
   - Assert data invariants directly: selected owner, no duplicate owners, no root-context leakage, document provenance, queue eligibility, and legacy compatibility.
   - Mirror the live database result shape used by the production caller. A service test that injects the correct argument does not prove the route/job/event handler resolved it; exercise that real caller boundary and omit nonexistent columns from fixtures.

2. Use real authenticated paths.
   - Prefer temporary Cognito staff users plus temporary `staff_profiles` rows over auth bypasses.
   - Create required workflow preconditions explicitly, such as conflict declarations or application locks, through the exact product request boundary and workflow state. Do not treat a seeded precondition or visible downstream control as proof that the real prerequisite is accepted.
   - Clean up temporary users, staff rows, locks, declarations, and any edited fixture values.

3. Drive the browser to the risky workflow surface.
   - Use direct deep links when the product supports them, for example a case/application workspace with `applicationId`, `entry`, `approvalType`, and `step`.
   - Target the exact late-stage surface that failed, rather than forcing a human to repeat every previous step.
   - Capture both positive and negative assertions: expected action is available, prior-record text is absent, sent/read-only markers are absent, and editable fields are actually editable.

4. Capture network and server failures.
   - Treat browser-console errors, failed API responses, and backend `500`s as first-class smoke failures.
   - Scope repeated action labels to a stable product-owned surface, and after each asynchronous navigation wait for that surface's explicit active-state signal. Do not use page-global body text as a step-completion signal when the same text can exist in wizard navigation, hidden content, notifications, or another widget.
   - Include a small route/API smoke for adjacent surfaces touched by the change, such as application lists, work queues, decision queues, and document rows.
   - For dashboard/widget changes, keep network capture open after initial render and after sort/filter/page-size interactions. Fail the smoke if a non-polling endpoint keeps firing or canceling after the UI should be idle; this catches the recurring unstable-dependency loop class before it reaches TEST/PROD.

5. Reconcile with the database after browser actions.
   - Check that only the selected workflow object mutated.
   - Check that unrelated legacy rows were not changed.
   - Check generated documents attach to the selected owner.
   - Restore fixture values when the smoke temporarily edits a persistent fixture.

## TEST And Deployed-Environment Notes

- TEST/PROD route health is not enough for a workflow release. Health smokes prove the app is up; workflow smokes prove the release behavior is safe.
- If the public TEST ALB blocks the Codex host, a deployed-browser smoke can still be useful by loading the deployed frontend origin and routing/intercepting API calls to the instance-local backend through SSM or localhost on the target instance. Record this explicitly, because it proves the deployed bundle plus deployed backend, but not public internet routing from Codex.
- TEST deliberately disables SES email. Browser smokes for approval-letter workflows should not click real send actions unless the environment and recipient are intentionally approved.
- PROD browser smokes must avoid sending real applicant email unless Bill explicitly approves that exact send. Prefer read-only or draft/save-safe assertions in PROD.

## Live TEST Two-Step Review Reference

The Regional Manager two-step review workflow has a live TEST smoke:

- Script: `scripts/two-step-review-test-smoke.js`
- Typical command: `node scripts/two-step-review-test-smoke.js --profile nwac-test --region ca-central-1 --json`

This smoke creates disposable TEST Cognito staff users for ISET Coordinator, Regional Manager, and NWAC Administrator, seeds synthetic DB fixtures on the deployed TEST host through SSM, authenticates with real Cognito tokens, drives the deployed backend and deployed browser bundle through localhost on the app instance, and then removes Cognito users, DB rows, generated documents, notifications, and S3 objects. The harness discovers the current online `nwac-test-app` instance instead of hard-coding an instance ID; this matters because TEST is a one-instance ASG and replacement can change the host ID.

Harness-only acceptance corrections do not require redeploying the product candidate. The local operator transfers the exact current runner as an attempt-owned, SHA-256-bound temporary artifact, the TEST host verifies and executes that copy from its attempt-owned `/tmp` path, and both the remote copy and every S3 version are removed and independently checked during cleanup. `--assessment-start-only` limits live product actions to the conflict-declaration/application-status journey while retaining the existing schema preflight, synthetic fixture ownership, object inventory, cleanup, and zero-residue proof. The EI document manifest assertion follows the product-owned canonical metadata value `crf`; `CRF` remains the display/request and assessment-row form.

Coverage as of 2026-07-05 includes runtime flag/config checks, real role hydration, application assessment workflow, new intervention proposal workflow, intervention revision workflow, RM-as-submitter proposal start, NWAC start/final-decision guards, edit locks, browser route text, generated assessment PDFs, normalized intervention-document links, notification routing for RM review/final-decision/change-request handoffs, invalid-stage checks, and browser console/API error capture. The passing TEST run used SSM command `8428df04-2235-46e6-9533-7187a7260ac3` on replacement host `i-052566d75e0214d00`; cleanup reported zero synthetic cases, applications, interventions, documents, notifications, staff profiles, and users.

Implementation notes: the TEST EC2 host returned `403 Forbidden` for Hosted UI login from instance-local browser automation, so the smoke uses Cognito password auth tokens directly. Final-decision `rm_review_submitted_to_nwac` bell alerts are role-audience notifications for `NWAC Administrator`, not staff-specific rows, so smoke assertions should verify role audience for that event.

The 2026-08-07 Amanda correction release extended this smoke through the complete returned-assessment path: Financial Overview request/signing, authoritative review-stage recovery, same-person Regional Manager edit and Save Progress, every wizard transition, exact-application resubmit, RM sign-off, and Decision Maker queue/open. Browser navigation waits for the product-owned `data-path-assessment-step` signal after every click. Optimistic-concurrency checks capture the exact database state after the UI's intentional pre-submit refresh and immediately before the held request is dispatched; a pre-navigation row-version snapshot is not a valid expected token. Cleanup orders live-schema-proven `cfa_version` and `funding_overview_version` self-references child-first and `--cleanup-stamp <exact-stamp>` provides fail-closed recovery for an interrupted fixture. Passing evidence `tmp/two-step-review-test-smoke/two-step-1786128748799-61d4d58ce0-journey.json` records 96/96 checks, exact resubmit/signing cardinality, and zero residue; the wrapper independently verified all disposable Cognito users, temporary S3 objects, and the ephemeral credential absent.

The TEST host runner performs exact-prefix AWS object inventory with synchronous CLI children. Treat a pooled loopback socket surviving that event-loop-blocking interval as unsafe for an effectful document upload. A `Connection: close` request header is insufficient because the client selects a pooled socket before sending that header. The upload must instead create a new one-request Undici `Client` for the exact loopback origin, read the bounded response, and close that dispatcher; it must never retry automatically. Keep the inventory and cleanup calls unchanged. Every bounded-fetch failure must retain a query-free target, method, start/dispatch/failure timestamps, elapsed time, timeout/abort state, and the complete recursively serialized `error.cause` fields; authorization, cookies, secrets and token values remain excluded. The local transport regression uses an independently running synthetic server, deliberately closes the pooled keep-alive socket while the runner event loop is blocked, proves the old header-only boundary produces `EPIPE`, and proves the corrected POST arrives exactly once on a different connection.

## Option B Reference Implementation

The repeat-application assessment release added a reusable DB-backed smoke:

- Script: `scripts/application-assessment-option-b-smoke.js`
- NPM alias: `npm run assessment:option-b:smoke`
- Related context backfill tooling: `npm run assessment:context:plan` and `npm run assessment:context:apply`

Useful modes from that work:

- `npm run assessment:option-b:smoke -- --fixture`
- `npm run assessment:option-b:smoke -- --fixture --keep-fixture`
- `npm run assessment:option-b:smoke -- --case-id 6 --app-a 11 --app-b 12 --stage fresh-step14`

The authenticated DEV/TEST browser smoke for Option B proved:

- Application 1 and Application 2 hydrated different assessment rows from the same long-lived case.
- Saving Application 2 did not mutate Application 1 or legacy `iset_case_assessment`.
- Step 14 `Approval letters` for Application 2 opened editable and did not inherit Application 1 draft text, letter pack, or sent/read-only state.
- Application queues and decision APIs still returned `200`.
- Generated assessment PDFs were attached to the selected `application_id`.
- Applicationless legacy cases stayed usable.

The canonical evidence and exact fixture IDs live in `docs/planning/application-assessment-application-scope-migration-plan.md`.

## Applicant Scope Guard Reference

The 2026-05-26 public-portal privacy release added a TEST wrong-applicant smoke:

- Script: `scripts/applicant-scope-guard-test-smoke.js`
- Typical command: `node scripts/applicant-scope-guard-test-smoke.js`
- API-only diagnosis: `node scripts/applicant-scope-guard-test-smoke.js --skip-browser`

The smoke creates temporary TEST Cognito applicant users, seeds a synthetic stale applicant/application/case cross-link through SSM on a TEST app host, proves the rightful applicant still has dashboard/message/intervention/signing access, proves the wrong applicant is denied or shown only safe submission metadata, runs a Puppeteer dashboard/messages check from the TEST host, then deletes the Cognito users and fixture rows.

## ILMP Participant Queue Reference

The ILMP Submissions & Exports dashboard has a local browser smoke:

- Script: `scripts/esdc-participant-queue-browser-smoke.js`
- NPM alias: `npm run smoke:esdc-participants:browser`

This smoke loads the real local React bundle at `http://localhost:3001/esdc/participants`, injects a synthetic System Administrator browser session, stubs the required API responses, and verifies the combined participant queue renders with bucket-style validation counters, sortable table headers, participant rows, the queue-header `Generate batch XML` action, and no standalone duplicate Validation Summary or Batch submission widget. It clicks `Generate batch XML`, confirms the UI calls `/api/esdc/participants/batch-prepare`, and checks that the batch modal has a filename field without the retired XML preview or fake download-path field. It is useful for visual/layout regressions when no reusable Cognito staff token is available in the shell. Pair it with a live local endpoint smoke for `/api/esdc/participants` when backend route shape or returned data semantics changed.

The script automatically prepends the current WSL local Chrome dependency path (`/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu`) to `LD_LIBRARY_PATH` when present, so the npm alias works from a normal shell without manually exporting the Puppeteer NSS/NSPR workaround.

## App Shell Navigation Reference

The global Cloudscape AppLayout side navigation has a local browser smoke:

- Script: `scripts/app-shell-navigation-browser-smoke.js`
- NPM alias: `npm run smoke:app-shell-navigation:browser`

This smoke loads the real local React bundle on `/`, `/manage-components`, and `/application-case/1?applicationId=2`, injects a synthetic System Administrator browser session, and stubs common shell API calls. It verifies the side-navigation close and open controls with real pointer clicks and `elementFromPoint`, so it catches the regression where the visible close chevron existed but the `Homepage` SideNavigation header was the top hit target. Use it after global shell, Cloudscape AppLayout, SideNavigation, tutorial-hotspot, or top-level CSS changes.

## Manual Application Intake Reference

The Manual Application Intake dashboard has a local browser smoke:

- Script: `scripts/manual-application-intake-browser-smoke.js`
- NPM alias: `npm run smoke:manual-intake:browser`

This smoke loads the real local React bundle at `/iset/applications/intake`, injects a synthetic System Administrator browser session, stubs the published intake schema to a minimal identity step, and verifies the staff-assisted intake wrapper. It checks the `Staff-Assisted Intake Flow` widget, the `Staff-Assisted Intake Wizard`, account search through `/api/admin/applicants`, selecting an existing client/account match, wizard navigation through account handling, application details, and review, posting `/api/applications/manual-intake`, and carrying the selected-client account decision in the request payload. It captures `tmp/manual-intake-smoke/manual-application-intake.png` for visual review.

## Case Assignment Dashboard Reference

The Manage ISET Applications / Case Assignment dashboard has a local browser smoke:

- Script: `scripts/case-assignment-dashboard-browser-smoke.js`
- NPM alias: `npm run smoke:case-assignment:browser`

This smoke loads the real local React bundle at `http://localhost:3001/case-assignment-dashboard`, injects a synthetic Regional Manager browser session, stubs the supporting API responses, and verifies the applications table renders inside the standard dashboard widget board with Add widget / Reset layout controls and no retired instructional filler. It opens the reassignment modal and verifies that the RM can select both a local ISET Coordinator and a Regional Manager from another region. It also checks the `/api/applications` request contract for initial load, Applicant sorting, server-backed search, legacy `?status=Pending Approval` routing to `statusGroup=pending_decision`, and `?bucket=awaiting-decision` routing to a server-backed work-queue filter. Network capture remains open after initial render and the smoke fails if `/api/applications` keeps firing after the dashboard should be idle.

Use this smoke for local UI regressions when no reusable Cognito staff token is available in the shell. Pair it with authenticated DEV/TEST API checks when validating the real database semantics of `/api/applications` bucket filtering.

## Home Overdue Queue Reference

The homepage `Work Queue` / `Work Queue Items` Overdue path has a focused local browser smoke:

- Script: `scripts/home-overdue-queue-browser-smoke.js`
- NPM alias: `npm run smoke:home-overdue:browser`

This smoke loads the real local React bundle at `http://localhost:3001/`, injects a deterministic `NWAC Administrator` session, stubs the homepage queue APIs, dismisses the quick-start tutorial prompt, selects the `Overdue` queue card, and verifies two rendered application rows. One row has `assessment_esdc_eligibility` saved and must render as `In Review` without a false `Awaiting EI Validation` badge; the other deliberately lacks EI eligibility and must still show the legitimate `Submitted` / `Awaiting EI Validation` status. It also checks that `/api/applications` settles after the initial dashboard loads.

Use this smoke after changing Home dashboard queue mapping, application SLA/overdue logic, application status labels, EI eligibility row-shape handling, or `WorkQueueItemsTableWidget` status rendering.

## Manage Components Dashboard Reference

The Manage Intake Steps / Manage Components dashboard has a local browser smoke:

- Script: `scripts/manage-components-dashboard-browser-smoke.js`
- NPM alias: `npm run smoke:manage-components:browser`

This smoke loads the real local React bundle at `http://localhost:3001/manage-components`, injects a synthetic System Administrator browser session, stubs `/api/steps`, `/api/steps/:id`, and `/api/preview/step`, and seeds a saved layout with only the Intake Step Library widget. It verifies the page-level Add widget and Reset layout controls are in the route header, the split-panel palette exposes missing widgets, reset restores Intake Step Library, Preview, and Step JSON, the intake-step table has sortable/resizable columns, selecting a step renders the preview iframe within and across the available board-item body, and `/api/steps` does not keep refiring after idle or row selection. It captures `tmp/manage-components-smoke/manage-components-dashboard.png` for visual review.

Use this smoke for Workflow Studio / intake-authoring dashboard regressions when no reusable Cognito staff token is available. Pair it with live DEV/TEST endpoint checks when changing `/api/steps` or the preview-rendering backend contract.

## Modify Intake Step Editor Reference

The Modify Intake Step editor has a local browser smoke:

- Script: `scripts/modify-component-editor-browser-smoke.js`
- NPM alias: `npm run smoke:modify-component:browser`

This smoke loads the real local React bundle at `http://localhost:3001/modify-component/132`, injects a synthetic System Administrator browser session, and stubs `/api/steps/:id`, `/api/component-templates`, `/api/render/component`, and workflow-context APIs. It verifies the editor route/header regions, static-only option authoring, searchable component library, repeated static text-block preservation, clean-load disabled Save state, component selection, library add, working-area render of the added component, precise backend save-error alerting, successful save payload shape, validation panel, screenshot capture, and idle API settling after initial render and component selection. It also asserts ordinary save payloads do not include `ui_meta` or editor-only `__workflowFields`.

Use this smoke when changing `src/pages/modifyIntakeStep.js`, `src/pages/PropertiesPanel.js`, step save routes, component-template shapes, or server-side component rendering. Pair it with a live authenticated DEV/TEST check when validating real DB component templates or publish parity.

## Application Overview Reference

The Application Overview widget has a local browser smoke for the Docs Requested toggle:

- Script: `scripts/application-overview-docs-requested-browser-smoke.js`
- NPM alias: `npm run smoke:application-overview:browser`

This smoke loads the real local React bundle at `http://localhost:3001/application-case/1?applicationId=2`, injects a synthetic System Administrator browser session, restricts the workspace layout to Application Overview, and stubs the supporting API responses. It intentionally makes `/api/applications/2` return an older `row_version` than `/api/cases/1?applicationId=2` returns as `application_row_version`, then clears the `Documents requested` toggle. The smoke fails if the UI sends the stale row version, shows the false "another user updated" warning, or fails to show the cleared document-request state.

## Application Workspace Reference

The ISET Application Assessment / Application Workspace dashboard has a local browser smoke:

- Script: `scripts/application-workspace-dashboard-browser-smoke.js`
- NPM alias: `npm run smoke:application-workspace:browser`

This smoke loads the real local React bundle at `http://localhost:3001/application-case/1?applicationId=2`, injects a synthetic System Administrator browser session, clears the saved workspace layout, and stubs the supporting API responses for a deterministic application file. It verifies the default widget set renders, the page stops calling APIs after initial load, Supporting Documents search narrows the displayed document table, Secure Messaging Date/Time sorting toggles the full visible inbox list, and the Notes and Reminders refresh control calls `/api/cases/:id/notes` exactly once. It captures `tmp/application-workspace-smoke/application-workspace-default-layout.png` for visual review.

The smoke currently records, but does not fail on, a React unique-key warning from `SupportingDocumentsWidget` modal/`SpaceBetween` composition during workspace render. Treat that warning as targeted UI cleanup backlog.

## Application Assessment Workflow Reference

The Application Assessment widget has a deeper local browser workflow smoke:

- Script: `scripts/application-assessment-workflow-browser-smoke.js`
- NPM alias: `npm run smoke:application-assessment:workflow:browser`

This smoke loads the real local React bundle at `http://localhost:3001/application-case/1?applicationId=2`, injects deterministic staff sessions, stubs the required case/application/document/message APIs, and drives the risky workflow branches instead of only checking route health. It covers:

- conflict declaration signing by an ISET Coordinator, including promotion to in review and the selected application's row-version token;
- coordinator assessment submission from draft to Pending Approval with recommendation, justification, date, proposed intervention payload, and selected-application row-version token;
- two-step coordinator and Regional Manager draft assessment submission into Regional Manager review while the workflow flag is enabled;
- coordinator recall of a pending assessment, including the read-only pending state, recall confirmation, `/api/cases/:id/assessment/recall` request body, and return to an editable resubmission state;
- two-step Regional Manager review, including RM return to Coordinator with required notes, RM submit to NWAC approval, the Decision Maker's request-changes action returning to RM first, RM forwarding requested changes to the Coordinator, and no direct RM resubmission to NWAC from the returned-to-RM state;
- exceptional reopened-approved assessment recovery, including the correction-required warning, hidden final-decision escalation, and successful return to the original Coordinator;
- the feedback `#179` browser branches as deterministic isolated scenarios: Decision Maker request-changes returns to RM; `Forward changes to Coordinator` remains available under the reproduced lifecycle drift; and a Regional Manager who is the recorded original submitter can navigate a legacy returned assessment with no EI verification document, edit and save the requested field, traverse every remaining step, and resubmit it to RM review with the explicit submit marker and without Decision Maker fields. The already accepted EI value must remain unchanged for that legacy exception; changing it still requires current evidence. The live TEST harness composes Financial Overview signing, queue routing, repeat-application isolation, edit/resubmit, and RM sign-off into one end-to-end journey;
- NWAC approval decision commit from the approval deep link, including the review status, approved outcome, initiated case status, and selected-application row-version token;
- approval-letter send with a workflow-generated attachment and application-scoped `caseContext.applicationDecisionLetters[application_id]` sent marker, without leaking the decision-letter state to root context;
- funding-documents completion for an approved application after the scoped approval-letter sent marker is present.

The smoke captures screenshots under `tmp/application-assessment-workflow-smoke/`. It fails on failed API responses, serious browser console errors, unhandled exceptions, and the React warning class where a child render path updates the route parent. It currently records, but does not fail on, the same `SupportingDocumentsWidget` React unique-key warning tracked in the Application Workspace smoke.

Live DEV role-based walkthrough evidence for the Regional Manager two-step application-assessment slice was captured on 2026-06-19 under `tmp/rm-review-live-ui/2026-06-19T17-22-44-405Z/`. That walkthrough used real applicant/coordinator/RM/NWAC test role logins and covered RM EI status/report upload, coordinator submit/resubmit, RM return, RM submit to NWAC, the Decision Maker's request-changes action returning to RM, RM forward to coordinator, and final NWAC approval. It complements the deterministic smoke; keep the smoke as the repeatable regression guard and use live walkthroughs for deployment/UAT evidence.

Live TEST route evidence for release `20260626-rm-two-step-role-matrix-test` was captured on 2026-06-26 using real TEST Cognito/staff users for all four active PATH staff roles. It verified the deployed application-assessment route with RM lock acquisition and RM submit to `application_assessment/rm_review`, the deployed intervention proposal route with NWAC/System Administrator start attempts blocked and RM start allowed, and the deployed intervention revision route with NWAC/System Administrator submit attempts blocked and RM submit allowed. The revision route generated the submitted v2 and redline v2 assessment PDFs. All disposable live TEST cases, locks, generated document rows, and S3 objects were cleaned up. This live route evidence should be repeated for future workflow hotfixes that alter role/start/final-decision behavior.

The live TEST two-step review harness must fail closed before fixture work. It binds the authorized TEST AWS account, instance, database host/name/user, and verifies the connected database principal; captures `SHOW CREATE TABLE` plus `SHOW FULL COLUMNS` for every directly touched table; and validates every finished non-metadata statement against that evidence immediately before execution. Workflow, region, and budget references are resolved from verified live catalogues rather than hard-coded ids. Raw driver queries are metadata-only, all operational statements use the guarded executor, and a preflight/selector failure closes the connection without attempting fixture cleanup. The feedback `#179` acceptance path must continue to use the real ISET Coordinator, Regional Manager, NWAC Administrator, and applicant roles. Live TEST uses only normal deployed operations: it issues exact-payload concurrent Financial Overview signing calls plus a post-commit replay while the RM forward is in flight, completes the RM conflict declaration through the real returned-to-RM API boundary, then races an applicant signing against two identical UI-derived returned-assessment resubmits. It requires the declaration-only request to succeed while assessment-body edits remain locked, the RM forward action to become reachable, one resubmit commit, one stale row-version conflict, a side-effect-free stale replay, one review transition, exact event counts, unique document versions, and a one-to-one match between new database documents and new S3 object versions. It also checks returned-to-RM edit/escalation denials, queue ownership, Pending Completion coexistence, repeat-application sentinels, and the Decision Maker handoff. Pre-commit generated-file failure/compensation and lost-COMMIT-acknowledgement branches are proved separately by focused full-stack fake tests against the exact frozen server candidate; live TEST must not corrupt fixture state or depend on a deployed fault-injection header. The remote host independently proves its AWS role and exact bucket before inventorying all fixture-owned object prefixes and versions. Detailed evidence is transferred by a compact SSM pointer plus verified S3 SHA-256, and cleanup exports the deleted key/version manifest, verifies zero database/object/Cognito residue, and removes exact-stamp `/tmp` diagnostics.

The submitted-assessment EI correction fix has a focused DEV end-to-end smoke:

- Script: `scripts/application-assessment-ei-correction-dev-smoke.js`
- NPM alias: `npm run smoke:application-assessment:ei-correction:dev`

This smoke creates disposable DEV Cognito staff users for a Regional Manager and ISET Coordinator, seeds a synthetic Nunavut application assessment with an active EI verification document and active two-step review row, authenticates with real Cognito bearer tokens, checks the local backend route through `/api/locks/application/:id` and `PUT /api/cases/:id`, drives the local React Application Assessment widget with Puppeteer, and then removes Cognito users plus DB fixture rows. Coverage includes RM post-submission EI correction before dependencies, the browser dropdown remaining enabled for the RM, the browser sending a real EI correction PUT, ISET Coordinator denial, and RM dependency blocking once an action plan exists. Direct Cognito password auth is not currently usable with the DEV client/IAM shape, so the smoke falls back to the Hosted UI login path used by staff browsers.

The Client Monthly Attendance Report has a focused real-DEV end-to-end smoke:

- Script: `scripts/monthly-attendance-report-dev-smoke.js`
- NPM alias: `npm run smoke:monthly-attendance-report:dev`

The smoke verifies both env files resolve to the DEV AWS account, creates disposable real Cognito staff/applicant identities and a selected-intervention fixture, sends workflow `54` through the secure-message API, checks editable participant/institution/program prefill, proves malformed direct signing is rejected, completes the absence branch in the real portal, uploads participant-owned `medical_documentation`, signs, and downloads the generated PDF. It then proves signed-payload/document idempotency and removes Cognito, MySQL, and MinIO fixture residue. Evidence is written under `tmp/monthly-attendance-report-dev-smoke/`.

The exact content tree received a focused deployed TEST run under SSM command `9a02c39e-0486-4772-ba76-0ea6dda53336`, covering same-month date bounds, progressive absence rows, synthetic supporting evidence, signing, the one-page NWAC-style PDF, idempotency, and zero fixture residue. After the same content was committed, release `20260714-client-monthly-attendance-prod` repeated the complete generic TEST acceptance gate and reached `GO`; no functional source content changed between the focused run and the committed rehearsal, as shown by identical admin/portal/shared tree fingerprints.

The Case Workspace Intervention Assessment recall path has a focused local browser smoke:

- Script: `scripts/intervention-assessment-recall-browser-smoke.js`
- NPM alias: `npm run smoke:intervention-assessment:recall:browser`

This smoke loads the real local React bundle at `http://localhost:3001/cases/1?entry=approval&approvalType=intervention&step=decision&interventionId=101&planId=10`, injects a deterministic ISET Coordinator session, stubs a submitted intervention proposal, verifies the proposal body is read-only while awaiting decision, clicks `Recall submission`, confirms the `/api/interventions/:id/assessment/recall` call, and verifies the widget returns to a draft/resubmission state.

The Case Workspace Intervention Assessment two-step workflow has a deeper local browser smoke:

- Script: `scripts/intervention-assessment-workflow-browser-smoke.js`
- NPM alias: `npm run smoke:intervention-assessment:workflow:browser`

This smoke loads the real local React bundle at `http://localhost:3001/cases/1?entry=approval&approvalType=intervention&interventionId=101&planId=10`, injects deterministic Coordinator, Regional Manager, NWAC Administrator, and System Administrator sessions, and stubs proposal/revision API responses. Its returned-work identity matrix covers both a new proposal and a revision for six actor cases: the recorded Coordinator submitter, a different Coordinator, a different Regional Manager, the Decision Maker, System Administrator technical support, and a Regional Manager who is also the recorded submitter. Non-owners remain read-only and produce no PATCH/review mutation. The same-person RM journey proves returned edit, one correction autosave, resubmission to `rm_review`, no premature RM shortcut, and a separate post-resubmission RM sign-off to `nwac_review`.

The full 2026-08-09 matrix passed 12/12 scenarios against a fresh production build. It also asserts that intervention-code/NOC reference requests settle after initial hydration and that wizard navigation does not emit repeated identical returned-body autosaves. Earlier workflow coverage remains: RM draft proposal/revision submission, RM return, escalation to final decision, Decision Maker review and request-changes routing, forwarded notes, Shelley-threshold warning, final proposal/revision review, and post-approval communication deep links. Stubbed submit/review endpoints call `src/lib/reviewWorkflow.js`, so browser behavior still fails when the shared role/stage transition contract rejects an action. This local deterministic pass is required evidence, not a substitute for the exact deployed TEST role journey.

## Existing Intervention Paid From Reference

The Case Workspace existing-intervention editor has a focused compiled-browser smoke:

- Script: `scripts/intervention-posting-context-browser-smoke.js`
- Release-suite ID: `intervention-posting-context`

The smoke loads `/cases/1` as a Regional Manager with a deterministic internal
manual-backload intervention under an external Action Plan. It verifies that
`Paid from` remains `Internal (NWAC)` when that historical operational record is
viewed and edited, that its PATCH preserves `postingContext=internal`, and that
the refreshed intervention reopens with the same value. A second exact-
application fixture with `final_decision_recorded` review lineage proves that a
finally reviewed proposal remains read-only and emits no additional PATCH. It
also checks that Case Workspace API traffic settles after both paths.

## Automation Backlog

Future high-risk workflow releases should prefer adding a small, owned smoke script with the same shape:

- deterministic fixture creation;
- rollback and persistent fixture modes;
- real-auth API helpers;
- optional browser layer;
- strict post-run cleanup checks;
- environment-specific notes for DEV, TEST, and PROD.

Good candidates are the remaining approval families:

- remaining PDF artifact assertions for intervention proposal/revision final packets.

Those workflows share enough shape that a small library of auth, fixture, cleanup, network-capture, and deep-link helpers would reduce repeated manual walkthroughs without hiding workflow-specific assertions.
