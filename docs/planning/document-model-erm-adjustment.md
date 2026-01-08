# Document Model ERM Adjustment (Plan)
Purpose: Track design, planning, and implementation for reworking supporting document relationships.
Audience: Admin dashboard and backend engineers, ops, and reviewers.
Last Updated: 2026-01-08

## Phase Tracker
- Design: Complete
- Planning: Complete
- Implementation: Complete

## Objective
Transition to a model where a single document can be associated with a client plus optional application/case, and multiple interventions (scoped to a single action plan).
Immediate goal: rewire intake to ensure a client record exists before document uploads.

## Constraints / Guardrails
- Dev environment only; no legacy considerations.
- No data migrations, backfills, or fallback logic.
- Do not touch backend or database until the plan is complete and approved.
- Keep this document up to date for thread handoff.
- All documents must be associated with a single client record; no orphans permitted.

## Current State (to capture)
- Existing document tables and relationships.
- Current attachment/linking flows and ownership rules.
- Any constraints, uniqueness rules, or assumptions in code.
- Client rows are created in the admin backend when a case is moved to initiated/approved; the intake server creates the submission, application, and case but does not insert into `client` (see `isetadminserver.js` and `../ISET-intake/server.js`).
- Client match logic (admin backend): match by SIN hash (with optional DOB), then fallback scan of prior submissions for SIN hash, then emailNormalized, then name+DOB (or name-only when DOB missing); insert a new client if no match, and update `client.address_json.sinHash` when a match is found.

## Current Flow Summary (Intake)
- `/api/uploads/presign` creates a pending upload; no client record linkage.
- `/api/documents/finalize` stores into `iset_application_file` and dual-writes to `iset_document` (application_id may be null until submission).
- `/api/upload-application-file` handles direct local uploads (legacy path).
- `/api/intake/complete` creates `iset_application_submission`, `iset_application`, and `iset_case` (no client_id); then runs PDF generation + document linking.

## Proposed Data Model Changes (Phase 1)
- Add `client.applicant_cognito_sub` (nullable, unique) to persist Cognito sub → client mapping.
- Add `iset_document.client_id` (nullable) with index + FK to `client.id`; set for new intake-origin documents.
- Add `input_json_state.client_id` (nullable) to pin the resolved client for the active intake session.

## Target Model (draft description)
- A document must link to exactly one client.
- A document may link to at most one application/case.
- A document may link to one or more interventions, but only within a single action plan.
- When a document links to child entities (interventions, payment line items), store the parent container explicitly (action plan, payment packet). Do not store redundant parent-of-parent links (e.g., case_id or application_id alongside action_plan_id) or line-item links when packet-level is sufficient.
- A document may link to payment packets; line-item association is inferred from the packet.
- Documents linked to an application are exclusive to that application; reusable documents should remain client-only or attach to an action plan if appropriate.
- Cardinalities, ownership rules, and allowed combinations to be clarified during design.
- Client record creation moves into the public portal file upload flow (tied to the intake workflow file upload component).
- File upload must ensure a matching client exists before upload proceeds, using current matching rules.
- Matching inputs come from the in-flight intake JSON; when fields are missing, fall back to Cognito identity.
- Fallback identity uses Cognito `given_name`/`family_name` when present; otherwise use the Cognito username/email.
  - Decision (draft): enforce client creation at `/api/uploads/presign` (earliest, pre-upload) with a safety guard for direct `/api/upload-application-file` calls.
- Once resolved, the `client_id` is pinned for the session (stored in input JSON state) and reused for later uploads and submit-generated PDFs.
- Cognito `sub` is the usual durable identity, but SIN remains the authoritative unique identifier for initial matching when available.
- After an initial SIN-based match or creation, future matching should rely on Cognito `sub`.
- Persist Cognito `sub` on the `client` table via a new column `applicant_cognito_sub` (nullable, unique).
- Action plan creation paths:
  - When an application is approved and completed, an action plan specific to that application is created; documents supporting interventions within that plan can also link to the originating application.
  - Action plans can also be created for existing clients without applications; in those cases, non-client document links should attach to the action plan and its interventions only.
- Non-client document links cannot be reused across action plans.
- Financial evidence documents follow the same action-plan scoping rules unless a conflict is identified.

## Example Scenarios (draft)
- Identity verification document: link `client_id` only; reused across applications and action plans implicitly via the client.
- Application-specific document: link `client_id` + `application_id` (single application only).
- Case-only document: link `client_id` + `case_id` (no application link).
- Action plan from approved application: link `client_id` + `action_plan_id` + interventions (application derived via case).
- Standalone action plan: link `client_id` + `action_plan_id` + interventions (no application link).
- Payment evidence (e.g., void cheque): link `client_id` + `payment_packet_id`; reused across packets for the same client if needed.

## Proposed ERM Changes (Phase 2)
- `iset_document`: add `action_plan_id` (FK to `iset_case_action_plan`) to represent the parent container when documents are linked to interventions.
- Replace single `linked_intervention_id` with a join table:
  - `iset_document_intervention` (`document_id`, `intervention_id`, `created_at`), unique on (`document_id`, `intervention_id`).
  - Enforce in application logic that all interventions linked to a document share the same `action_plan_id` as the document.
- Payments:
  - Keep `payment_packet_document` as the canonical evidence link (packet-level).
  - Stop using `payment_packet_line_id` for new links; line-item linkage is inferred from the packet.
  - Enforce that `iset_document.client_id` matches `payment_packet.client_id` on insert/update.
- Document typing:
  - Expand `document_type.scope` enum to include `case`, `action_plan`, and `payment_packet` (keep `client`, `application`).
  - Reclassify existing document types into the new scopes; define which scopes allow reuse vs per-application/per-plan constraints.
- Ownership rules:
  - Require `client_id` on all new `iset_document` records and validate it for all linking operations.
  - Allow `case_id`-only documents without application; when `action_plan_id` is set, keep `application_id` and `case_id` null and derive via the plan's case.

## Schema Draft (DDL outline)
1. Add action plan anchor on documents
   - `ALTER TABLE iset_document ADD COLUMN action_plan_id BIGINT UNSIGNED DEFAULT NULL AFTER case_id;`
   - Add index + FK to `iset_case_action_plan(id)` (ON DELETE SET NULL).
2. Multi-intervention linking
   - Create join table `iset_document_intervention`:
     - Columns: `document_id` (FK `iset_document`), `intervention_id` (FK `iset_case_intervention`), `created_at`.
     - PK: (`document_id`, `intervention_id`); index `intervention_id`.
3. Deprecate single-intervention column
   - Drop `linked_intervention_id` + FK/index after code updates (no data migration).
4. Expand document scopes
   - `ALTER TABLE document_type MODIFY scope ENUM('client','application','case','action_plan','payment_packet') NOT NULL DEFAULT 'application';`
   - Update existing `document_type.scope` values per mapping below (no backfill of documents).
5. Payments
   - Keep `payment_packet_document` as packet-level evidence; treat `payment_packet_line_id` as deprecated (no new writes).

## Implementation Plan (Phase 2)
1. Inventory + alignment
   - Audit current document linking in admin + intake services (documents, interventions, payments, secure messaging).
   - Map existing document types to the new scope model and confirm which are client- vs application- vs plan- vs payment-scoped.
2. Schema update (dev)
   - Add `iset_document.action_plan_id` and FK/index.
   - Create `iset_document_intervention` table; remove or deprecate `linked_intervention_id`.
   - Alter `document_type.scope` enum and update existing rows to new scope values.
   - Update `payment_packet_document` usage rules (line_id optional but unused).
3. Backend updates
   - Admin API: update document create/update endpoints to accept action plan + intervention arrays; write to join table.
   - Add validation: document/client consistency, action-plan consistency, and payment packet client match.
   - Update document fetch endpoints to join new tables and return action plan/intervention context.
4. UI + workflow alignment
   - Supporting Documents widget: show action plan + multi-intervention links; enforce target selection rules.
   - Payment evidence UI: attach at packet level only; infer line-item evidence from packet.
5. Validation + documentation
   - Confirm all document sources set `client_id`.
   - Update docs (`docs/data/documents-model.md`, payments docs, upload flow docs) + changelog entries.

## API + Code Touchpoints (Phase 2)
Admin API (`isetadminserver.js`)
- `/api/applicants/:id/documents` + `/api/applicants/:id/document-checklist`: return action_plan + intervention links; enforce client scoping.
- `/api/applicants/:id/documents/upload`: accept action plan + intervention links (array), enforce scope rules and client_id.
- `/api/documents/:id` PUT + `/api/documents/:id/duplicate`: update action plan + intervention links; stop using `linked_intervention_id`.
- `/api/document-types`: expose new scopes for UI logic.
- Secure messaging attachment adoption (`/api/admin/messages/:id/attachments`): populate `client_id` with case/application context.
- Payment evidence endpoints (packet evidence CRUD): validate `iset_document.client_id` matches `payment_packet.client_id`.

Portal (`ISET-intake/server.js`)
- `linkApplicationScopedDocuments`: use new scope model when backfilling application links (application scope only).
- Upload finalize + generated PDFs: ensure `client_id` is always set; avoid writing intervention links here.

UI (`SupportingDocumentsWidget.js`)
- Support action plan + multi-intervention linking; show action plan select + intervention multi-select.
- Hide application/intervention attach options for client-only docs; use scope to drive UI.

## Document Type Scope Mapping (proposed)
Client
- indigenous_declaration
- status_card
- identity_document
- letter_of_reference
- resume
- iset_client_info_release

Application
- application_form
- ei_consent
- ei_verification
- conflict_of_interest
- supporting_evidence
- client_acknowledgement
- release_student_info (inactive)
- media_consent
- financial_overview
- financial_records
- financial_evidence
- statement_of_account
- acceptance_letter
- band_funding_confirmation
- band_funding_denial
- medical_documentation
- assessment_approval_letter
- assessment_denial_letter

Case
- case_assessment

Action plan
- funding_agreement
- attendance_form
- wage_plan
- employer_duties_letter
- employer_offer_letter_after_subsidy
- equipment_quote
- institution_letter

Payment packet
- receipt
- voided_cheque
- alternate_payee_letter

## Scope (to confirm)
- ERM changes for supporting documents and association tables.
- Backend API and service updates needed to support the new relationships.
- Authorization and audit implications for document access.
- Frontend impacts tracked but not executed until a separate implementation step.
- Public portal file upload flow updates (client matching/creation before upload).
- First implementation focus is the intake upload flow; deeper ERM changes to follow.
- Intake submission PDFs and mini-intake form uploads must associate with the pinned `client_id`.

## Out of Scope (for now)
- Data migration or legacy compatibility work.
- Frontend implementation work before the plan is approved.

## Open Questions
- None.

## Decisions Log
- 2026-01-08: Pin the resolved `client_id` in input JSON state and reuse it for subsequent uploads and submit-generated PDFs.
- 2026-01-08: Client matching must extend to the Cognito fallback path for mini-intake workflows.
- 2026-01-08: Cognito `sub` is durable for ongoing matching, but SIN is the authoritative unique identifier when available (to handle new logins/email changes).
- 2026-01-08: After initial SIN-based match/creation, rely on Cognito `sub` for subsequent matching.
- 2026-01-08: `client.applicant_cognito_sub` will be `NULL`able and `UNIQUE`; when a new login (new `sub`) is matched by SIN, update the column to the new `sub` so future uploads resolve by Cognito only.
- 2026-01-08: Added `input_json_state.client_id` + `iset_document.client_id` + `client.applicant_cognito_sub` (dev) to support pre-upload client creation and document association.
- 2026-01-08: Supporting documents can link to multiple interventions, but only within a single action plan; non-client document links cannot be reused across action plans.
- 2026-01-08: Action plans created from approved applications may have documents linked to both the action plan/interventions and the originating application; standalone action plans link documents only to the action plan/interventions (plus client).
- 2026-01-08: Payment evidence documents can attach independently to payment packets/line items; reuse across packets is allowed, but documents must share the same `client_id` as the packet/line item.
- 2026-01-08: Payment evidence should attach at the payment packet level; line-item association is inferred because each line item belongs to one packet.
- 2026-01-08: Documents may link directly to a case without an application; no concrete scenarios identified yet.
- 2026-01-08: When documents link to child entities (interventions/line items), store the parent container explicitly (action plan/payment packet) and infer the child-parent relationship to avoid redundant parent storage.
- 2026-01-08: Application-linked documents are exclusive to a single application; reuse is handled via client-only or action-plan-linked documents instead.
- 2026-01-08: Aligned `client.applicant_cognito_sub` collation to `utf8mb4_0900_ai_ci` to match `user.cognito_sub` and avoid join collation errors.
- 2026-01-08: Decision letter sends now generate a PDF and store it as a supporting document (`assessment_approval_letter`/`assessment_denial_letter`) linked to the client + application.

## Risks / Considerations
- ERM changes will ripple through backend services and UI surfaces.
- Access control may need new rules for documents linked across multiple domains.

## Implementation Outline (Phase 1: Intake)
1. Resolve or create client before upload (primary path: `/api/uploads/presign`).
2. Pin `client_id` in input JSON state and reuse for subsequent uploads + generated PDFs.
3. Update document inserts (finalize + generated PDFs) to include `client_id`.
4. Set `iset_case.client_id` at intake completion using the pinned `client_id`.
5. Maintain match priority: pinned client → `applicant_cognito_sub` → SIN/DOB → emailNormalized → name/DOB → name-only.

## Next Actions
- Validate intake upload + mini-intake flows (presign, finalize, submit PDFs) to confirm `client_id` is set consistently.
- Review follow-on ERM changes once the intake flow is verified.
