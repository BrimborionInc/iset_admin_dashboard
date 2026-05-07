# Application Assessment Application-Scope Migration Plan

Status: current

Purpose: plan the fix for the repeat-application assessment defect discovered during DEV testing of the `one client -> one case -> many applications` model.

Audience: engineering, product, operations, release planning, and future Codex threads.

Last Updated: 2026-05-07

## Executive Summary

PATH now allows one client/case to have multiple applications, but the assessment record is still stored as one row per case in `iset_case_assessment`. That makes a repeat application open the previous application's assessment and makes saves overwrite that prior assessment.

This is a schema and workflow bug, not a WSL migration dependency issue. Do not patch this directly into PROD alongside unrelated releases. Treat it as its own DEV-first, TEST-rehearsed, PROD-safe data migration.

## Current Evidence

- DEV schema has `iset_case_assessment.case_id` as the primary key and no `application_id`.
- Assessment saves in `isetadminserver.js` insert/update `iset_case_assessment` with `case_id` and `ON DUPLICATE KEY UPDATE`.
- Case/application hydration paths still join assessment data with `LEFT JOIN iset_case_assessment ca ON ca.case_id = c.id`.
- Generated assessment PDFs/documents already carry `iset_document.application_id` in many paths, so document provenance can help infer which existing application an old assessment belonged to.
- DEV repeat-application test case on 2026-05-07 showed two applications on the same case. Opening the second application correctly selected the new `iset_application`, but the assessment wizard loaded the one shared `iset_case_assessment` row from the first application.

## Target Behavior

- An application assessment belongs to one `iset_application` within the case context.
- A repeat application on an existing case starts with no assessment data unless staff explicitly choose to copy a previous assessment in a future feature.
- Saving a new application's assessment must not mutate the prior application's assessment.
- Previously generated assessment PDFs, approval letters, denial letters, redlines, and document rows remain immutable historical evidence.
- Case-level child records such as action plans, interventions, notes, reminders, and secure messages can remain case-owned unless their own workflow requires application provenance.
- Application-specific decision, eligibility, proposed intervention, funding recommendation, assessment PDF, and related review fields must resolve against the selected application.

## PROD Risk

PROD has live assessment data that was captured while the system assumed one assessment per case. A naive migration can corrupt history.

Do not:

- duplicate the same old assessment onto every application in the case;
- guess the owning application when document/timestamp evidence is ambiguous;
- make `application_id` mandatory before imported/application-less historical files are understood;
- run this in the same deployment window as unrelated PROD changes;
- deploy code that reads assessment by `application_id` while the schema still prevents more than one assessment row per case;
- deploy schema that makes `case_id` non-unique while old code can still insert by `case_id` only.

## Recommended Schema Direction

Preferred target for `iset_case_assessment`:

- add a surrogate `id BIGINT UNSIGNED AUTO_INCREMENT` primary key;
- keep `case_id` as a required indexed foreign key to `iset_case`;
- add nullable `application_id BIGINT UNSIGNED`;
- add a foreign key from `application_id` to `iset_application(id)`;
- add `UNIQUE KEY uq_iset_case_assessment_application (application_id)`;
- allow multiple `NULL` `application_id` rows only during migration/imported-file handling, with code preventing more than one active application-less assessment per case.

This is an in-place target. Because it changes the uniqueness model from one row per case to one row per application, it must be deployed as a coordinated code + schema release under maintenance, after TEST rehearsal.

Fallback design to consider during implementation planning: create a new `iset_application_assessment` table with the same assessment columns, migrate reads/writes there, then retire `iset_case_assessment` later. That is more additive and deployment-order safe, but it creates a temporary dual-source model. Choose it only if TEST rehearsal shows in-place migration risk is too high.

## Backfill Rules

Backfill existing assessment rows conservatively:

1. If the case has exactly one application, attach the assessment row to that application.
2. If generated assessment documents for the case point to one clear `application_id`, attach the assessment row to that application.
3. If timestamps and document provenance clearly agree, attach the row to that application and record the evidence in an audit note/table.
4. If multiple applications are plausible, leave the row unresolved for manual review rather than copying or guessing.
5. If a case is validly application-less because it came from historical import, preserve an application-less assessment path until a product decision removes it.

The safest historical rule is: preserve evidence first, improve UX second. A blank assessment on the new application is better than false audit history.

## Required Code Changes

The implementation should update all assessment reads and writes together.

Core changes:

- Carry `applicationId` through application-list links, application workspace routing, case hydration, assessment save, assessment submit, decision review, PDF generation, and generated-document persistence.
- Validate that the requested `applicationId` belongs to the current `caseId` before reading or writing assessment data.
- Load assessment fields with `ca.application_id = selected application.id` for application-backed work.
- Use application-less fallback only for imported/historical case work where no selected application exists.
- Save assessment rows with both `case_id` and `application_id`.
- Make assessment-generated document queries and versioning count documents for the selected application, not all assessment documents on the case.
- Ensure application lists, work queues, SLA/timeline displays, decision widgets, approval/denial logic, funding cost reads, and reconciliation scripts do not accidentally pick a previous application's assessment.
- Update any audit, repair, and ops SQL that joins assessment by case only.

Known high-risk surfaces include:

- `PUT /api/cases/:id` assessment save/submit path;
- `GET /api/cases/:id` and application workspace hydration;
- `/api/applications` and work-queue assessment columns;
- assessment PDF generation and versioning;
- funding recommendation/cost reads;
- document checklist and generated-document expectations;
- `scripts/reconcile-auto-assessment-intervention-cost-lines.js`;
- privacy/relationship audit scripts and production repair SQLs that reference `iset_case_assessment`.

## Preflight Audit

Before any schema or code implementation, run read-only audits in DEV, TEST, and PROD:

- cases with more than one application and an assessment row;
- cases with one assessment row and generated assessment documents across multiple applications;
- assessment rows with no generated document provenance;
- generated `case_assessment`, `case_assessment_approved`, and `case_assessment_redline` documents with missing `application_id`;
- application-less cases with assessment rows;
- active/review applications whose selected assessment would be blank after migration;
- production feedback/issues tied to repeat applications.

The audit output should classify each existing row as `single_application`, `document_provenance_clear`, `ambiguous`, or `applicationless_case`.

## Rollout Plan

1. Freeze this work out of the unrelated PROD deployment scheduled for 2026-05-07.
2. Write the audit SQL and run it read-only against DEV first.
3. Implement DEV schema/code behind a dedicated branch or change set.
4. Add focused tests for two applications on one case:
   - old application retains old assessment;
   - new application starts blank;
   - saving new assessment does not change old assessment;
   - generated assessment docs attach to the selected application;
   - work queues and application detail read the selected application's assessment.
5. Refresh TEST from a sanitized PROD-like snapshot if possible.
6. Run the preflight audit on TEST and inspect ambiguous rows.
7. Rehearse the full schema/code/backfill deployment on TEST under maintenance behavior.
8. Smoke the repeat-application workflow, assessment approval, generated PDFs, funding recommendation, queues, and reporting.
9. Schedule a separate PROD maintenance window with snapshot/restore point, in-app warning, ALB fixed-response fallback, and post-deploy smoke.
10. Run PROD audit and backfill with a rollback plan. Do not proceed if ambiguity is higher than the reviewed threshold.

## Open Product Decision

Staff may eventually want a deliberate `Copy previous assessment` action for repeat applicants. That should be a visible, auditable workflow choice, not automatic prefill. It is not required for the defect fix.

## Current Hold

As of 2026-05-07, no code, schema, database, or deployment changes have been made for this assessment-scope fix. Planning is documented now because unrelated PROD changes are being deployed tonight.
