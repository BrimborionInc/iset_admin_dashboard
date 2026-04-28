# Client, Case, and Application Migration Plan

Purpose: plan the database and data migration from the current hybrid PATH model to the agreed target model of one `client`, one `case`, and many `applications`.

Audience: engineering, product, operations, and release planning.

Last Updated: 2026-04-27

## Status

- Planning draft based on current development schema and current code paths.
- Assumes production is in early live use and must be migrated carefully.
- This note is the canonical migration-planning companion to `docs/planning/client-case-application-target-model.md`.
- 2026-04-27 DEV update: `iset_case.application_id` has been physically retired in DEV by `sql/migrations/20260427_0013_retire_legacy_case_application_pointer.sql`, and `iset_application.client_id` / `case_id` are required by `sql/migrations/20260427_0014_harden_application_case_scope.sql`. Older sections below that describe the case-side pointer or nullable application ownership are historical baseline context for TEST/PROD rehearsal and should not be read as current DEV state.
- Status-overhaul planning is tracked in `docs/planning/status-architecture-overhaul.md`.
- The route/query/widget dependency ledger for cutover is tracked in `docs/planning/client-case-application-cutover-dependency-inventory.md`.
- Initial dev-only Release 1 schema artifacts are now drafted in `sql/migrations/20260416_0001_add_application_ownership_and_status_columns.sql` through `sql/migrations/20260416_0004_create_client_case_merge_audit_tables.sql`. Initial Release 2 rehearsal SQL is drafted in `sql/ops/20260416_release2_client_case_application_backfill_preview.sql` and `sql/ops/20260416_release2_client_case_application_backfill_apply.sql`.
- Those Release 1 migrations and Release 2 rehearsal scripts were validated in the local development environment on 2026-04-16 using the canonical migration runner plus direct MySQL execution of the preview/apply SQL.
- Initial DEV-only compatibility writes were implemented on 2026-04-16 in the portal auto-ingest flow, admin manual intake flow, client batch-import case creation helper, `POST /api/cases`, and manual submission-ingest flow so new development rows now populate the additive `iset_application` ownership/status columns and the additive `iset_case.lifecycle_status` column without changing legacy write behavior yet.
- Initial DEV-only compatibility reads were implemented on 2026-04-16 for helper lookups, escalation flows, application detail/case-summary endpoints, applicant application history, main case workspace payloads, case and client work queues, several dashboard list endpoints, several application-driven metrics/reporting queries, document library queries, reminder helpers, assignment helpers, payment packet reads, and applicant-message attachment adoption so those paths now prefer `iset_application.case_id` and fall back to legacy `iset_case.application_id` only when needed.
- As of the same DEV increment, the admin server no longer contains raw `JOIN iset_application ... ON c.application_id = a.id` reads or raw `SELECT application_id FROM iset_case WHERE id = ?` helper lookups in the main cutover paths; remaining `caseRow.application_id` reads now resolve through compatibility queries/helpers instead of direct legacy joins.
- A follow-on DEV cutover increment on 2026-04-16 changed the highest-value write paths to client-first case reuse: portal `POST /api/intake/complete`, admin manual intake, and admin `POST /api/cases` now reuse an existing client case when available, persist `iset_application.client_id` and `iset_application.case_id` explicitly, and refresh the reused case's compatibility `application_id` pointer to the current application for legacy case-centric flows.
- The same DEV increment also updated portal/applicant messaging and signing helper paths so they resolve case/application context through `iset_application.case_id` compatibility first instead of relying only on `iset_case.application_id`.
- A further DEV-only frontend increment on 2026-04-16 introduced shared application-status and case-status normalization helpers, switched the main application widgets and queue tables to application-aware status handling, and normalized legacy case lifecycle presentation toward `intake -> initiated -> active -> dormant -> ready_to_close -> closed -> archived` without changing persisted legacy status writes yet.
- A further DEV-only backend/frontend increment on 2026-04-16 switched the core assessment/status write path onto canonical case lifecycle persistence: `PUT /api/cases/:id`, `/api/cases`, `/api/cases/:id`, `/api/cases/:id/workspace`, and `CoordinatorAssessmentWidget` now write and surface case lifecycle as `intake/initiated/active/dormant/ready_to_close/closed/archived` while still dual-writing legacy-compatible application status plus additive application lifecycle/decision fields.
- Another DEV-only status increment on 2026-04-16 moved key queue-facing reads and applicant decision-notification plumbing toward the additive application model: `GET /api/applications`, several homepage dashboard queue endpoints, and decision-letter/notification helpers now expose or prefer `application_lifecycle_status`, `decision_outcome`, and awaiting/closure qualifiers instead of relying only on raw legacy application status strings.
- Another DEV-only application-workspace increment on 2026-04-16 normalized homepage queue item hydration, application workspace case-data hydration, case workspace context hydration, secure-messaging decision context, supporting-document application selectors, and tutorial gating through a shared additive application-state resolver so those paths now consume `application_lifecycle_status`, `decision_outcome`, and awaiting/closure qualifiers consistently.
- Another DEV-only intervention/status increment on 2026-04-16 introduced an additive intervention compatibility model: intervention payloads now surface derived `review_status` and `delivery_status`, the main intervention create/update/close paths now dual-write `delivery_status`, the interventions table and intervention assessment widget now resolve proposal-review versus live-delivery state through shared helpers, and the NWAC tutorial bootstrap path now prefers pending-decision applications over case status.
- Another DEV-only intervention consistency increment on 2026-04-16 updated the intervention modal and server write endpoints to submit and accept explicit intervention `deliveryStatus`, and aligned case-workspace hydration, header rollups, and backload validation helpers so intervention summaries and edit flows now consume additive review/delivery state instead of only raw legacy intervention status.
- Another DEV-only intervention queue increment on 2026-04-16 updated the intervention approval and milestone dashboard endpoints plus homepage/table consumers so those queues now emit and consume derived intervention `review_status`, `delivery_status`, and effective intervention status instead of treating intervention items as application-style status rows.
- Another DEV-only intervention proposal-compatibility increment on 2026-04-16 added compatibility writes into `iset_intervention_proposal` from the main intervention create/revise/update/close/delete flows, keyed by `legacy_intervention_id`, so DEV can start accumulating proposal-side records without cutting intervention reads fully away from `iset_case_intervention` yet. Approved proposals now stay in that table as audit history even after the linked intervention enters delivery.
- Another DEV-only intervention metrics increment on 2026-04-16 moved the `New intervention proposals` metric toward the proposal model: both the dashboard count and drilldown now read `iset_intervention_proposal` first with a legacy fallback for unsynced rows, while `Interventions completed` remains delivery-driven from `iset_case_intervention`.
- Another DEV-only intervention count-normalization increment on 2026-04-16 realigned case list/workspace intervention counts with the target model so proposal-review rows no longer inflate `openInterventions` and `totalInterventions` as if they were live delivery records.
- Another DEV-only action-plan guard increment on 2026-04-16 aligned plan-close blocking with the additive intervention model on both backend and frontend so open proposal-review rows and open live-delivery rows now consistently block action-plan closure using derived review/delivery state rather than raw legacy intervention status.
- Another DEV-only reporting/export increment on 2026-04-16 aligned the remaining intervention-heavy metric, ESDC, finance-report, and queue/report endpoints with the shared derived review/delivery status model, removing the last known lower-level read paths that were still deriving business meaning straight from raw legacy `iset_case_intervention.status`.
- Another DEV-only application-status cleanup increment on 2026-04-16 removed the legacy compatibility vocabulary from the main manual application-status control. DEV now presents the reduced workflow set (`Submitted`, `In Review`, `Awaiting Applicant`, `Pending Decision`, `Closed`, `Archived`) while still mapping those choices back onto legacy raw `iset_application.status` values during the compatibility period.
- A further DEV-only portal UX increment on 2026-04-16 introduced a participant-facing status presentation layer in the intake app. The public dashboard and submission-details page now present applicant-safe lifecycle messaging and next-step guidance without exposing internal admin workflow terms directly.
- A further DEV-only reconciliation increment on 2026-04-16 added `scripts/reconcile-auto-assessment-intervention-cost-lines.js` so approved auto-assessment interventions that were created or repaired without persisted approved `costLines` metadata can be backfilled deterministically from `iset_case_assessment.proposed_interventions` instead of by ad hoc SQL. This same reconciliation pattern should be reused when auditing TEST/UAT and PROD data before cutover.
- A full TEST rehearsal was executed on 2026-04-16 against a PROD-like dataset: TEST was backed up, restored from a sanitized PROD dump, safety SQL was applied, TEST staff Cognito links were relinked, the refactored code/schema were deployed, and the Release 2 backfill apply SQL was executed successfully. Post-backfill preview checks on TEST reached zero for application ownership gaps, zero for case lifecycle gaps, zero for action-plan application provenance gaps, zero for intervention proposal/delivery backfill gaps, and both TEST target groups remained healthy.
- The same TEST rehearsal confirmed that the current production-like dataset still contains three clients with multiple cases. That is not a blocker for the current additive deployment/backfill release, but it remains a required manual-review / merge queue before PATH can safely enforce one-case-per-client at the database level.
- The same TEST rehearsal also confirmed that active documents missing `client_id` are limited to seeded placeholder `application_submission` rows (`metadata.placeholderUpload = true`), not live participant records. The remaining active documents without `case_id` / `application_id` are therefore a document-model cleanup concern, not an immediate blocker for the current production cutover.
- A later 2026-04-28 privacy ERM PROD-like TEST rehearsal exposed four duplicate client case groups after the final schema shape: Ashlee Barner, Erica Christian, Hailey Lafrance-Chaput, and Shelly Van Loon. The follow-up ops scripts `sql/ops/privacy-erm-duplicate-case-consolidation-preview.sql` and `sql/ops/privacy-erm-duplicate-case-consolidation-apply.sql` now implement the planned historical consolidation step. Rollback-only validation on TEST reported 4 merge pairs, 0 blockers, 18 rows to repoint, 0 remaining case-owned references, and 0 remaining duplicate client case groups.

## Migration Goal

Move PATH to this operating model without breaking intake, approval, casework, or reporting:

- one `client` per real person
- one `case` per `client`
- many `applications` per `client`
- every submitted `application` carries both `client_id` and `case_id`
- `action_plan` remains case-owned, with optional `application_id` provenance

## Status-Record Migration Rule

For application-status rollout, do not rewrite production `iset_application.status` to the new target vocabulary on day one.

Use this order instead:

1. Backfill additive fields (`lifecycle_status`, `decision_outcome`, `awaiting_reason`, `closure_reason`) from legacy `status` using the mapping table in `docs/planning/status-architecture-overhaul.md`.
2. Cut TEST/PROD reads and UI presentation over to the additive fields first.
3. Keep legacy raw `status` in place as a compatibility field during the rollout window, even if DEV UI no longer exposes the legacy labels.
4. Only after all critical consumers stop depending on raw legacy status should PATH decide whether to rewrite, repurpose, or retire `iset_application.status`.

This keeps the production migration reversible and avoids coupling UI cleanup to an immediate destructive data rewrite.

## Current Schema Fitness Assessment

The current schema is only partially fit for the agreed target model.

What is already aligned:

- `client` already exists as the canonical person entity.
- Most operational child records are already case-owned: assessments, action plans, interventions, notes, tasks, events, reminders, finance snapshots, and several reporting tables.
- `iset_document` already supports `client_id`, `case_id`, `application_id`, and `action_plan_id`.

What is not fit for purpose:

- `iset_application` has no `client_id` and no `case_id`.
- `iset_case.client_id` is nullable and not unique, so the database does not enforce one case per client.
- `iset_case.application_id` still acts as the primary relationship anchor, which only supports one application per case.
- `iset_case_action_plan` is case-owned but has no `application_id` provenance column.
- Many API routes, queries, and widgets still resolve application context through `iset_case.application_id`.

Conclusion:

- The entity model does need a database-level change.
- This should be handled as an additive migration first, followed by workflow cutover, followed by cleanup and enforcement.

## Target Schema Delta

Recommended target shape:

- `client`
  - remains the canonical person row

- `iset_case`
  - `client_id` becomes required
  - add unique constraint on `client_id` after data cleanup
  - stop using `application_id` as the ownership anchor
  - keep legacy `application_id` only during transition, then retire or repurpose it explicitly

- `iset_application`
  - add `client_id`
  - add `case_id`
  - both required for submitted applications after backfill and cutover
  - application ownership must be explicit here, not inferred from `iset_case.application_id`

- `iset_case_action_plan`
  - add nullable `application_id`
  - this is provenance only, not ownership

- migration/audit support
  - add a case-merge audit table or equivalent mapping so historical case ids can be traced if duplicate cases are consolidated
  - likely add the same kind of audit/mapping for any client merges that are needed before case cleanup

## Recommended Migration Principles

- additive before destructive
- dual-write before cutover
- dual-read where necessary during transition
- no historical case merge until all core reads stop depending on `iset_case.application_id`
- test against prod-like data before touching prod
- production merge work should be reviewable, reversible, and logged

## Affected Workflows

These flows are directly affected and must be included in rehearsal:

- public portal submission
- pre-submission document staging and submit-time document linking
- manual application intake
- client batch import
- admin `POST /api/cases`
- application assignment queues and workspace routing
- approval completion in the assessment workspace
- reminders, secure messages, and document adoption
- action plan creation and later casework
- reporting and export flows that still join `case -> application`
- status badges, work queues, and approval routing

## Current Workflow Reality Driving Migration Order

The migration cannot start with historical case merges alone because current write paths still create and resolve records through the old shape.

Current behavior confirmed in code:

- public portal submit resolves or creates `client`, creates or reuses `application`, then looks for `iset_case` by `application_id` and creates an application-backed case if none exists
- manual intake creates `submission`, then `application`, then `client`, then a new `case` with that `application_id`
- admin `POST /api/cases` still prevents duplicates by `application_id`, not by `client_id`
- approval completion still assumes the active workspace case has one current application and can still repair `client_id` linkage at approval time
- many dashboard, reminder, messaging, and document flows still use `case.application_id` as the quickest route to application context

Because of that, the safe order is:

1. add schema
2. backfill
3. update reads and writes
4. only then change behavior for new submissions
5. only after that merge historical duplicates

## Proposed Rollout Strategy

Use four releases rather than one big migration.

### Release 1: Schema Expansion Only

Apply additive schema changes without changing business behavior yet:

1. Add `iset_application.client_id` nullable.
2. Add `iset_application.case_id` nullable.
3. Add indexes and foreign keys for both.
4. Add `iset_case_action_plan.application_id` nullable.
5. Add additive status-overhaul columns/tables where approved, including the future `iset_application` and `iset_case` status fields and the intervention proposal structure.
6. Add migration audit tables for client merges and case merges.
7. Do not drop or rename `iset_case.application_id` yet.

This release should be safe to deploy before any code cutover.

### Release 2: Backfill + Compatibility Code

Deploy code that can read the new columns while still tolerating legacy rows.

Backfill initial links:

1. Backfill `iset_application.client_id` from the currently linked case.
2. Backfill `iset_application.case_id` from the currently linked case.
3. Backfill `iset_case_action_plan.application_id` from the current case's `application_id`.
4. Repair any document/message/reminder rows that can safely inherit missing `client_id` or `case_id`.
5. Backfill the new status fields from the current overloaded status values using `docs/planning/status-architecture-overhaul.md`.

Compatibility behavior during this phase:

- new portal submissions must write `application.client_id` and `application.case_id`
- manual intake must write `application.client_id` and `application.case_id`
- read paths should prefer `application.case_id` when present
- read paths should prefer the new status columns when present
- legacy fallback to `iset_case.application_id` can remain temporarily

At the end of this release, new and old rows should both be readable.

### Release 3: Workflow Cutover

Change business behavior for new data:

1. Resolve or create the `client`.
2. Reuse that client's existing `case` if one exists.
3. Create the new `application` with both `client_id` and `case_id`.
4. Stop creating one new case per application.

Workflow changes required:

- portal submit must find case by `client_id`, not by `application_id`
- manual intake must do the same
- `POST /api/cases` must treat `client_id` as the primary uniqueness key
- approval logic must stop being the point where client/case linkage is repaired
- approval and queue logic must stop relying on overloaded legacy `status` meanings
- application workspace routing must use explicit `application_id`
- dashboards and reporting must stop assuming one case has exactly one application

This is the first release where PATH actually starts behaving like the target model for new transactions.

### Release 4: Historical Data Consolidation + Constraint Enforcement

Only after Release 3 is stable:

1. audit duplicate clients
2. merge duplicate clients where required
3. audit multiple cases per canonical client
4. choose the canonical case per client
5. move child rows from duplicate cases to the canonical case
6. repoint `iset_application.case_id` to the canonical case
7. record merge lineage in audit tables
8. remove or retire obsolete duplicate case rows
9. enforce `iset_case.client_id` unique
10. enforce `iset_case.client_id` not null
11. enforce `iset_application.client_id` and `iset_application.case_id` not null for submitted applications
12. retire legacy reliance on `iset_case.application_id`
13. retire legacy overloaded status fields and normalizers once all reads/writes are cut over

This is the only phase that should require a controlled production data-migration window.

## Test Environment Plan

The current local development database is useful for schema inspection but not for migration rehearsal because it has little or no representative live data.

Recommended test approach:

1. Refresh the test/UAT environment from a recent sanitized production snapshot.
2. Run the audit queries before any schema change.
3. Apply Release 1 schema changes.
4. Run Release 2 backfill scripts.
5. Deploy compatibility code.
6. Run full workflow UAT.
7. Only then enable Release 3 cutover behavior in test.
8. After that, rehearse the historical merge and Release 4 constraint enforcement in test.

Operational note from the 2026-04-16 rehearsal setup:

- We captured a fresh PROD dump plus a reversible TEST backup, but a raw PROD -> TEST clone was intentionally not treated as the final restore artifact for UAT.
- TEST still has live SES credentials and the admin backend runs reminder/doc-request/allocation pollers in memory, so restoring raw PROD data without a post-load safety pass risks outbound side effects.
- Raw PROD identity-link fields also do not automatically match the TEST Cognito pools, so TEST staff/applicant sign-in assumptions can drift immediately after a blind clone.
- Use `docs/ops/environments/test-prod-migration-rehearsal.md` plus `sql/ops/test-prod-like-restore-postload.sql` as the immediate side-effect guard after the destructive TEST overwrite.
- Run `sql/ops/test-prod-like-restore-identity-overlay.sql` only after the migration/backfill scripts have used restored PROD Cognito subjects to populate typed actor references, and before TEST apps are restarted.

## Production Migration Plan

Production should not be migrated in one pass.

### Phase A: Pre-Prod Audit

Before changing prod behavior, produce a reviewed report of:

- duplicate client candidates
- clients with more than one case
- cases with null `client_id`
- applications with no linked case after backfill
- child records still pointing to duplicate or orphaned cases
- any flows still reading only through `iset_case.application_id`

This report should be reviewed by both engineering and business owners.

### Phase B: Low-Risk Additive Deployment

Deploy Release 1 plus Release 2 code to prod first:

- new columns
- new indexes/FKs
- backfill scripts
- compatibility reads/writes

No one-case-per-client behavior change yet.

### Phase C: Behavioral Cutover for New Data

After Phase B is validated:

- switch portal and admin intake to case reuse by `client_id`
- switch application reads to `application.case_id`
- keep legacy fallback in place briefly for safety

This prevents the duplicate-case problem from getting worse.

### Phase D: Historical Merge Window

After new writes are stable:

- run reviewed client merges if needed
- run reviewed case merges
- validate counts and integrity
- then add uniqueness and not-null enforcement

This phase should happen in a controlled window with:

- verified backup/snapshot
- migration runbook
- post-run integrity checks
- rollback criteria defined in advance

## Data Audit Checklist

These audits must exist before the production merge:

- potential duplicate clients by Cognito sub
- potential duplicate clients by applicant username
- potential duplicate clients by SIN hash
- potential duplicate clients by normalized email plus DOB
- potential duplicate clients by name plus DOB
- clients with more than one case
- cases with no client
- cases with children but no client
- applications with no case after backfill
- applications whose case and client links disagree
- documents/messages/reminders with `application_id` but no usable `case_id` or `client_id`

## Initial Audit SQL Pack

These are the first concrete audits to run in test against a production-like snapshot, and later in production before the merge window.

Duplicate cases per client:

```sql
SELECT client_id, COUNT(*) AS case_count
FROM iset_case
WHERE client_id IS NOT NULL
GROUP BY client_id
HAVING COUNT(*) > 1
ORDER BY case_count DESC, client_id;
```

Cases missing `client_id`:

```sql
SELECT id, application_id, status, created_at, updated_at
FROM iset_case
WHERE client_id IS NULL
ORDER BY updated_at DESC, id DESC;
```

Applications with no linked case under the legacy model:

```sql
SELECT a.id, a.submission_id, a.status, a.created_at
FROM iset_application a
LEFT JOIN iset_case c ON c.application_id = a.id
WHERE c.id IS NULL
ORDER BY a.created_at DESC, a.id DESC;
```

Cases sharing the same legacy `application_id`:

```sql
SELECT application_id, COUNT(*) AS case_count
FROM iset_case
WHERE application_id IS NOT NULL
GROUP BY application_id
HAVING COUNT(*) > 1
ORDER BY case_count DESC, application_id;
```

Documents missing usable ownership context:

```sql
SELECT id, client_id, case_id, application_id, action_plan_id, source, status, file_name
FROM iset_document
WHERE status = 'active'
  AND client_id IS NULL
ORDER BY id DESC;
```

Backfill verification after `iset_application.client_id` and `iset_application.case_id` are added:

```sql
SELECT a.id, a.status, a.client_id, a.case_id
FROM iset_application a
WHERE a.client_id IS NULL OR a.case_id IS NULL
ORDER BY a.id DESC;
```

## Canonical Case Selection Rules

The merge script should not guess blindly. It should generate a recommendation and allow review.

Recommended precedence:

1. prefer the case with active action plans or active interventions
2. otherwise prefer the case with the richest operational history
3. otherwise prefer the currently assigned/open case
4. otherwise prefer the most recently updated case
5. use case number / created date only as tie-breakers

Any ambiguous client should be flagged for manual review rather than auto-merged.

## Child Tables Likely To Move During Case Merge

At minimum, review and likely repoint these case-owned tables:

- `iset_case_assessment`
- `iset_case_action_plan`
- `iset_case_intervention`
- `iset_case_note`
- `iset_case_task`
- `iset_case_event`
- `iset_case_reminder`
- `iset_case_watch`
- `iset_case_action_item`
- `iset_case_compliance_check`
- `iset_case_financial_snapshot`
- `finance_transaction`
- `payment_packet`
- `esdc_participant_submission`
- `messages`
- `message_attachment`
- `iset_document`
- any workflow or export table carrying `case_id`

Every such move must be part of the scripted merge plan, not handled ad hoc.

## Validation Gates

The rollout is not complete until these are true:

- every submitted `application` has `client_id` and `case_id`
- every live `case` has `client_id`
- no client has more than one live case
- historical duplicate case rows have been consolidated through a reviewed `iset_case_merge_audit`-recorded script, with merged-away case rows detached from `client_id`
- portal resubmission for an existing client reuses the case
- manual intake for an existing client reuses the case
- client batch import still supports valid application-less historical case files
- approvals still work when a case already has prior applications
- document, reminder, and message flows still resolve the correct application and case context
- key dashboards and exports produce the same or better counts than before

## Open Decisions Still Required

- exact schema for merge lineage: mapping table, redirect table, or both
- exact rules for client deduplication before case merge
- whether `iset_case.application_id` should later be dropped or renamed to something like `originating_application_id`
- final application-workspace route shape once a case can hold many applications

## Immediate Next Step

Produce a concrete inventory of the tables, queries, and routes that still assume `iset_case.application_id` is the main application relationship, then size the Release 2 and Release 3 code changes from that list.
