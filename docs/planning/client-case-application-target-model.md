# Client, Case, and Application Target Model

Purpose: define the agreed PATH entity model for `client`, `case`, and `application`, and track the migration from the current hybrid implementation.

Audience: product, engineering, reporting/data, and migration planning.

Last Updated: 2026-04-16

## Status

- Target model agreed in design discussion.
- Current implementation remains hybrid.
- This note is the canonical planning record for future schema/workflow changes in this area.
- Migration planning is tracked in `docs/planning/client-case-application-migration-plan.md`.
- Target status architecture is tracked in `docs/planning/status-architecture-overhaul.md`.
- The concrete dependency inventory for cutover is tracked in `docs/planning/client-case-application-cutover-dependency-inventory.md`.

## Canonical Entity Roles

- `client`: the canonical person record. One real person should map to one `client`. Duplicate client rows are data defects.
- `case`: the long-lived operational file for that client. One client should have one case.
- `application`: a discrete intake/request/decision event. A client may have many applications over time.
- `action_plan`: a support episode inside the case. Action plans are owned by the case and may optionally retain application provenance.
- `draft`: pre-submission working state. Drafts are not applications.

## Target Relationships

- one `client` -> one `case`
- one `client` -> many `applications`
- one `case` -> many `applications`
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

- Public portal `POST /api/intake/complete` already resolves or creates `client`, creates or reuses the working `application`, and creates or updates an application-backed `case`.
- Manual application intake already creates `client` and `iset_case`.
- Client Batch Import already supports `client` plus application-less `iset_case`.
- The system is still hybrid because:
  - `iset_application` does not currently store `client_id` or `case_id`.
  - `iset_case` still carries a single `application_id` anchor.
  - case creation and lookup paths commonly treat `application_id` as the primary case lookup key.
  - same-client prior-case detection is warning-only rather than enforced case reuse.
  - `iset_case_action_plan` is case-owned, but has no `application_id` provenance field.
  - many workspace, dashboard, and document flows still infer application context through `iset_case.application_id`.

## Schema Target

- `client`
  - canonical person row

- `iset_case`
  - `client_id` required
  - one row per client
  - if a direct application reference is still needed, it should be treated as provenance only (for example `originating_application_id`), not as the ownership anchor

- `iset_application`
  - add `client_id`
  - add `case_id`
  - both required for submitted rows
  - application ownership must no longer depend on `iset_case.application_id`

- `iset_case_action_plan`
  - keep `case_id` as the owning foreign key
  - optional `application_id` for provenance

- `iset_document`
  - keep case-oriented organization
  - allow optional `application_id` and `action_plan_id` provenance where needed

## Migration Implications

1. Audit PROD data for duplicate clients and multiple cases per client.
2. Choose the canonical case per client and define merge rules for any parallel case rows.
3. Backfill `iset_application.client_id` and `iset_application.case_id`.
4. Change write paths so intake/import flows resolve by client first, then case, then application.
5. Change read paths and reporting to stop assuming `iset_case.application_id` is the only application join path.
6. Add and enforce one-case-per-client constraints after data cleanup.
7. Retire or repurpose `iset_case.application_id` once no core flow depends on it as the primary relationship anchor.

## Current Verified Gaps To Resolve

- Portal submission currently creates a case keyed by `application_id` when no row exists for that application; it does not yet automatically reuse an existing same-client case.
- Admin `POST /api/cases` checks for an existing case by `application_id`, not by `client_id`.
- Application workspace routes and many dashboard docs still describe application lookup through `iset_case.application_id`.
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

## Next Planning Step

- Use `docs/planning/client-case-application-cutover-dependency-inventory.md` to draft the Release 1 DDL, Release 2 backfill scripts, and the write-path cutover work for portal submit, manual intake, `POST /api/cases`, and `PUT /api/cases/:id`.
