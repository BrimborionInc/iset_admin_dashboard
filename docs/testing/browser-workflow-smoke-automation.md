# Browser Workflow Smoke Automation

Status: current guidance from the 2026-05-08/09 application-assessment containment release, updated with the 2026-05-28 dashboard request-loop regression rule.

Audience: Codex threads and developers building or rehearsing browser-level workflow smokes for PATH.

Last Updated: 2026-05-28

## Purpose

Use this note when a workflow defect needs more than route health checks or SQL counts, especially approval, assessment, letter-generation, queue, and workspace flows where the bug depends on selected case/application/proposal state.

The core lesson from the repeat-application assessment release is that browser testing should prove workflow invariants, not merely click through screens. The useful automation combined database fixtures, authenticated API checks, browser route checks, and post-run SQL cleanup verification.

## Layered Pattern

1. Start with DB/API fixture automation.
   - Create a rollback fixture mode for fast proof that can run inside a transaction.
   - Add a persistent fixture mode when a browser needs stable IDs and late workflow state.
   - Assert data invariants directly: selected owner, no duplicate owners, no root-context leakage, document provenance, queue eligibility, and legacy compatibility.

2. Use real authenticated paths.
   - Prefer temporary Cognito staff users plus temporary `staff_profiles` rows over auth bypasses.
   - Create required workflow preconditions explicitly, such as conflict declarations or application locks.
   - Clean up temporary users, staff rows, locks, declarations, and any edited fixture values.

3. Drive the browser to the risky workflow surface.
   - Use direct deep links when the product supports them, for example a case/application workspace with `applicationId`, `entry`, `approvalType`, and `step`.
   - Target the exact late-stage surface that failed, rather than forcing a human to repeat every previous step.
   - Capture both positive and negative assertions: expected action is available, prior-record text is absent, sent/read-only markers are absent, and editable fields are actually editable.

4. Capture network and server failures.
   - Treat browser-console errors, failed API responses, and backend `500`s as first-class smoke failures.
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

## Automation Backlog

Future high-risk workflow releases should prefer adding a small, owned smoke script with the same shape:

- deterministic fixture creation;
- rollback and persistent fixture modes;
- real-auth API helpers;
- optional browser layer;
- strict post-run cleanup checks;
- environment-specific notes for DEV, TEST, and PROD.

Good candidates are the three approval families:

- application assessment approval;
- case-manager new intervention proposal approval;
- intervention revision/change approval.

Those workflows share enough shape that a small library of auth, fixture, cleanup, network-capture, and deep-link helpers would reduce repeated manual walkthroughs without hiding workflow-specific assertions.
