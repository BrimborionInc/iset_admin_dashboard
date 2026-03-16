# Next Release Notes Working Log

Purpose: running capture of user-facing fixes/changes for the next "What's New" update on `src/pages/LandingPage.jsx`.

Current public release in Landing Page: `v0.5.4` (`12th March 2026`)
Target next release notes draft: `v0.5.5` (date TBD)
Last Updated: 2026-03-13

## How to use

- Add an entry whenever a user-visible bug fix, UX change, workflow change, or operationally meaningful behavior change is merged/implemented.
- Include enough context that a future thread can convert entries into polished "What's New", "Known Bugs", and "Coming Soon" sections.
- Keep entries concise and factual; avoid speculative language.

## Entry format

`YYYY-MM-DD | Release vX.Y.Z | Category | Area | Summary | Notes`

## Entries

- 2026-03-13 | Release v0.5.5 | UX/Integration | Job Bank Search dashboard | Reworked Job Bank Search into `Find a Job` and `Explore a Profession` tabs; the new profession tab uses PATH's 2021 NOC suggestions plus location input to open the matching Job Bank summary page in the lower embedded frame. | Includes a backend resolver that maps PATH profession/location inputs to Job Bank's own occupation/location identifiers instead of loading the intermediate Job Bank search form.
- 2026-03-12 | Release v0.5.4 | UX/Lettering | Application Assessment > Communication | Added approval letter-pack tabs: editable client letter plus admin-only institution and other funding source letters as read-only preview/download outputs. | Keeps portal delivery limited to the client letter while exposing non-client correspondence artifacts in-place for case managers.
- 2026-03-12 | Release v0.5.4 | Fix/Checklist | Application Assessment > Funding forms checklist | Fixed EFT checklist mismatch in approval-letter auto-send flow by using canonical `EFT_form` document type on generated signing requests. | Signed EFT forms sent via approval-letter flow now clear the EFT checklist item the same way as manual secure-message sends.
- 2026-03-12 | Release v0.5.4 | UX/Lettering | Application Assessment > Approval draft generation | Approval drafting now runs one privacy-safe AI copy-edit pass using placeholders, then injects case-specific values locally to keep deterministic outcomes and avoid sending applicant personal data to AI. | Funding amount lines and forms instruction remain deterministic/fixed in app logic.
- 2026-03-12 | Release v0.5.4 | Messaging/Workflow | Application Assessment > Send approval letter | Refactored approval send so required signing forms are attached to the same approval-letter secure message, instead of sending a separate auto-generated "signature required" message. | Backend now auto-appends funding-form workflows when an approval-letter attachment is sent and returns a config error if required workflows are missing.
- 2026-03-12 | Release v0.5.4 | Workflow/Automation | Secure Messaging + Docs Requested | Approval-letter sends now trigger docs-requested/reminder automation via the standard secure-message-with-signing-attachments path. | Keeps docs-request behavior aligned with manual toggle-equivalent form-request sends.
- 2026-03-11 | Release v0.5.4 | UX/Assessment | Application Assessment > What will it cost? | Updated cost-item presentation to follow the `Childcare Need` answer in the wizard, so `Childcare` lines are shown/hidden based on Yes/No selection. | Uses intake childcare-requested as fallback only when the wizard answer is not yet set.
- 2026-03-11 | Release v0.5.4 | Fix/Assessment | Application Assessment > Proposed Interventions (Step 2) | Fixed default intervention auto-add timing so Finance Settings `Auto-add?` entries are seeded after mapping fetch completes. | Prevents empty Step 2 when defaults exist but initial render raced ahead of mapping load.
- 2026-03-11 | Release v0.5.4 | Security/Messaging | Applicant Secure Messages | Fixed message-visibility leakage by enforcing sender/recipient ownership in applicant `/api/messages` reads and cleaning invalid mailbox rows; also blocked applicant access to other case IDs in `/api/cases/:id/messages`. | Prevents cross-applicant secure-message exposure when stale/invalid `message_item` rows exist.
- 2026-03-11 | Release v0.5.4 | UX/Help | Finance Settings > Payment type mapping | Added widget `Info` link + dedicated help-panel content and shortened the intervention default column label to `Auto-add?`. | Improves readability and discoverability of mapping rules in Finance Settings.
- 2026-03-11 | Release v0.5.4 | UX/Workflow | Application Assessment > Approved follow-up stage | Renamed final approved stage to `Funding forms and signatures` and updated submit action to `Mark application complete`, with explicit guidance to complete only after all required checklist items show Complete. | Updated assessment help and workspace help text to match.
- 2026-03-11 | Release v0.5.4 | Messaging/Workflow | Secure Messaging + Signing requests | Sending messages with signing-form attachments now sets docs-requested/reminders server-side (including auto-generated sends), and docs-requested now auto-clears when all pending non-letter signing requests are signed. | Aligns manual and automated form-request behavior.
- 2026-03-11 | Release v0.5.4 | Workflow/Automation | Application Assessment > Approval transition | Approved flows now include three signing attachments (`Client Funding Agreement`, `Client Acknowledgement of Funding Source`, `EFT & Wire Transfer Direct Debit`) as part of approval-letter communication. | Superseded implementation now attaches forms directly to the approval-letter message.
- 2026-03-11 | Release v0.5.4 | Intake/Docs | Application Workspace > Application Form + Intake submission | Added signed-form support for `Authorization for Release of ISET Client Information` so submission auto-generates/stores the PDF (`iset_client_info_release`) and Application Form now exposes the same form beside other consent/declaration signed forms with in-widget PDF download. | Uses published intake signature key `auth_froici_sing` and dedicated admin PDF endpoint.
- 2026-03-10 | Release v0.5.4 | UX/Data | Application Assessment + Case Workspace > Other Funding step | Refactored Other Funding into a structured flow with `involved?` state, repeatable non-NWAC funders, NWAC coverage summary, and optional notes. | Persists backward-compatible summary text while storing structured detail for future coordination/letter workflows.
- 2026-03-10 | Release v0.5.4 | UX | Application Workspace + Case Workspace > Proposed Intervention Cost Items | Cost-item add/edit modal now includes early payee capture fields (`payee type`, `payee name`, optional `reference`) without adding a new table column. | Payee remains optional at costing-step progression time.
- 2026-03-10 | Release v0.5.4 | Workflow/Validation | Batch Payments > Payment Packet Detail | Packet validation now blocks submission when payee details are missing and surfaces both top-level block messaging and line-level `Payee missing` indicators. | New validation code path emits line-addressable `payee_missing` policy errors.
- 2026-03-10 | Release v0.5.4 | API/Data | Intervention -> Payments Auto Seeding | Auto-generated payment lines now inherit payee values from proposal cost lines when provided (including optional payee reference), with existing fallback payee derivation retained. | Reduces re-entry of payee data at draft packet stage.
- 2026-03-09 | Release v0.5.4 | Ops/Storage | Demo Controls > Clear ISET test data | Clear-test now deletes linked object-store documents as part of reset flow, preventing new upload orphans after DB clear. | Endpoint now reports `objectKeySources` and `objectPurge` summary in response payload.
- 2026-03-09 | Release v0.5.4 | Safety/Ops | Demo Controls > Clear ISET test data | Added bucket safety guard to block clear-test object purge when `OBJECT_BUCKET` appears production-like (`prod`). | DB clear still runs; object purge is skipped with reason in summary.
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
