# Application Assessment Ownership Containment Plan

Status: Option B containment deployed to PROD

Purpose: document the agreed first production-safe fix for the repeat-application assessment defect, and preserve the blast-radius analysis for the later full ERM correction.

Audience: engineering, product, operations, release planning, and future Codex threads.

Last Updated: 2026-05-09

## Executive Summary

PATH now supports the target model `one client -> one long-lived case -> many applications`, but application assessment persistence has not caught up. `iset_case_assessment` is still effectively case-scoped, so a repeat application on the same case can open the first application's assessment, and saving the second application's assessment can overwrite the first.

Current decision: choose **Option B: narrow containment first**. Add an additive application-scoped assessment store, `iset_application_assessment`, and move only the application assessment workflow plus its direct read/write surfaces onto that store. Do not do the full in-place `iset_case_assessment` ERM correction as the first production bugfix.

Current deployment state: Option B containment shipped to PROD on 2026-05-09 as release `20260509-prod-option-b-plus-portal`. PROD now has the additive `iset_application_assessment` store, application-assessment read/write containment, selected-application approval-letter context scoping, and backfilled legacy rows where ownership was clear. PROD had no repeat-application cases at deployment time, so repeat-application functional behavior remains covered by the DEV/TEST fixtures until the first real PROD repeat case appears.

Option A, the full in-place migration of `iset_case_assessment` to application ownership, remains the cleaner long-term target, but it has a large blast radius. Once multiple assessment rows per case are allowed, every `case_id`-only assessment read becomes dangerous.

## Problem Being Fixed

The model migration to one client/case with many applications has been completed enough that repeat public portal intakes now create a second `iset_application` under the existing long-lived case.

The remaining defect:

- `iset_case_assessment` is keyed by `case_id`.
- It has no `application_id`.
- Assessment saves use `case_id` and `ON DUPLICATE KEY UPDATE`.
- Case/application hydration joins assessment data by `ca.case_id = c.id`.
- Opening Application 2 can load Application 1's assessment.
- Saving Application 2 can mutate Application 1's assessment.

This is a correctness defect in the application assessment workflow.

## Current Evidence

Verified in DEV and code during the 2026-05-08 planning/implementation thread:

- DEV schema has `iset_case_assessment.case_id` as the primary key and no `application_id`.
- DEV data had case `1` with applications `1,2` and one case assessment row. Assessment documents existed for both application `1` and application `2`, proving document provenance can diverge from the case-scoped assessment row.
- Main assessment save path `PUT /api/cases/:id` reads/upserts `iset_case_assessment` by `case_id`.
- `GET /api/cases/:id/workspace` currently loads the case primary application and separately reads `iset_case_assessment WHERE case_id = ?`.
- The case workspace frontend provider currently calls `/api/cases/:id/workspace` without preserving the selected `?applicationId=`, so even correct application table navigation can lose the selected application during workspace hydration.
- `GET /api/cases/:id`, `GET /api/applications/:id`, `GET /api/applications`, EI queues, pending decision queues, SLA helpers, document checklist logic, PDF generation, and funding/CFA helpers all have case-level assessment reads that must not accidentally select the wrong assessment after ownership changes.
- DEV migration `20260508_0001_create_application_assessment.sql` created `iset_application_assessment` with one row per `application_id`, required `case_id`, a surrogate `id`, legacy provenance columns, and an optional `intervention_budget_pot_id` FK.
- DEV backfill dry-run and apply both classified the single legacy assessment row as `ambiguous`; clear ownership `0`, copied `0`. Case `1` has applications `1,2` and generated assessment document provenance for both applications, so no automatic copy was made.
- DEV DB-level transactional smoke proved the core safety rule for case `1` / application `2`: Application 2 starts blank, saving Application 2 creates only an Application 2 row, Application 1 remains unchanged, the legacy case assessment remains unchanged, and rollback cleans up the smoke row.

## Target Behavior

- An application can have zero or one application assessment.
- The assessment belongs to the selected `iset_application`.
- A repeat application starts blank unless it already has its own application-scoped assessment or a migration/resolver proves a legacy assessment belongs to it.
- Opening Application 2 must not load Application 1's assessment.
- Saving Application 2 must not overwrite Application 1's assessment.
- EI status, recommendation, cost/funding fields, decision context, and generated assessment documents are application-assessment data where they are part of the application assessment workflow.
- Imported or otherwise application-less historical cases must not be broken by the first containment fix.

## Chosen First-Pass Approach

Use **Option B: additive application-scoped containment**.

Implemented DEV schema direction:

- Create a new application-scoped assessment table, `iset_application_assessment`.
- Include a surrogate `id`.
- Include required `case_id` as case context.
- Include required `application_id` for application-backed assessments.
- Enforce one assessment per application with `UNIQUE KEY (application_id)`.
- Retain the old `iset_case_assessment` table as legacy case-scoped compatibility during the containment release.
- Backfill/copy old assessment data into the new table only when ownership is clear.

Do not use only a mapping table. Mapping a legacy case assessment to one application does not provide storage for a second application's distinct assessment. The containment fix needs a place to save Application 2's separate assessment.

## Core Safety Rule

For a selected application, assessment resolution must be:

1. Read assessment data by the selected `application_id` from the application-scoped store.
2. If an application-scoped row exists, use it.
3. If no application-scoped row exists, allow legacy fallback to `iset_case_assessment` only when a resolver or backfill proves the legacy case assessment belongs to that selected application.
4. If ownership is not proven for the selected application, show a blank/new assessment.

Never blindly fall back to `iset_case_assessment` by `case_id` for an application-backed assessment screen.

## Expected Behavior After Option B

- Application 1 can retain or be migrated to its own application assessment where ownership is clear.
- Application 2 starts with a blank assessment unless it already has its own application-scoped assessment.
- Saving Application 2 writes only to Application 2's application assessment.
- Saving Application 2 never mutates Application 1's assessment.
- Saving Application 1 writes only to Application 1's application assessment once migrated/resolved.
- Legacy/imported/application-less cases can continue using the old case-level assessment behavior until a later cleanup decision.

## First-Pass Code Scope

The first pass should move only the application assessment workflow and its direct read/write surfaces.

Must change:

- Application workspace routing and hydration must preserve/validate selected `applicationId`.
- `GET /api/cases/:id/workspace` must support selected application assessment resolution.
- `GET /api/cases/:id` must support selected application assessment resolution where used by the application workspace.
- `PUT /api/cases/:id` assessment save/submit must write to the selected application's assessment row.
- `CoordinatorAssessmentWidget` and related frontend save/submit/EI decision paths must send or preserve selected application context.
- Application assessment PDF generation/versioning must read the selected application assessment and store generated docs with the selected `application_id`.
- Application decision review must use selected application assessment recommendation, EI, cost, rationale, and decision fields.
- Application post-decision approval/denial letter state must be scoped to the selected application. Do not store or read selected-application letter drafts, approval-letter packs, or sent markers solely from case-level `case_context_json`.
- Application lists and work queues that display application assessment state must read by application assessment ownership:
  - `/api/applications`
  - `/api/applications/:id`
  - EI eligibility queue
  - awaiting approval / pending decision queue
  - SLA/timeline helpers where `assessment_esdc_eligibility` drives application stage
- Direct funding/cost reads that are part of application approval must use selected application assessment:
  - approval threshold checks
  - auto action-plan/intervention creation from approved application assessment
  - CFA creation from application assessment
  - denied/ineligible reporting artifact sync
  - required generated assessment documents

Can remain unchanged for the containment release if no direct dependency is proven:

- Existing intervention proposal/revision workflow storage.
- Proposal document provenance cleanup.
- Proposal workflow ownership cleanup around `iset_case_intervention`.
- Legacy case-level reports that intentionally describe historical imported case files and do not claim to show a selected application's assessment.
- Payment/funding paths that already rely on intervention/action-plan metadata rather than the application assessment.

Must audit during implementation:

- Any raw `iset_case_assessment WHERE case_id = ? LIMIT 1` read.
- Any `LEFT JOIN iset_case_assessment ca ON ca.case_id = c.id`.
- Any script, ops repair SQL, export, or report that joins `iset_case_assessment` by `case_id`.
- Any document checklist rule that treats assessment completion/cost as application state.

## Parked Boundaries

This first pass is not a full intervention proposal refactor.

The broader EI-status business-process question for intervention proposals/revisions is parked as a separate open issue. Existing evidence showed proposal workflows can carry/edit EI-like review metadata and some proposal queues display `iset_case_assessment.esdc_eligibility`, but that should not block the repeat-application assessment containment fix unless a direct dependency is proven.

Proposal document provenance and proposal workflow ownership remain residual model issues:

- Intervention proposal documents may still be incorrectly associated with a primary application.
- Proposal workflow ownership remains muddied by legacy use of `iset_case_intervention`.

Treat these as separate residual areas unless they directly affect application assessment ownership.

## Option A Future Target

Option A remains the possible long-term ERM cleanup:

- migrate `iset_case_assessment` in place;
- add surrogate `id BIGINT UNSIGNED AUTO_INCREMENT`;
- keep `case_id` as required case context;
- add nullable `application_id`;
- add FK from `application_id` to `iset_application(id)`;
- remove `case_id` as the primary/unique owner;
- enforce one assessment per application where `application_id` is present;
- allow application-less assessment only for explicitly supported historical/imported case work;
- conservatively backfill legacy rows only where ownership is clear.

Option A should be treated as a broad coordinated maintenance release, not the immediate production bugfix.

## Why Option A Is Not First

Once `iset_case_assessment` allows multiple rows per `case_id`, every case-only assessment read becomes unsafe. A missed join can cause:

- duplicate queue rows;
- wrong EI/recommendation/cost display;
- Application 2 loading Application 1's assessment;
- approval threshold checks using the wrong cost;
- PDFs versioned against the wrong application;
- auto action plans/CFA generated from the wrong assessment;
- legacy `ON DUPLICATE KEY` saves inserting new ambiguous applicationless rows after `case_id` stops being unique.

Rollback is also hard. After multiple rows per case exist, old code that assumes one row per case is unsafe. Practical rollback would require a DB snapshot restore or a forward repair that collapses rows per case with manual data-loss decisions.

## Option A Blast Radius Findings

### 1. Must Change For Option A

- Assessment save/update:
  - `PUT /api/cases/:id` currently selects the case primary application and reads/upserts `iset_case_assessment` by `case_id`.
- Case/application hydration:
  - `GET /api/cases/:id/workspace`
  - `GET /api/cases/:id`
  - `GET /api/applications/:id`
  - `GET /api/applications`
- Frontend selection path:
  - `CaseWorkspaceContext` currently calls `/api/cases/:id/workspace` without preserving selected `?applicationId=`.
  - `CoordinatorAssessmentWidget` saves to `/api/cases/:id` without an explicit selected application in the payload.
- Application queues/SLA:
  - application SLA helpers join assessment by `case_id`;
  - EI eligibility queue;
  - awaiting approval / pending decision queue;
  - home dashboard application rows sourced from `/api/applications`.
- Application decision/PDF paths:
  - assessment submitted/approved/redline generation;
  - assessment document version numbering;
  - approval/denial decision context;
  - required generated assessment documents.
- Application-derived funding reads:
  - approval threshold cost check;
  - auto action-plan/intervention creation after application approval;
  - CFA creation from assessment;
  - denied/ineligible reporting artifact sync.
- Scripts/ops:
  - `scripts/reconcile-auto-assessment-intervention-cost-lines.js`;
  - duplicate-case consolidation SQL;
  - one-off PROD repair SQLs that update/join assessment by `case_id`.

### 2. Must Audit, May Not Need Change

- Intervention proposal approval/completion queues: they join `iset_case_assessment` by `case_id` for EI display. Even if the EI business question remains parked, the raw join must not duplicate rows or pick an arbitrary application assessment after Option A.
- Payment packet and funding authorization fallbacks: several paths fall back to assessment funding data by `case_id`; some may be replaceable with intervention metadata, but no raw `LIMIT 1` can remain after Option A.
- Document checklist gates: `loadApplicationAnswers()` uses assessment completeness/cost by `case_id`.
- Reporting dashboards and exports: no obvious runtime reporting endpoint join was confirmed in the focused pass, but reporting scripts, saved SQL, ops SQL, and workbook extracts need audit.
- Privacy/relationship audit scripts that reference `iset_case_assessment`.

### 3. Likely Unaffected

- Application form versioning itself.
- Application locks.
- Notes, reminders, and tasks except where they display assessment-derived state.
- Supporting document storage generally, except assessment-generated documents and checklist logic.
- Manual intake/application creation, except downstream assessment ownership.

### 4. Unknown Until Deeper Inspection

- Admin query/export templates not caught by static search.
- Historical repair scripts outside the currently named ops files.
- Finance/reporting views if they depend on DB-side saved SQL or workbook extracts rather than repo code.

## Compatibility Helpers

Compatibility helpers can reduce blast radius but cannot eliminate the Option A risk.

Recommended helper shape for either option:

- A central `resolveApplicationAssessment` helper that requires `caseId` plus selected `applicationId` for application-backed workflows.
- A separate legacy resolver for application-less imported/historical case workflows.
- A write helper that refuses to write application assessment fields without a selected valid application unless the caller explicitly invokes the legacy case workflow.

A generic compatibility view cannot know the selected application unless the calling query supplies it. Do not create a view that simply chooses one row per case and then use it for application-backed assessment screens.

## Backfill Rules

Backfill/copy legacy assessment data conservatively:

1. If a case has exactly one application, the legacy assessment can be associated with that application.
2. If generated assessment documents for the case point to one clear `application_id`, the legacy assessment can be associated with that application.
3. If timestamps and document provenance clearly agree, associate the row and record the evidence in audit output.
4. If multiple applications are plausible, leave the new selected application blank rather than copying or guessing.
5. If a case is validly application-less because it came from historical import, preserve an application-less path until a product decision removes it.

The safest historical rule is: preserve evidence first, improve UX second. A blank assessment on a new application is better than false audit history.

## Preflight Audit

Before any schema or code implementation, run read-only audits in DEV, TEST, and PROD:

- cases with more than one application and a legacy assessment row;
- cases with one legacy assessment row and generated assessment documents across multiple applications;
- legacy assessment rows with no generated document provenance;
- generated `case_assessment`, `case_assessment_approved`, and `case_assessment_redline` documents with missing `application_id`;
- application-less cases with assessment rows;
- active/review applications whose selected assessment would be blank after containment;
- production feedback/issues tied to repeat applications;
- all repo SQL/code references to `iset_case_assessment` by `case_id`.

Audit output should classify legacy rows as `single_application`, `document_provenance_clear`, `ambiguous`, or `applicationless_case`.

## Rollout Direction For Option B

1. Write the audit SQL and run it read-only against DEV first. Completed for DEV through `scripts/application-assessment-backfill.js`.
2. Add the application-scoped assessment store in DEV. Completed by migration `20260508_0001_create_application_assessment.sql`.
3. Implement central selected-application assessment resolver/write helper. Completed in DEV code for the first containment patch.
4. Update only application assessment workflow and direct application assessment read/write surfaces. In progress; main application workspace, application list/detail, EI/decision queues, SLA reads, assessment save, and direct PDF/funding/CFA reads have been moved or guarded. Remaining raw `iset_case_assessment` references are now inventoried below and must be dispositioned before TEST.
5. Add focused tests for two applications on one case:
   - old application retains its assessment when ownership is clear;
   - new application starts blank;
   - saving new assessment does not change old assessment;
   - generated assessment docs attach to the selected application;
   - application queues and application detail read the selected application's assessment.
6. Rehearse on TEST with a PROD-like data shape.
7. Smoke repeat application assessment, assessment approval, generated PDFs, funding recommendation, queues, document checklist, and reporting surfaces touched by the containment release.
8. Schedule PROD as a dedicated maintenance release with snapshot/restore point, in-app warning, ALB maintenance fallback if needed, and post-deploy smoke.

## Current Implementation Boundary

As of 2026-05-08, the project is in DEV implementation for Option B only.

Hard boundary from Bill:

- Do not proceed to PROD deployment until DEV and TEST rehearsal results are available.
- Required rehearsal evidence before PROD:
  - backfill classification counts;
  - backfill dry-run/apply outcome;
  - repeat-application assessment smoke-test results;
  - document/PDF smoke-test results;
  - queue/decision-view smoke-test results;
  - legacy/application-less case smoke-test result where relevant.
- Keep this persistent plan current as implementation progresses.

DEV implementation should preserve the containment decision:

- additive schema first;
- no destructive change to `iset_case_assessment`;
- no blind `case_id` fallback for application-backed assessment screens;
- legacy fallback only when ownership is proven;
- ambiguous legacy assessment rows remain unresolved/manual-review rather than copied.

## DEV Implementation Record

Current implemented files:

- `sql/migrations/20260508_0001_create_application_assessment.sql`
- `scripts/application-assessment-backfill.js`
- `scripts/application-assessment-context-backfill.js`
- `scripts/application-assessment-option-b-smoke.js`
- `package.json` scripts `assessment:backfill:plan`, `assessment:backfill:apply`, `assessment:context:plan`, `assessment:context:apply`, and `assessment:option-b:smoke`
- `isetadminserver.js`
- `src/pages/Caseworking/CaseWorkspacePage.jsx`
- `src/pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx`
- `src/widgets/CoordinatorAssessmentWidget.js`

Current DEV database state:

- `npm run db:migrate:apply` applied `20260508_0001_create_application_assessment.sql`.
- `npm run db:migrate:plan` reports `0` pending migrations after apply.

Current DEV backfill classification counts:

- mode `dry-run`: total `1`, clear ownership `0`, already migrated `0`, copied `0`, ambiguous `1`.
- mode `apply`: total `1`, clear ownership `0`, already migrated `0`, copied `0`, ambiguous `1`.
- ambiguous row: case `1`, applications `[1,2]`, generated document application IDs `[1,2]`, reason `multiple applications are plausible and document provenance is not singular`.

Current DEV application-assessment context backfill counts:

- `npm run assessment:context:plan` inspected `2` cases after creating the persistent smoke fixture and reported `0` cases with root application-assessment workflow keys.
- This context audit covers old root-level `case_context_json` keys such as `assessment_nwac_review_status`, `assessmentOtherFunding`, `decisionLetterDrafts`, `decisionLetterPackDrafts`, `decisionLetterSent`, and denial-reason fields.
- The script is dry-run by default. `assessment:context:apply` should be run in TEST/PROD only after the plan output is captured; it scopes root workflow context to `applicationDecisionLetters[application_id]` only where ownership is clear and leaves ambiguous/applicationless rows unresolved.

Current DEV smoke results:

- DB-level transactional smoke passed for case `1` / selected application `2`.
- Application 2 started blank.
- Saving Application 2 created only an Application 2 scoped row.
- Application 1 assessment content was unchanged.
- The legacy `iset_case_assessment` row was unchanged.
- The smoke transaction rolled back cleanly.

Current code verification:

- `node --check isetadminserver.js` passed.
- `node --check scripts/application-assessment-backfill.js` passed.
- `git diff --check` passed.
- `npm run build` passed with warnings.
- 2026-05-08 DEV follow-up: fixed a refactor scoping regression where `PUT /api/cases/:id` could fail with `applicationJoinSql is not defined` when saving EI/application assessment state. The same sweep fixed an application-assessment row reference that escaped scope in action-plan creation context seeding, plus three older unrelated backend `no-undef` hazards.
- 2026-05-08 follow-up verification: `node --check isetadminserver.js`, `git diff --check`, and focused ESLint `no-undef` over all changed JS/JSX files passed.

DEV follow-up blocker and fix:

- A full DEV repeat-application walkthrough moved Application `2` on case `1` through assessment approval. The application assessment row itself was correctly application-scoped (`iset_application_assessment.id = 17`, `application_id = 2`), and generated assessment PDFs attached to `application_id = 2`.
- Step 14 `Approval letters` opened in a read-only state and was pre-populated with Application `1` letter content.
- Root cause: application decision-letter state is still persisted on the long-lived case in `iset_case.case_context_json`, including `decisionLetterDrafts`, `decisionLetterPackDrafts`, and `decisionLetterSent.approval`.
- `CoordinatorAssessmentWidget` reads those keys from `caseData.caseContext` and derives `letterAlreadySent` from `decisionLetterSent[activeLetterKey]`; for Application `2`, the Application `1` `decisionLetterSent.approval` value made the Step 14 letter editor read-only.
- This is a correctness defect in Option B blast-radius handling, not a parked long-term refactor. The earlier blast-radius audit focused too narrowly on `iset_case_assessment` and generated assessment PDFs and missed case-scoped `case_context_json` workflow state.
- The corrected design must scope application assessment letter drafts, approval-letter packs, denial-reason/letter data where applicable, and letter-sent markers by selected `application_id`, with conservative legacy fallback only when ownership is proven.
- DEV fix applied on 2026-05-08: `CoordinatorAssessmentWidget` now reads/writes these assessment workflow context keys under `case_context_json.applicationDecisionLetters[application_id]`; the backend scopes old-style case-context patches to the selected application, strips root assessment-workflow keys when a scoped patch is present, and uses the selected application when pre-filling/sending decision-letter signing requests.
- DEV data repair for case `1`: Application `1` now owns the prior sent approval-letter state; Application `2` has `assessment_nwac_review_status = approve` and no approval `decisionLetterSent`, `decisionLetterDrafts`, or `decisionLetterPackDrafts`; root case-context letter/review keys were removed.
- After Bill's subsequent DEV testing, Application `2` on case `1` now has its own generated/sent approval-letter state. That is no longer a fresh Step 14 fixture; it should pass `--stage sent`, not `--stage fresh-step14`.
- This blocker caused the corrected TEST redeploy/rehearsal recorded below. Do not treat older pre-letter-context TEST evidence as sufficient without the later authenticated TEST smoke record.

Current raw `iset_case_assessment` reference audit:

- Remaining runtime joins in `isetadminserver.js` are the intervention proposal/revision queue and approved-proposal follow-up surfaces. These are intentionally parked as intervention-proposal EI/provenance questions, but they must stay on legacy `iset_case_assessment` for Option B rather than joining the new application table arbitrarily.
- Payment/funding authorization fallback paths were tightened in DEV: when an intervention/action plan carries application provenance, funding fallback reads the selected application assessment; where no application provenance exists, it preserves the legacy case-assessment fallback instead of guessing a primary application.
- `scripts/application-assessment-backfill.js` is expected to read legacy `iset_case_assessment`; that is its source table.
- `scripts/reconcile-auto-assessment-intervention-cost-lines.js` still joins legacy `iset_case_assessment` by case and must be audited before it is used in TEST/PROD after this containment work.
- Existing one-off PROD repair SQL and duplicate-case consolidation SQL still reference legacy `iset_case_assessment`; they must not be reused blindly after application-scoped assessments are introduced.
- Historical FK/audit migrations and privacy audit scripts reference `iset_case_assessment` as legacy schema evidence and are not direct application workflow blockers.

Corrected TEST rehearsal scope:

- Direct application-assessment browser/document/queue/legacy smoke items are completed in the TEST record below.
- The remaining raw-reference audit items above, especially intervention-proposal EI display and reconciliation/ops scripts, are retained as parked/nonblocking for Option B unless those scripts are used in the release.
- Authenticated browser smoke of the assessment wizard for repeat applications, using a fresh unsent fixture rather than the already-sent case `1` / application `2`.
- Generated assessment PDF/document attachment smoke against selected `application_id`.
- Application queue and decision-view smoke against selected application assessment state.
- Legacy/application-less case smoke where relevant.

DEV automation added on 2026-05-08:

- Script: `scripts/application-assessment-option-b-smoke.js`.
- NPM alias: `npm run assessment:option-b:smoke`.
- Generalized browser/API workflow-smoke lessons from this release are captured in `docs/testing/browser-workflow-smoke-automation.md`.
- Purpose: fast DB-backed smoke for Option B application-assessment ownership, app-scoped `case_context_json.applicationDecisionLetters`, document application association, and duplicate assessment owners.
- Default mode is read-only against a repeat-application case. `--fixture` creates a disposable repeat-application fixture inside a transaction and rolls it back.
- `--fixture --keep-fixture` commits a fresh repeat-application fixture for browser testing. Current DEV fixture: case `6`, Application A `11`, Application B `12`; Application A has prior sent approval-letter state and Application B is approved/fresh for Step 14 with no inherited drafts, pack, or sent marker.
- Useful DEV commands:
  - `npm run assessment:option-b:smoke -- --fixture`
  - `npm run assessment:option-b:smoke -- --fixture --keep-fixture`
  - `npm run assessment:option-b:smoke -- --case-id 6 --app-a 11 --app-b 12 --stage fresh-step14`
  - `npm run assessment:option-b:smoke -- --case-id 1 --app-b 2 --stage fresh-step14`
  - `npm run assessment:option-b:smoke -- --case-id 1 --app-b 2 --stage drafted`
  - `npm run assessment:option-b:smoke -- --case-id 1 --app-b 2 --stage sent`
- Current local verification: `node --check scripts/application-assessment-option-b-smoke.js` passed; fixture mode passed; live DEV case `1` / Application `2` passed at `--stage sent` after Bill's latest UI test sent the Application 2 approval letter. The earlier `fresh-step14` stage now correctly fails on that same live case because Application 2 has its own generated/sent letter state.
- Current fresh-fixture verification: `npm run assessment:option-b:smoke -- --case-id 6 --app-a 11 --app-b 12 --stage fresh-step14` passed. DEV backend `/healthz` returned `200`, and the local React dev server on port `3001` returned `200`.
- Authenticated DEV smoke on 2026-05-08 used temporary Cognito staff users and the persistent repeat-application fixture case `6` / Applications `11` and `12`.
  - `/api/cases/6/workspace?applicationId=11` hydrated Application `11` assessment data (`EI Reach Back`, cost `111`).
  - `/api/cases/6/workspace?applicationId=12` hydrated Application `12` assessment data (`CRF`, cost `222`) and exposed no selected-application/root approval-letter draft or sent fallback for Application `12`.
  - The workspace API still returns the full long-lived case context, so Application `11` scoped history is present under `applicationDecisionLetters["11"]`; this is acceptable only because selected-application consumers must resolve `applicationDecisionLetters[selected_application_id]`.
  - An authenticated `PUT /api/cases/6` with `applicationId=12` and an application lock updated only the Application `12` row in `iset_application_assessment`; Application `11` checked fields stayed unchanged and the legacy `iset_case_assessment` row count for case `6` stayed unchanged. The fixture was restored after the smoke.
  - `/api/applications?statusGroup=all` returned successfully and included the Application `12` fixture.
  - Browser smoke for `/application-case/6?applicationId=12&entry=approval&approvalType=application&step=communication`, with the temporary staff conflict declaration precondition satisfied, opened Step 14 `Approval letters` for Application `12`. It showed a blank editable client-letter draft area with `Generate drafts` / `Save drafts`, did not render Application `11`'s `Prior application only` draft, and did not inherit Application `11`'s sent/read-only state. Screenshot evidence: `tmp/option-b-dev-app12-step14-direct.png`.
  - Browser smoke also captured the ordinary case/application workspace at `tmp/option-b-dev-app12-workspace.png`; note that Supporting Documents defaults to `All documents (client + all applications)`, so both Application `11` and Application `12` generated PDFs are visible there even though their `iset_document.application_id` values are distinct.

DEV context-backfill automation added on 2026-05-08:

- Script: `scripts/application-assessment-context-backfill.js`.
- NPM aliases: `npm run assessment:context:plan` and `npm run assessment:context:apply`.
- Purpose: migrate old root-level application-assessment workflow context from `iset_case.case_context_json` into `case_context_json.applicationDecisionLetters[application_id]` only where ownership is clear.
- High-level rules: single-application cases are clear; multi-application cases are clear only when assessment/decision generated document provenance points to exactly one application; applicationless cases are preserved; ambiguous/conflicting cases are reported for manual review and not guessed.
- Current DEV verification: `node --check scripts/application-assessment-context-backfill.js` passed, and `npm run assessment:context:plan` reported `2` cases inspected, `0` root workflow-key cases, `0` clear/applyable rows.

## TEST Rehearsal Record

TEST rehearsal started on 2026-05-08 as release `20260508-test-application-assessment-option-b`.

Deployment scope:

- Admin schema plus admin app only.
- Portal deploy skipped.
- Allowlisted data promotion skipped.
- TEST maintenance sequence used: admin warning -> wait -> admin ALB fallback -> deploy -> clear fallback -> normal-routing target-group smoke -> clear warning.
- Plan before deployment showed one pending schema migration: `20260508_0001_create_application_assessment.sql`.

Deployment result:

- `path:deploy` completed successfully.
- Admin artifact deployed to TEST instances `i-09fe8c219a4564040` and `i-0a8be782ed8604211`.
- `20260508_0001_create_application_assessment.sql` applied successfully in TEST; `iset_migration` recorded success with duration `9213 ms` at `2026-05-08 14:35:03`.
- Post-deploy schema plan reported `0` pending migrations.
- Normal-routing target-group smoke passed: both TEST admin targets healthy on port `5001`.

TEST backfill dry-run before apply:

- total legacy rows `45`
- clear ownership `45`
- already migrated `0`
- copied `0`
- classification counts: `single_application: 45`
- ambiguous rows `0`

TEST backfill apply:

- first apply copied `45` rows.
- first apply summary: total `45`, clear ownership `45`, already migrated `0`, copied `45`, classification counts `single_application: 45`.
- immediate idempotency check reported total `45`, clear ownership `45`, already migrated `45`, copied `0`, classification counts `single_application: 45`.

TEST post-backfill database checks:

- `iset_application_assessment` rows: `45`
- legacy `iset_case_assessment` rows: `45`
- rows with `legacy_case_assessment_case_id`: `45`
- duplicate application-assessment owners: `0`
- existing TEST cases with multiple applications before fixture smoke: `0`

TEST transactional repeat-application fixture smoke:

- Fixture case `16`; existing Application 1 `54`; temporary Application 2 `57`.
- Application 2 started blank: pass.
- Saving Application 2 created exactly one Application 2 assessment row: pass.
- Application 1 assessment was unchanged: pass.
- Legacy `iset_case_assessment` row was unchanged: pass.
- One-assessment-per-application uniqueness remained valid: pass.
- Transaction rollback removed temporary Application 2 and its assessment: pass.

## TEST Corrected-Build Follow-Up

Corrected admin-only TEST release `20260508-test-option-b-followup` was deployed on 2026-05-08 after the DEV refactor bug `applicationJoinSql is not defined` was found.

Deployment scope:

- Admin app only.
- Schema skipped.
- Data promotion skipped.
- Portal skipped.
- Maintenance sequence used: admin warning -> wait -> admin ALB fallback -> deploy -> clear fallback -> normal-routing smoke -> clear warning.
- Manifest: `tmp/path-deploy/test/20260508-test-option-b-followup--2026-05-08T15-14-53-072Z.json`.

Deployment result:

- Admin artifact `s3://nwac-test-artifacts/admin-dashboard/admin-dashboard-20260508-111453.zip` deployed successfully to TEST instances `i-09fe8c219a4564040` and `i-0a8be782ed8604211`.
- Normal-routing target-group smoke passed after fallback clear: both TEST admin targets healthy on port `5001`.
- Final fallback status: `nwac-console-test.awentech.ca` normal forward.
- Admin maintenance warning cleared.

Corrected-build static/schema/backfill checks:

- `node --check isetadminserver.js` passed locally before deploy.
- `node --check scripts/application-assessment-backfill.js` passed locally before deploy.
- `git diff --check` passed locally before deploy.
- Focused ESLint `no-undef` over all changed JS/JSX files passed before deploy.
- TEST schema plan after deploy: `0` pending migrations.
- TEST backfill/idempotency after deploy: `45` legacy rows, `45` application-assessment rows, `45` already migrated clear rows, `0` ambiguous rows, `0` duplicate application-assessment owners.

Corrected-build authenticated API smoke:

- Used temporary TEST Cognito `System_Administrator` users through SSM localhost calls to the deployed admin server; temporary Cognito users were deleted after each smoke.
- Exact DEV failure path passed on TEST: `GET /api/auth/me`, `POST /api/locks/application/2`, `PUT /api/cases/84` with `applicationId: 2` and EI `CRF`, restore EI to `EI Reach Back`, and `DELETE /api/locks/application/2` all returned `200`.
- Post-check for application `2`: EI restored to `EI Reach Back`; active lock count `0`. Its `row_version` advanced as expected from the save/restore smoke.
- Repeat-application API isolation passed on TEST using fixture case `16`: created temporary Application `58`, confirmed `GET /api/cases/16?applicationId=58` loaded blank assessment data, saved EI `CRF` through `PUT /api/cases/16` with `applicationId: 58`, confirmed reload returned assessment data scoped to Application `58`, then released the lock.
- Pre-cleanup verification showed Application `54` retained `EI Reach Back` while temporary Application `58` had `CRF`; legacy `iset_case_assessment` for case `16` remained `EI Reach Back`.
- Cleanup removed temporary Application `58` and its assessment. Final case `16` counts: `1` application, `1` application assessment, `0` active temp locks.

Corrected-build queue/decision API smoke:

- Authenticated SSM localhost API smoke returned `200` for:
  - `/api/dashboard/application-work-queue`
  - `/api/dashboard/awaiting-approval-items`
  - `/api/applications?statusGroup=pending_decision&limit=10&offset=0`

## TEST Letter-State / Context Follow-Up

Corrected admin-only TEST release `20260508-test-option-b-letter-context` was deployed on 2026-05-08 after DEV fixed the Step 14 approval-letter bleed-through and added context backfill tooling.

Deployment scope:

- Admin app only.
- Schema skipped; existing `20260508_0001_create_application_assessment.sql` migration was already applied in the earlier TEST rehearsal.
- Data promotion skipped.
- Portal skipped.
- Maintenance sequence used: admin warning -> wait -> admin ALB fallback -> deploy -> clear fallback -> normal-routing smoke -> clear warning.
- Manifest: `tmp/path-deploy/test/20260508-test-option-b-letter-context--2026-05-08T17-26-56-790Z.json`.

Deployment result:

- Admin artifact `s3://nwac-test-artifacts/admin-dashboard/admin-dashboard-20260508-132656.zip` deployed successfully to TEST instances `i-09fe8c219a4564040` and `i-0a8be782ed8604211`.
- Normal-routing target-group smoke passed after fallback clear: both TEST admin targets healthy on port `5001`.
- Admin maintenance warning cleared.
- TEST post-deploy schema plan reported `0` pending migrations.

Local preflight before/around deploy:

- `node --check isetadminserver.js`, `scripts/application-assessment-backfill.js`, `scripts/application-assessment-context-backfill.js`, and `scripts/application-assessment-option-b-smoke.js` passed.
- `npm run build` passed with existing warnings only.
- Focused ESLint over the assessment helper scripts passed with `0` errors and existing `use strict` warnings only.
- `git diff --check` passed before the TEST deploy.

TEST table backfill and schema checks after deploy:

- legacy `iset_case_assessment` rows: `45`.
- `iset_application_assessment` rows: `45`.
- duplicate application-assessment owners: `0`.
- repeat-application cases before new smoke fixture: `0`.
- legacy assessment classification remained `single_application: 45`, all already migrated.

TEST context backfill rehearsal:

- Dry-run before apply inspected `123` cases and reported `46` cases with root application-assessment workflow context keys.
- Clear ownership: `45` `single_application` rows.
- Preserved legacy/applicationless: `1` row, case `100` / `ISET-20260414-82726E`, with `0` applications.
- Conflicts: `0`.
- Apply moved `45` clear rows under `case_context_json.applicationDecisionLetters[application_id]`.
- Post-apply SQL confirmed only `1` root workflow-key case remains, the applicationless case `100`; duplicate application-assessment owners remain `0`.

TEST repeat-application smoke after corrected deploy:

- Rollback fixture smoke passed: case `135`, Application A `59`, Application B `60`; transaction rolled back.
- Persistent fixture smoke passed: case `136`, Application A `61`, Application B `62`.
- Application B `62` is the current TEST browser-smoke target: approved/fresh Step 14 state, no inherited approval sent marker, no inherited decision-letter drafts, no inherited approval-letter pack, and no root case-context workflow keys.

Authenticated TEST smoke after corrected deploy:

- Ran on 2026-05-08 against deployed TEST instance `i-0a8be782ed8604211` through SSM command `33727170-fda5-4ec6-94ae-383a3e454c0f`, using a temporary TEST Cognito `System_Administrator` user and temporary `staff_profiles` row. The temporary Cognito user, staff row, conflict declaration, and Application `62` lock were cleaned up after the run.
- Because the public TEST ALB returns `403` to this Codex host, the browser smoke navigated to the public TEST origin while intercepting requests to the local TEST instance at `127.0.0.1:5001`. This keeps the browser origin aligned with the deployed bundle's compiled API origin while still exercising the deployed TEST backend/frontend build.
- TEST has SES email notifications deliberately disabled, so this smoke did not click any outbound email/send action.
- Workspace hydration passed: `GET /api/cases/136/workspace?applicationId=61` loaded Application `61` assessment data (`EI Reach Back`, cost `111`), while `applicationId=62` loaded Application `62` assessment data (`CRF`, cost `222`).
- Application-context isolation passed: Application `62` did not inherit Application `61` `decisionLetterDrafts`, `decisionLetterPackDrafts`, or `decisionLetterSent`; the root case context had no application-assessment workflow-key leak.
- Authenticated save isolation passed: a `PUT /api/cases/136` with `applicationId: 62` temporarily saved cost `223` and a smoke-test justification only to Application `62`; Application `61` stayed unchanged and `iset_case_assessment` row count for case `136` stayed `0`. The fixture was restored to cost `222`, justification `B justification`, and application row version `1`.
- Step 14 browser smoke passed for Application `62`: the `Approval letters` step opened, did not display Application `61` text `Prior application only`, had a Generate/Save action, had an editable visible textarea, and was not locked by a sent marker.
- Browser route smoke passed for `Manage ISET Applications` with no captured server errors.
- Queue/decision API smoke passed: `/api/applications?statusGroup=all` included Application `62` with total `57`; `/api/dashboard/application-work-queue`, `/api/dashboard/awaiting-approval-items`, and `/api/applications?statusGroup=pending_decision` all returned `200`.
- Document provenance smoke passed on the persistent fixture's generated assessment PDFs: case `136` has `case_assessment_approved` document `1933` attached to Application `61` and document `1934` attached to Application `62`; no assessment/funding document row for the fixture was applicationless.
- Legacy/applicationless smoke passed: preserved case `100` still has `0` applications, no `applicationDecisionLetters`, and `/api/cases/100/workspace` returned `200` without an application.
- Post-run cleanup verification passed: temporary TEST staff rows `0`, temporary conflict declarations `0`, Application `62` locks `0`, Application `62` cost restored to `222`, and temporary TEST Cognito users matching `codex-test-optionb-*` `0`.

Pre-PROD release gates, completed before the 2026-05-09 mutation:

- Reviewed the completed TEST rehearsal evidence above, including the note that SES email delivery was intentionally not exercised in TEST.
- Followed the PROD deployment decision/release plan below during the approved 2026-05-09 maintenance window.

## PROD Deployment Decision And Release Plan

Decision as of 2026-05-08: **GO for a controlled PROD release**, provided the PROD preflight gates below passed. This was the release decision and operating plan for the 2026-05-09 approved PROD window.

Recommended release id if deployed on 2026-05-09: `20260509-prod-option-b-plus-portal`.

Scope:

- Deploy the additive application-assessment schema migration and corrected admin backend/frontend build.
- Deploy the unrelated public portal changes that are already staged in the sibling `ISET-intake` repo.
- Run report-first PROD table/context backfills, then apply only clear ownership rows.
- Do not deploy shared-library changes unless a fresh diff proves the release depends on them. The current `/home/bill/ISET/shared` tree is not a Git worktree and no shared change has been identified for this release.
- Do not run general allowlisted data promotion.
- Do not test outbound email delivery as part of this release. TEST intentionally disables SES, and the Option B fix changes assessment ownership and approval-letter state scoping, not SES delivery itself.

PROD preflight gates:

- `git status --short` and relevant diffs are reviewed from `/home/bill/ISET/admin-dashboard`; no unrelated risky changes are accidentally included.
- Local checks pass: `node --check isetadminserver.js`, `node --check scripts/application-assessment-backfill.js`, `node --check scripts/application-assessment-context-backfill.js`, `node --check scripts/application-assessment-option-b-smoke.js`, `git diff --check`, and a production build.
- Read-only PROD deploy plan passes:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:deploy:plan -- --env prod --skip-data --skip-shared --release-id 20260509-prod-option-b-plus-portal
```

- Pre-deploy PROD SQL/read-only inventory is captured: legacy `iset_case_assessment` row count, repeat-application case count, root workflow-context-key count, existing generated assessment document application provenance, and existing duplicate `iset_application_assessment` owners if the table already exists.
- Stop before mutation if the schema plan includes unrelated migrations, if the app diff includes unrelated high-risk behavior, if the PROD counts show a pattern not covered by the TEST rehearsal, or if the restore-point preflight is not available.

Preflight already completed on 2026-05-08:

- Local checks passed: admin `node --check` for `isetadminserver.js`, `scripts/path-deploy.js`, and all three assessment scripts; public portal `node --check server.js`; `git diff --check` in both admin and portal repos.
- Admin `PATH_RELEASE_ID=20260509-prod-option-b-plus-portal npm run build:production` passed with existing warnings; public portal `npm run build:production` passed.
- Landing-page release notes were regenerated for `20260509-prod-option-b-plus-portal`; the current notes include the repeat-application assessment fix and the public portal dashboard/start-resume change, and the repeat-application known-issue warning has been removed.
- The PATH deploy orchestrator now stages the three application-assessment support scripts in the admin artifact so the weekend backfill/smoke npm aliases are available under `/opt/nwac/admin-dashboard/scripts` after deploy.
- Read-only PROD deploy plan passed with release id `20260509-prod-option-b-plus-portal`.
- Plan result: pending schema `1`, exactly `20260508_0001_create_application_assessment.sql`; data dataset `none` because `--skip-data`; app deploy `admin=true`, `portal=true`, `shared=false`; smoke targets `3` (`admin`, `iset.nwac.ca`, `nwac-public.awentech.ca`).
- Latest planned restore point name: `path-prod-20260509-prod-option-b-plus-portal-20260508193256`.
- Latest plan manifest: `tmp/path-deploy/prod/20260509-prod-option-b-plus-portal--2026-05-08T19-32-56-458Z.json`.
- Read-only PROD inventory through SSM command `1dd2ae6d-f597-4d66-8cc7-0f3146708030`: `57` legacy `iset_case_assessment` rows, `0` repeat-application cases, `58` cases with root assessment workflow context keys, `106` active assessment/decision/funding document rows, `19` distinct document `application_id` owners, `29` applicationless assessment/decision/funding document rows, and `iset_application_assessment` table currently absent.
- Before running the weekend deployment, rerun the same plan if any repo changes after this handoff.

Maintenance approach:

- Use an **all-surface** PROD maintenance warning and ALB fallback because the weekend release intentionally includes both admin and public portal changes.
- Keep the in-app warning active until normal-routing admin smoke and the first functional checks pass.
- If the ASG refresh reports `Target.NotInUse` or insufficient ELB health while fallback is enabled, follow the PROD runbook: clear the fallback so ELB health can recover, but keep the in-app warning active.

Command sequence:

```bash
cd /home/bill/ISET/admin-dashboard

npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 20m --yes
# wait through the warning window

npm run path:maintenance:fallback -- set --env prod --surfaces all --yes

npm run path:deploy -- --env prod \
  --skip-data \
  --skip-shared \
  --release-id 20260509-prod-option-b-plus-portal \
  --skip-smoke \
  --yes
```

Backfill sequence after schema/admin+portal deploy, before returning users to normal routing:

- Use an SSM shell or `AWS-RunShellScript` command on an InService PROD app instance after the ASG refresh has installed the new admin artifact; start commands with `cd /opt/nwac/admin-dashboard`.
- Run `npm run assessment:backfill:plan -- --json` in PROD dry-run/report mode from the deployed admin app context (`/opt/nwac/admin-dashboard` on the refreshed instance).
- Review summary counts: total legacy rows, clear ownership, already migrated, copied/applyable, `single_application`, `document_provenance_clear`, `ambiguous`, and `applicationless_case`.
- Apply only if the dry-run output is understood. Ambiguous rows must stay unresolved/manual-review; do **not** copy one legacy assessment to every application on a case.
- Run `npm run assessment:backfill:apply -- --json`, then rerun the dry-run and duplicate-owner SQL. Required result: duplicate `iset_application_assessment.application_id` owners remains `0`.
- Run `npm run assessment:context:plan -- --json` in dry-run/report mode.
- Review clear ownership, conflicts, and applicationless rows. Applicationless legacy rows may remain root-scoped; conflicts must stop the apply unless explicitly reviewed.
- Run `npm run assessment:context:apply -- --json` only for clear ownership, then rerun the dry-run. Required result: no unexplained root application-assessment workflow keys remain except intentional applicationless/ambiguous/manual-review cases.

Post-backfill smoke before clearing the warning:

```bash
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
```

Functional PROD smoke:

- Confirm admin health and target-group smoke are green.
- Confirm public portal health and target-group smoke are green.
- Confirm the unrelated portal changes expected for the weekend release are visible, including retired Contact routing/copy and the dashboard/start-resume behavior from the sibling portal docs.
- Use a real staff session, not a synthetic client/application, to open a known application workspace.
- If PROD has a safe known repeat-application case, verify the selected application loads its own assessment and does not show another application’s approval-letter draft/sent state.
- If no safe repeat-application case exists, perform read-only SQL verification plus a single-application workspace smoke, and leave repeat-application behavior covered by TEST evidence until the first real repeat case is available.
- Do not click `Send client approval letter` as a smoke test unless Bill explicitly approves sending a real PROD email to the real recipient.
- Confirm application queues/decision views render without server errors.
- Confirm generated assessment/document rows for any inspected repeat case are associated with the selected `application_id`.
- Confirm imported/applicationless legacy cases remain accessible or at least do not 500 where their workspace is supported.

After functional smoke passes:

```bash
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

Rollback plan:

- **Code rollback:** redeploy the previous known-good admin artifact/build or revert and run an admin-only app rollout. Leave the additive schema/table in place unless a separate reviewed DB rollback is chosen. Code rollback may make new `iset_application_assessment` rows temporarily unread by the old build, so use only if the new build is causing a worse operational issue.
- **Schema rollback:** do not drop `iset_application_assessment` during an incident. It is additive. Use the automatic RDS restore point only for severe data/schema failure, understanding that it reverts all PROD DB changes after the snapshot.
- **Backfill rollback:** before applying context backfill, retain dry-run/apply output as evidence. Table backfill rows can be identified by `legacy_case_assessment_case_id` / `legacy_backfilled_at`, but do not delete them after users have created or edited new application-scoped assessments. Context backfill is not safely reversible after users write new scoped letter state; use the DB restore point only for severe corruption.
- **Partial failure:** if schema succeeds but app deploy fails, keep admin fallback/warning active and either complete the admin deploy or roll back code. If app deploy succeeds but backfill counts are unexpected, do not apply backfill; clear fallback only after confirming the code safely treats ambiguous selected applications as blank/new rather than guessing from `case_id`.

Release acceptance criteria:

- Schema migration applied once and recorded.
- Admin and portal builds deployed and smoke green.
- PROD backfill classification counts recorded in this document or the release manifest.
- Backfill apply results recorded, including ambiguous/manual-review counts.
- Duplicate application-assessment owners = `0`.
- Selected-application workspace smoke passes.
- Step 14 approval-letter smoke passes without inherited prior-application draft/sent state, or PROD has no safe repeat case and the TEST evidence is explicitly accepted for that path.
- No outbound email sent during smoke unless intentionally approved.

## PROD Deployment Record - 2026-05-09

Release: `20260509-prod-option-b-plus-portal`.

Source state and fresh preflight:

- Admin repo HEAD: `f36ecb9fe88d`; public portal repo HEAD: `3c0825a41f20`.
- Shared tree skipped; `/home/bill/ISET/shared` is not a Git worktree and no shared release dependency was identified.
- Local checks passed before mutation: admin `node --check` for `isetadminserver.js`, `scripts/path-deploy.js`, `scripts/application-assessment-backfill.js`, `scripts/application-assessment-context-backfill.js`, and `scripts/application-assessment-option-b-smoke.js`; portal `node --check server.js`; `git diff --check` in both admin and portal repos.
- Production builds passed before mutation: `PATH_RELEASE_ID=20260509-prod-option-b-plus-portal npm run build:production` in admin and portal. Admin retained only the known existing compile warnings.
- Fresh read-only PROD plan passed with exactly one pending schema migration, `20260508_0001_create_application_assessment.sql`; app deploy `admin=true`, `portal=true`, `shared=false`; data promotion skipped; smoke targets `3`.
- Fresh plan manifest: `tmp/path-deploy/prod/20260509-prod-option-b-plus-portal--2026-05-09T09-27-51-924Z.json`.
- Fresh read-only PROD inventory through SSM command `f935ab7b-727b-4a3f-ba3f-2d9135cc94d1`: `57` legacy `iset_case_assessment` rows, `0` repeat-application cases, `58` cases with root assessment workflow context keys, `106` active assessment/decision/funding document rows, `19` distinct document `application_id` owners, `29` applicationless assessment/decision/funding document rows, and no pre-existing `iset_application_assessment` table.

Maintenance and app deploy:

- Set all-surface PROD in-app maintenance warning, waited through the warning window, then enabled all-surface ALB fixed-response fallback.
- Ran `npm run path:deploy -- --env prod --skip-data --skip-shared --release-id 20260509-prod-option-b-plus-portal --skip-smoke --yes`.
- Restore point captured: `path-prod-20260509-prod-option-b-plus-portal-20260509093619`.
- Deploy manifest: `tmp/path-deploy/prod/20260509-prod-option-b-plus-portal--2026-05-09T09-36-19-596Z.json`.
- ASG refresh: `1e9442ae-7391-4177-8f84-86ec7ea9c467`; refreshed instance used for post-deploy SSM checks: `i-0fa6a12dc69d110c0`.
- The run encountered the known ALB fallback / ELB health-data interaction during instance refresh. Fallback was cleared while the in-app warning stayed active, normal routing recovered, and the deploy completed successfully.

Schema evidence:

- Migration `20260508_0001_create_application_assessment.sql` recorded in `iset_migration` with `success = 1`, `applied_at = 2026-05-09 09:40:43`, and `duration_ms = 8633`.
- Post-schema SQL confirmed `iset_application_assessment` existed and initially had `0` rows before backfill.

Application assessment table backfill:

- Dry-run SSM command `8ecf6cb5-050b-4ef7-a5ea-300891c0da55`: total `57`, clear ownership `57`, already migrated `0`, copied `0`, by classification `single_application: 57`.
- Apply SSM command `0c65d9f4-cf67-4c80-ab9b-383dcbfe458e`: total `57`, clear ownership `57`, already migrated `0`, copied `57`, by classification `single_application: 57`.
- Idempotency rerun SSM command `c1624fba-43e6-42b7-90f8-ed442e2e8733`: total `57`, clear ownership `57`, already migrated `57`, by classification `single_application: 57`.
- SQL verification through SSM command `f1760376-606a-46ba-8036-ad4d98532a3c`: application assessment rows `57`, legacy case assessment rows `57`, legacy backfilled rows `57`, duplicate application-assessment owners `0`.

Application decision-letter context backfill:

- Dry-run SSM command `75577a7e-8039-4262-917a-c4fae13e7d50`: cases inspected `134`, cases reported `58`, cases with root workflow keys `58`, clear ownership `57`, by classification `single_application: 57`, `applicationless_case: 1`.
- Apply SSM command `dad82d1d-12ae-448b-9efc-741f6358a385`: applied `57` clear single-application context moves and preserved the one applicationless legacy case.
- Post-apply SSM command `65cb7de9-48af-4100-b7f6-30ee12c3f94d`: cases inspected `134`, cases reported `1`, cases with root workflow keys `1`, clear ownership `0`, by classification `applicationless_case: 1`.
- Post-apply SQL through SSM command `a919841b-a7d4-440b-a0d1-ef8fd55c0106`: application assessment rows `57`, legacy case assessment rows `57`, legacy backfilled rows `57`, duplicate application-assessment owners `0`, root workflow-key cases remaining `1`, cases with scoped `applicationDecisionLetters` `57`.

Post-deploy validation:

- Read-only deploy plan after deploy reported schema pending `0`; manifest `tmp/path-deploy/prod/20260509-prod-option-b-plus-portal--2026-05-09T09-54-24-677Z.json`.
- PROD health smoke passed: `200` for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`.
- Direct `curl` health checks also returned `{"status":"ok"}` for all three surfaces.
- ALB fallback status after release: all three hostnames normal forward.
- In-app maintenance warning cleared; SQL command `9630df59-fb3a-4e1d-b5e2-297745ac4be0` confirmed `active_service_announcements = 0`.
- No outbound PROD email was sent as part of smoke testing.

Acceptance notes:

- PROD had `0` repeat-application cases at deployment time, so no live repeat-application staff workflow was exercised in PROD. The repeat-application behavior gate is covered by DEV and TEST authenticated fixture evidence above until the first real PROD repeat application exists.
- The one remaining root-level assessment/letter workflow context is intentionally preserved because the case has no application. It must not be treated as a failed context backfill.

## Open Product Decision

Staff may eventually want a deliberate `Copy previous assessment` action for repeat applicants. That must be a visible, auditable workflow choice, not automatic prefill. It is not required for the containment fix.

## Current Work State

As of 2026-05-09, Option B has shipped to PROD through the controlled combined admin+portal release `20260509-prod-option-b-plus-portal`. DEV fixture case `6` / Application B `12` and TEST fixture case `136` / Application B `62` remain the useful repeat-application fixtures because PROD had zero repeat-application cases at deployment time. Future work should monitor the first real PROD repeat application and keep Option A as a separate coordinated ERM cleanup, not a continuation of this first containment release.
