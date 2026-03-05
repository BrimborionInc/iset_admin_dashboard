# Next Release Notes Working Log

Purpose: running capture of user-facing fixes/changes for the next "What's New" update on `src/pages/LandingPage.jsx`.

Current public release in Landing Page: `v0.5.3` (`3rd March 2026`)
Target next release notes draft: `v0.5.4` (date TBD)
Last Updated: 2026-03-05

## How to use

- Add an entry whenever a user-visible bug fix, UX change, workflow change, or operationally meaningful behavior change is merged/implemented.
- Include enough context that a future thread can convert entries into polished "What's New", "Known Bugs", and "Coming Soon" sections.
- Keep entries concise and factual; avoid speculative language.

## Entry format

`YYYY-MM-DD | Release vX.Y.Z | Category | Area | Summary | Notes`

## Entries

- 2026-03-05 | Release v0.5.4 | UX | Homepage > Work Queue Items | Conflict queue inline actions now hide inline `Resolve`; action label is `Reassign` when an owner exists and `Assign` when no owner exists. | Old resolve code path retained in code (not exposed inline).
- 2026-03-05 | Release v0.5.4 | Docs/UX | Homepage > Help Panel Content | Updated homepage dashboard/widget help content to match current role-based queues, inline actions, tagging behavior, metrics fields, and activity/dev-tracker behavior. | Files under `src/helpPanelContents/home*`.
- 2026-03-05 | Release v0.5.4 | UX | Application Workspace > Assessment Step 1 (EI Eligibility Check) | EI verification documents now display in-step for reassigned assessors, uploads add immediately to the current-doc list, and latest document is flagged as `Current`; copy/layout were simplified for clarity. | Includes immediate upload-on-select behavior and streamlined Step 1 wording/layout.
- 2026-03-05 | Release v0.5.4 | Validation/UX | Application Workspace > ISET Application Form | Edit mode now blocks invalid SIN values using 9-digit format + checksum validation, with inline error feedback. | Enforced in both frontend edit validation and `/api/applications/:id/versions` backend save validation.
- 2026-03-05 | Release v0.5.4 | UX | Application Workspace > Assessment Wizard | Step 1 retitled to `Assess Eligibility`; eligibility-admin-only controls are now clearer for coordinator users and assessment-lock messaging was simplified. | Updated Step 1 instructional copy and authorization hint text.
- 2026-03-05 | Release v0.5.4 | UX | Application Workspace > Assessment Wizard | Wizard `Cancel` now exits assessment edit mode (with confirmation) instead of showing a no-op discard flow. | Implemented through wizard API behavior wiring (no component hack).
- 2026-03-05 | Release v0.5.4 | UX | Application Workspace > ISET Application Form | Social Insurance Number now displays grouped as `XXX XXX XXX` in read-only views and edit input is constrained to numeric 9-digit entry. | Complements checksum validation and prevents invalid character/length entry.
- 2026-03-05 | Release v0.5.4 | UX/Data | Application Workspace > Version History | Version History modal was simplified (smaller size, tighter columns, inline-link actions) and `Saved by` now resolves staff identity from `staff_profiles` (`display_name`, fallback `email`). | Avoids showing raw Cognito-style IDs when profile data exists.
- 2026-03-05 | Release v0.5.4 | UX | Application Workspace > Version History | Replaced raw JSON `View` output with `View changes` diff display against the current version (`Field`, `Current`, `Selected`). | Improves readability for non-technical users.
- 2026-03-05 | Release v0.5.4 | UX | Application Workspace > Version History | Restoring a prior version now closes the Version History modal after a successful restore. | Keeps flow focused on returning to refreshed application state.
- 2026-03-05 | Release v0.5.4 | Fix/Storage | Secure Messaging > Message Details | Attachment links now open using presigned S3 download URLs, fixing `Cannot GET /uploads/...` failures in dev. | Message attachment API now returns `download_url` per attachment.
- 2026-03-05 | Release v0.5.4 | Ops/Storage | Document Delivery | Removed legacy local-static `/uploads` serving and remaining `local-direct` download branches; document/evidence download flows are now S3-only. | Includes supporting documents, assessment EI docs, finance evidence/document opens, and backend presign endpoints.
- 2026-03-05 | Release v0.5.4 | Workflow | Secure Messaging (Applicant Portal + Case Widgets) | Refactored secure messaging delete behavior to mailbox-item semantics so delete/purge actions affect only the current user’s folders, not other participants. | Implemented shared `message_item` ownership model in both admin and portal APIs; folder/read state now resolves per owner.
- 2026-03-05 | Release v0.5.4 | Fix | Secure Messaging (Portal reply -> Case Widget) | Applicant replies now inherit `case_id`/`application_id` from the replied message, so replies appear immediately in case-scoped secure messaging widgets. | Fixed in portal `POST /api/messages/reply-with-attachments`; hotfixed current test row in dev DB.
- 2026-03-05 | Release v0.5.4 | Fix | Assessment Cost Items (Coordinator + Case Workspace) | Recurrence policy lookup for cost lines now normalizes payment-type aliases (including wage-subsidy variants), so optional recurrence types correctly enable the installments toggle. | Prevents false `not_allowed` recurrence mode when stored cost-line/payment-type values use legacy/alias formats.

## Draft sections for Landing Page

### What's New (draft bullets)

- Homepage conflict queue workflow now emphasizes reassignment as the inline remediation path (`Reassign`/`Assign`) and removes inline conflict resolve.
- Homepage help guidance has been aligned with current queue operations and widget controls across Program Admin/Regional Manager/ISET Coordinator views.
- Assessment Step 1 now surfaces current EI verification documents directly in the wizard, marks the latest as current, and updates the list immediately when a new EI report is added.
- ISET Application Form edit mode now enforces SIN format + checksum validation before allowing save.
- Assessment wizard Step 1 was clarified as `Assess Eligibility` with role-appropriate guidance and cleaner eligibility-copy/denial-action layout.
- Assessment wizard `Cancel` now exits edit mode cleanly (with confirmation) instead of remaining on the same step.
- Version History now shows human-friendly `Changes Saved by` names and a `View changes` diff instead of raw JSON.
- Secure Messaging attachments now open via S3 presigned links (no local `/uploads` dependency).
- Legacy local-static `/uploads` delivery path has been retired in favor of S3-only document downloads.

### Known Bugs (draft bullets)

- None logged yet for `v0.5.4`.

### Coming Soon (draft bullets)

- TBD.
