# Client, Case, and Application Target Model

Purpose: define the agreed PATH entity model for `client`, `case`, and `application`, and track the migration from the current hybrid implementation.

Audience: product, engineering, reporting/data, and migration planning.

Last Updated: 2026-05-08

## Status

- Target model agreed in design discussion.
- DEV now enforces explicit `iset_application.client_id` and `iset_application.case_id` for submitted applications.
- This note is the canonical planning record for future schema/workflow changes in this area.
- Migration planning is tracked in `docs/planning/client-case-application-migration-plan.md`.
- Target status architecture is tracked in `docs/planning/status-architecture-overhaul.md`.
- The concrete dependency inventory for cutover is tracked in `docs/planning/client-case-application-cutover-dependency-inventory.md`.

## Canonical Entity Roles

- `client`: the canonical person record. One real person should map to one `client`. Duplicate client rows are data defects.
- `case`: the long-lived operational file for that client. One client should have one case.
- `application`: a discrete intake/request/decision event. A client may have many applications over time.
- `assessment`: the application-specific assessment, recommendation, review, and generated-document source for a discrete application inside a case.
- `action_plan`: a support episode inside the case. Action plans are owned by the case and may optionally retain application provenance.
- `draft`: pre-submission working state. Drafts are not applications.

## Target Relationships

- one `client` -> one `case`
- one `client` -> many `applications`
- one `case` -> many `applications`
- one `application` -> zero or one application assessment
- one `case` -> many `action_plans`
- one `action_plan` -> many `interventions`
- documents belong to the case context and may also carry application or action-plan provenance

## Entry-Path Rules

- Portal registration alone does not create a `case`.
- Successful application submission/receipt must resolve or create the `client` and resolve or create that client's single `case`.
- A submitted `application` must be created with both `client_id` and `case_id`.
- Manual application intake follows the same rule.
- Client Batch Import resolves or creates `client` and `case`, but does not create an `application` unless the imported row truly represents an application event.
- Imported historical client files may validly be case-backed and application-less.

## Submitted Application Invariants

- A submitted `application` must have both `client_id` and `case_id`.
- `client_id` and `case_id` on `application` are explicit and should not depend on inference through `iset_case.application_id`.
- An `application` belongs to exactly one `client` and exactly one `case`.
- Draft rows are exempt until submission/receipt.

## Document Organization

- Pre-submission uploads may exist in draft/staging stores before a real `application` exists.
- At submission, staged documents should be attached to the `application` within the `case` context.
- Post-submission operational documents are case-organized by default.
- `application_id` and `action_plan_id` on documents are provenance/context fields, not alternate ownership models.

## Current Implementation Snapshot

Verified from current schema and code:

- Public portal `POST /api/intake/complete` resolves or creates `client`, resolves or creates the client's `case`, then inserts or updates the working `application` with `client_id` and `case_id`.
- Manual application intake creates `client`, resolves or creates `iset_case`, then inserts `iset_application` with `client_id` and `case_id`.
- Client Batch Import already supports `client` plus application-less `iset_case`.
- Case-level "primary application" joins now prefer non-terminal application rows before terminal rows (`approved`, `completed`, denied/withdrawn/cancelled/closed/archived states), so late client-file or document updates on historical completed applications do not make those applications the current queue target when a newer active application exists.
- `PUT /api/cases/:id` rejects attempts to move a terminal application back into review or document-request queues; the approved-to-completed finish transition remains allowed.
- Discovered gap on 2026-05-07, scoped on 2026-05-08: `iset_case_assessment` still has one row per `case_id` and no `application_id`, so repeat applications on the same case can load and overwrite the prior application's assessment. Current first-pass decision is Option B containment: add `iset_application_assessment` and move the application assessment workflow/direct read-write surfaces before any full in-place `iset_case_assessment` ERM correction. DEV now has the additive table and first containment code patch; TEST has completed schema/backfill/DB-fixture rehearsal, but PROD deployment is still pending authenticated browser/PDF/queue smoke and must follow `docs/planning/application-assessment-application-scope-migration-plan.md`.
- Remaining non-final pieces:
  - TEST/PROD still need the DEV backfill/retirement/hardening migrations rehearsed against live data.
  - Some workflows still accept `application_id` as an entry parameter, but they now resolve the case through `iset_application.case_id` instead of a case-side pointer.
  - same-client prior-case detection is warning-only rather than enforced case reuse.
  - Some dashboards and documents still expose an `application_id` field in response payloads for compatibility, derived from `iset_application.case_id`.

## Schema Target

- `client`
  - canonical person row

- `iset_case`
  - `client_id` required
  - one row per client
  - no direct application ownership pointer

- `iset_application`
  - keep `client_id`
  - keep `case_id`
  - both required for submitted rows; DEV enforces this as `NOT NULL`
  - application ownership must no longer depend on `iset_case.application_id`

- application assessment
  - target one assessment per application, not one assessment per case
  - current containment plan adds `iset_application_assessment` while retaining `iset_case_assessment` as legacy compatibility
  - keep `case_id` as case context and use `application_id` for selected application ownership
  - allow application-less assessment only for explicitly supported imported/historical case work
  - migration planning lives in `docs/planning/application-assessment-application-scope-migration-plan.md`

- `iset_case_action_plan`
  - keep `case_id` as the owning foreign key
  - optional `application_id` for provenance

- `iset_document`
  - keep case-oriented organization
  - allow optional `application_id` and `action_plan_id` provenance where needed

## Migration Implications

1. Audit PROD data for duplicate clients and multiple cases per client.
2. Choose the canonical case per client and define merge rules for any parallel case rows.
3. Backfill `iset_application.client_id` and `iset_application.case_id`. DEV has completed this shape, physically retired `iset_case.application_id`, and made both application ownership columns `NOT NULL`; TEST/PROD still need preflight/backfill rehearsal.
4. Change write paths so intake/import flows resolve by client first, then case, then application.
5. Change read paths and reporting to stop assuming `iset_case.application_id` is the only application join path.
6. Add and enforce one-case-per-client constraints after data cleanup.
7. Retire or repurpose `iset_case.application_id` once no core flow depends on it as the primary relationship anchor. Completed in DEV by migration `20260427_0013_retire_legacy_case_application_pointer.sql`.
8. Harden application ownership after the backfill is clean. Completed in DEV by migration `20260427_0014_harden_application_case_scope.sql`.
9. Move application assessment workflow reads/writes to the additive `iset_application_assessment` store before repeat-application assessment workflows are rolled out to TEST/PROD. DEV has started this containment path; TEST/PROD evidence is still required before release.

## Current Verified Gaps To Resolve

- TEST/PROD still need rehearsal for the `20260427_0013` and `20260427_0014` migrations because live rows may contain duplicate, missing, nullable, or mismatched legacy case/application ownership data that DEV trash data does not.
- Admin `POST /api/cases` and related manual-intake paths still need product review for strict one-case-per-client enforcement rather than warning-only reuse.
- Some dashboard/docs language still says "case application" where the implementation now means "latest application in the case."
- Status and workflow logic are already partly split between application lifecycle and case lifecycle, but the relational model has not fully caught up.

## Non-Goals

- Do not create empty cases at mere signup/registration.
- Do not fabricate applications for imported historical client files.
- Do not treat duplicate client rows or duplicate case rows as normal operating state.

## Canonical Docs To Keep Aligned

- `docs/guides/single-case-per-client.md`
- `docs/guides/status-lifecycle-implementation.md`
- `docs/dashboards/application-assessment-dashboard.md`
- `docs/guides/client-file-imports.md`
- `docs/data/documents-model.md`
- `docs/planning/client-case-application-migration-plan.md`
- `docs/planning/status-architecture-overhaul.md`
- `docs/planning/application-assessment-application-scope-migration-plan.md`

## Next Planning Step

- Use `docs/planning/client-case-application-cutover-dependency-inventory.md` to draft the Release 1 DDL, Release 2 backfill scripts, and the write-path cutover work for portal submit, manual intake, `POST /api/cases`, and `PUT /api/cases/:id`.
