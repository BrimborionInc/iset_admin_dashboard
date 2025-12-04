# Changelog - Admin Dashboard

Format: YYYY-MM-DD - Category: Short description

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
