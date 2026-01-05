# Changelog - Admin Dashboard

Format: YYYY-MM-DD - Category: Short description

## 2026-01-03
- Docs: Added Payments module user manual (`docs/guides/payments-module-user-manual.md`).

## 2026-01-04
- UX: Added Case Workspace quick action for managing payments (payments queue + detail above full-width interventions/action plans).
- UX: Program Payments widgets now live in the Case Workspace (case-scoped queue + packet detail).
- UX: Manage Payments quick action now focuses the first intervention with a draft/returned payment packet.
- UX: Payment packet creation in the Case Workspace now derives reporting unit, pot, and amount from the intervention and supports partial payments.
- UX: Service period fields now show only for living allowance and wage subsidy payment types in payment packet/line modals.
- API: Blocked payment initiation for draft/planned/submitted/in_review/changes_requested/cancelled interventions.
- Payments: Payment type options now filter by intervention code via runtime config and the API blocks mismatched types.
- UX: Refreshed payment packet detail summary layout for clearer grouping and readability.
- UX: Payment packet detail now starts with payment lines; summary cards removed.
- UX: Payment packet queue amount column now shows stream total badges; removed payment type column.
- UX: Add payment line modal now filters budget pots to the packet reporting unit region (retains existing pot on edit).
- UX: Add payment line modal now surfaces detailed validation errors from the server.
- UX: Payment line evidence column now distinguishes between no evidence required and missing baseline evidence.
- Fix: Supporting documents now auto-move from application to the auto-created intervention on approval.
- Fix: Evidence checklist items now keep their payment-document IDs so verification works in Finance view.
- UX: Draft payment packets can be deleted from the payment packet queue.
- Payments: Supporting documents now auto-attach to new payment packets/lines based on evidence rules.
- Payments: Initial interventions created on application approval now auto-generate draft payment packets.
- Feature: Assessment submissions now generate an application-form PDF alongside the assessment PDF (stored as `application_form` documents).
- Feature: Assessment submissions now generate a financial overview PDF alongside the assessment PDF (stored as `financial_overview` documents).
- UX: Case manager assessment PDF layout now matches the application and financial overview PDF styling.
- Fix: Case manager assessment PDF now includes intervention framing, childcare, and cost schedule fields captured in the assessment wizard.
- Payments: Simplified the workflow to Draft -> Submitted only; removed verification/approval/batching/mark-paid steps and locked packets after submission.
- Payments: Submission now emails finance from the status update and evidence gates use received evidence instead of verification.
- Docs: Updated payments requirements, user manual, and help copy to reflect the simplified workflow.

## 2026-01-24
- Payments: Auto-generate draft payment packets from approved interventions.
- Payments: Evidence verification required before approvals; verify/unverify controls added.
- Payments: Mark Paid now uploads proof-of-payment and enforces proof requirement.
- Payments: Added Annual Report ledger extract export from Payments queue.
- Payments: Override modal captures reason for evidence/duplicate/threshold gates.
- Payments: Added internal notes thread for program ↔ finance collaboration.

## 2025-12-31
- UX: Homepage work queue items table now supports flagging/unflagging and no longer shows the row-selection radio.
- UX: Homepage work queue items table now shows province codes instead of full names.
- UX: Homepage removed the legacy Application Work Queue, Case Work Queue, Conflict Declarations, and Program Admin Work Queue Items widgets.
- Fix: Watchlist applicant names now pull from intake payload fields so names render consistently.
- UX: Homepage now includes a Metrics widget with period-based totals for applications, decisions, active cases, and funding.
- API: Added `/api/dashboard/metrics` to serve periodized homepage metrics.
- UX: Updated Program Admin work queue bucket descriptions for conflicts, eligibility, escalations, and approvals.
- UX: Homepage watchlist now refreshes automatically when queue items are flagged or unflagged.
- Docs: Updated NWAC ISET homepage help panel copy to reflect the current widget set.
- UX: Added info links and placeholder help panels for NWAC ISET homepage widgets.

## 2025-12-26
- UX: Application assessment cost step now supports recurring cost scheduling (period, amount, occurrences) tied to the total cost input.
- Fix: Case detail payload now includes case context so assessment delivery mode persists after save/refresh.
- UX: Removed the intervention duration input from the application assessment cost step.
- UX: Reduced redundant section headings inside the application assessment wizard steps.
- UX: Moved budget pot selection into the approval/decision step for application assessments.
- UX: Application assessment checklist step now supports checklist-driven uploads, matching the proposed intervention workflow.
- UX: Application assessment wizard now blocks advancement past the checklist step until required items are complete for draft assessments.
- UX: Approval/decision step now reveals budget pot fields only when approved with a non-zero cost and clears them otherwise.
- UX: Application assessment quick actions now include layout presets for review, documents/messages, and notes/calendar views.
- UX: Application assessment quick actions now include a View audit trail layout preset.
- UX: Application overview key/value layout now supports up to six columns.
- UX: Application overview now shows province/territory, document checklist completeness, and lock owner/expiry.

## 2026-01-20
- Feature: Configuration Settings now includes a Document Checklists widget to edit required documents per status gate for applications and interventions.
- API: Checklist configuration can be persisted to runtime config for both application and intervention scopes.

## 2025-01-05
- Authoring: Default Value fields now accept `{data_key}` placeholders to prefill from another field in the same workflow.

## 2025-11-24
- Feature: Manage ISET Applications dashboard now includes the Application Work Queue summary widget alongside the ISET Applications table; help content updated.

## 2025-10-22
- Docs: Normalized the admin library layout (meta/, components/, features/, ops/), renamed file-upload conditional notes, and introduced a docs README for quick orientation.

## 2025-09-25
- Fix: Admin secure messages now persist case/application IDs so applicant booking references render consistently.
- Feature: Portal message view surfaces the booking reference for case-linked threads.
- Docs: Added secure messaging notes and refreshed widget catalog to reflect case-scoped behaviour.
## 2025-09-22
- Feature: Access Control matrix widget now supports in-place role toggles with instant persistence.
- UX: Navigation and route guards consume the shared RBAC matrix and hide empty sections per role.
- Docs: Refreshed RBAC notes to reflect self-service configuration flow.

## 2025-09-21
- Feature: Restored Secure Messaging widget with inbox/sent/deleted tabs, Cloudscape tables, modal compose, and attachment adoption triggers.
- Feature: Supporting Documents widget gains refresh button, auto-refresh event listener, simplified columns.
- Fix: Attachment adoption back-fills applicant/application/user metadata when re-opened.
- Docs: Updated widget catalog and documents model notes.

## 2025-09-18
- Feature: AI settings widget now persists to shared DB (`iset_runtime_config`) so the public portal respects admin-chosen model/params/fallbacks.
- Fix: Corrected SQL for fallbacks upsert (JSON array via CAST) and idempotent table creation.
- Docs: Added `ai-runtime-config.md` and updated project map notes (cross-app config flow).

## 2025-12-03
- Admin application form: collapsed intake registration number variants (sfn/nsfn/metis/inuit) into a single Registration number field and ignore the UI-only key in diffs so saving updates the correct stored key.
- Case workspace: Participant Details now reads/writes registration number across all variant keys, collapsing to a single value post-intake.

## 2025-12-04
- Docs: Added auto-assignment notes (config in admin, execution in portal ingest) and clarified province sourcing from submission payload.

## 2025-12-31
- UX: User Management dashboard now shows region codes (not numeric IDs) and uses a region code selector when inviting admin users.
- UX: Administrative Users table renders as embedded content within its tab panel.
- API: `/api/regions/canada` now includes `regionId` alongside code/name for region lookups.
- Auth: Mapped new Cognito group names (System_Administrator, NWAC_Administrator, Regional_Manager, ISET_Coordinator) to canonical admin roles.
- Ops: Updated local admin `.env` to the new Cognito user pool, client, and Hosted UI domain.

## 2025-12-23
- Feature: Case workspace intervention assessment now supports submit-for-approval from the proposal wizard, and the interventions table surfaces submitted status with a status filter.
- Fix: Intervention proposals block new wizard creation when a draft/submitted proposal exists and allow read-only viewing for non-draft statuses.
- Feature: Regional Manager work queue now pulls intervention approval items/counts from the dashboard endpoint.
- Fix: Intervention approval queue now reads from the correct intervention columns in `iset_case_intervention`.
- Fix: Intervention approval queue items now open the case workspace instead of the application assessment view.
- UX: Proposed Intervention widget now uses the wizard for draft/submitted interventions and a read-only form for other statuses.
- Feature: Submitted intervention proposals remain in the wizard for RM/PA/SA review, with EI verification and decision steps captured in review metadata.
