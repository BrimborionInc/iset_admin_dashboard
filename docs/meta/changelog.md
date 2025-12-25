# Changelog - Admin Dashboard

Format: YYYY-MM-DD - Category: Short description

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

## 2025-12-23
- Feature: Case workspace intervention assessment now supports submit-for-approval from the proposal wizard, and the interventions table surfaces submitted status with a status filter.
- Fix: Intervention proposals block new wizard creation when a draft/submitted proposal exists and allow read-only viewing for non-draft statuses.
- Feature: Regional Manager work queue now pulls intervention approval items/counts from the dashboard endpoint.
- Fix: Intervention approval queue now reads from the correct intervention columns in `iset_case_intervention`.
- Fix: Intervention approval queue items now open the case workspace instead of the application assessment view.
- UX: Proposed Intervention widget now uses the wizard for draft/submitted interventions and a read-only form for other statuses.
- Feature: Submitted intervention proposals remain in the wizard for RM/PA/SA review, with EI verification and decision steps captured in review metadata.
