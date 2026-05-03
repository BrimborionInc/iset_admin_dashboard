# Changelog - Admin Dashboard

Format: YYYY-MM-DD - Category: Short description

## 2026-05-03
- UX/Casework/DEV: Added a Case Management-style header selector to the Manage ISET Applications table so staff can filter the server-paginated application list by active, new, assessment, pending-decision, decision-recorded, approved, denied, closed, flagged, or all applications.
- UX/Homepage/DEV: Cleaned up Work Queue inline row actions so item names are the workspace link, redundant `Open workspace` actions are removed, the `Actions` column hides when no secondary row actions exist, rows expose at most two inline actions, and assignable rows use owner-aware `Assign` / `Reassign` labels.

## 2026-05-02
- UX/API/Auth/DEV: Administrative Users profile details now return and edit DB-backed staff `name` and `display_name` values from the selected user Profile tab, using a guarded profile-update endpoint instead of Cognito custom attributes.
- Notifications/DEV: Split secure-message notification events by direction. Public-portal applicant-to-staff messages now emit `applicant_secure_message_received`, while admin case-workspace staff-to-applicant messages emit `staff_secure_message_sent`; DEV notification settings were moved so staff templates fire only for inbound applicant messages and applicant templates fire only for outbound staff messages.
- Notifications/DEV: Made inbound `Applicant secure message received` bell/email delivery owner-scoped. The assigned owner receives the alert through their actual staff-role row, case watchers receive it through the `ISET Coordinator` row, and broad admin role rows no longer broadcast applicant secure-message alerts to every user in that role.
- Notifications/DEV: Added the `New secure message from applicant` notification template for staff-facing applicant secure-message alerts, with copy that identifies the applicant, received timestamp, tracking ID, and PATH link without including message subject or body content.
- UX/Notifications/DEV: Added explicit event timestamp placeholders (`{event_datetime}` and `{message_received_at}`) to the staff notification renderer context and Template Editor field catalog so secure-message staff emails can show when the message was received.
- UX/Auth/Public portal: Updated the registration collision message for existing confirmed applicant accounts so users are told an NWAC case manager may have already set up the account and can use **Reset or set password** to activate access.
- Ops/TEST/Public portal: Deployed portal-only hotfix `20260502-portal-register-collision-copy-test` after a scoped Test and Training portal maintenance warning; both TEST portal targets reported healthy.
- Ops/PROD/Public portal: Deployed portal-only hotfix `20260502-portal-register-collision-copy-prod` after a scoped portal maintenance warning; ASG refresh `b7c78445-359f-4dc5-8d67-00afd0fb3a30` completed and public portal health smoke returned `200` for `https://iset.nwac.ca/healthz` and `https://nwac-public.awentech.ca/healthz`.
- Ops/TEST/Release: Deployed full release `20260502-001919` to the Test and Training environment after a 5-minute admin + portal maintenance warning; schema had 0 pending migrations, `intake-release` workflow/data promotion applied for workflow `21`, admin and portal artifacts deployed from commit `d299e7f0`, both TEST target groups reported healthy, and the maintenance warning was cleared.
- Ops/PROD/Release: Deployed full release `20260502-003615` to PROD after a 5-minute admin + portal maintenance warning; captured restore point `path-prod-20260502-003615-20260502003633`, schema had 0 pending migrations, `intake-release` workflow/data promotion applied for workflow `21`, shared/admin/portal artifacts deployed, ASG refresh `93cc3a8c-6a4c-4df5-8ac7-11b1ab1d9bce` completed, admin and portal health smoke returned `200`, and the maintenance warning was cleared.

## 2026-05-01
- Fix/Application workflow/DEV: Hardened case-to-application selection so active/in-review applications win over closed/completed historical applications, even when old rows receive later client-file updates; case saves now refuse to move terminal applications back into review or document-request queues while still allowing the approved-to-completed finish step.
- Ops/TEST/Release: Replaced the earlier landing-page-only TEST rollout with full release `20260501-dev-sync-test`; schema had 0 pending migrations, `intake-release` workflow/data promotion applied for workflow `21`, admin and portal apps deployed from the current DEV heads, both TEST target groups are healthy, the maintenance notice was cleared, and on-instance verification confirmed the new admin/portal bundles plus the Template Editor refactor strings in the deployed admin bundle.
- Notifications/DEV: Added generic staff SES delivery for non-assignment notification events. Enabled `notification_setting` staff rows with `email_alert=1` and an assigned template now resolve role/case/watch recipients, render through `notification_template`, and send once per deduped staff recipient; assignment-family emails keep their existing assignee/watcher path.
- Notifications/DEV: Hardened duplicate notification settings by ordering dispatcher and renderer lookups toward enabled email rows with assigned templates, so stale duplicate rows do not suppress active configuration or create duplicate sends.
- Notifications/DEV: Split NWAC review notification routing into outcome-specific event keys for approved, denied, and changes-requested reviews so the Manage Notifications matrix can configure each outcome separately.
- Ops/Safety: Added a SES runtime guard that suppresses notification emails when the app is running against TEST environment markers or the TEST DB host, preserving the Test and Training environment blocker while allowing DEV SES sends.
- UX/Notifications/DEV: Overhauled the Template Editor dashboard with a grouped notification field catalog, subject-safe field insertion, scenario-based subject/body preview, unknown-field warnings, scenario-fit guidance, and updated help-panel copy for authoring staff and applicant notification templates.

## 2026-04-30
- Ops/PROD/Release: Deployed admin-only release `20260430-admin-whatsnew-prod` to PROD after a 10-minute admin + public portal runtime maintenance countdown; schema/data/shared/portal deploy steps and DB restore point were skipped, ASG refresh `0ac8bc30-2a15-494a-86d1-84cedaa9c6cb` completed, admin and portal health smoke returned `200`, the runtime maintenance warning was cleared, and ALB fallback routing stayed on normal forwarding.
- Ops/TEST/Data: Refreshed TEST from a sanitized current PROD database dump for application/case experimentation, preserving TEST Cognito pools, rebinding `bill@sillery.co.uk` and `program.admin@awentech.ca` through the TEST identity overlay, leaving PROD supporting-document S3 objects uncopied, and clearing maintenance after both TEST admin and portal target groups were healthy.
- Ops/Tooling: Tightened the TEST DB restore helper's `DEFINER=` stripping command so future restores do not emit misleading local shell warnings while building the remote restore command.
- Fix/Auth: Stopped admin staff authentication from hydrating staff scope or identity from legacy Cognito `region_id`, `custom:region_id`, `user_id`, or `custom:user_id` claims; staff region access now stays DB-backed through `staff_profiles` / `staff_region` and missing assignments require explicit data/user-management repair.
- Ops/Auth: Added a dry-run-first staff Cognito legacy attribute cleanup helper and guide for auditing or clearing per-user `custom:region_id` / `custom:user_id` values after DB-backed assignments are verified.
- Ops/DEV/Auth: Cleared remaining per-user `custom:region_id` values from the DEV staff Cognito pool after code stopped relying on those legacy custom claims; TEST and PROD Cognito attributes were not changed.
- Docs/Ops: Strengthened TEST deployment guidance so TEST rehearses PROD maintenance behavior: planned TEST deploys that can interrupt service or expose raw `502 Bad Gateway` responses must use a scoped maintenance warning or ALB maintenance page.
- Docs/Ops: Added a TEST maintenance-copy rule requiring warnings to use the user-facing name `Test and Training environment` and explicitly state that Production is not affected.
- Ops/Tooling: Updated `path:maintenance` so operator-supplied `--title` / `--message` copy is written into the service-announcement payload and unknown options fail loudly instead of being ignored.
- Ops/Tooling: Fixed `path:deploy:smoke` output for TEST target-group health checks so it prints each target and health state instead of `undefined undefined`.
- Ops/TEST/Auth: Deployed admin-only release `20260430-auth-region-db-test` to the Test and Training environment with no schema/data/portal changes and no Cognito attribute cleanup; rollout used an admin-scoped maintenance warning plus ALB maintenance page, then cleared both after target health and on-instance `/healthz` checks passed.
- Ops/TEST/Release notes: Deployed admin-only release `20260430-admin-whatsnew-test` to the Test and Training environment with no schema/data/portal/shared changes; the landing-page What's New list now contains only the requested New Applications queue, Bugs and Change Requests dashboard, generated assessment PDF repair, and Regional Manager All documents load-error bullets.
- Ops/Data: Repaired Sarah Froese's PROD intervention-proposal assessment documents by backfilling `Case manager assessment v2` and `Case manager assessment redline v2` for case `40` / proposal `2` / intervention `11` after a TEST rehearsal, preserving Amanda Curtis's original `2026-04-17 12:20:49 UTC` submission signature.
- UX/Homepage/DEV: New Applications queue rows now use the applicant name as the workspace link, hide the redundant inline `Open workspace` action, and show `Assign` or `Reassign` based on whether the file already has an owner.
- UX/Support/DEV: Added a dedicated `Support > Bugs and Change Requests` dashboard that reuses the existing feedback triage widget and defaults access to System Administrators, NWAC Administrators, and Regional Managers.

## 2026-04-29
- Docs/Meta: Added a root `AGENTS.md` entry point, refreshed the project-memory standing directive, linked the current documentation audit from `docs/AGENTS.md`, and recorded the first-pass docs inventory and cleanup queue in `docs/meta/documentation-audit-2026-04-29.md`.
- Docs/Meta: Replaced the stale Create React App root README and refreshed verified parts of the project map, including homepage structure, signature-ack macro infrastructure, cross-cutting session-state wording, and the legacy development-tracker caveat.
- Docs/Meta: Superseded the older `docs/meta/codex-crib-sheet.md` quick-start so future searches redirect to the maintained entry path instead of stale onboarding notes.
- Docs/Meta: Marked `docs/meta/level0-document-checklist.md` as historical and pointed future document-model work to the current unified documents model and canonical document-type review.
- Docs/Meta: Added `docs/planning/README.md` and `docs/change-requests/README.md` as directory gates for mixed current/historical planning and CR source material.
- Docs/Meta: Added `docs/data/README.md`, `docs/requirements/README.md`, and `docs/training/README.md` as directory gates for generated dumps, source artifacts, reference standards, and training material.
- Docs/Meta: Added `docs/ops/README.md` and `docs/guides/README.md` as directory gates for operational runbooks and how-to guides, requiring command/path verification before acting.
- Docs/Meta: Added `docs/README.md` plus README gates for the remaining top-level docs directories, including `docs/meta`, so every major docs area now advertises its status and verification requirements.
- Docs/Data/Security: Corrected stale document-model, public-portal security, and application-assessment dashboard notes that referenced future document scoping, missing env/auth docs, or retired `iset_case.application_id` behavior as current.
- Docs/Meta: Corrected stale local and cross-repo documentation references in database docs, public-portal security, file uploads, intake authoring, AWS TEST environment, and input-JSON CR notes; marked the nForm extraction plan and scope note as historical/planned so missing phase deliverables are not mistaken for lost files.
- Docs/Components: Updated the `signature-ack` component pattern and file-upload conditional-rules plan so their status matches the implemented source anchors and remaining grouped-logic/null-semantics work.
- Docs/Meta: Cleaned up additional broken doc references found by a broader scan, including intake-authoring runtime links, finance CR paths, ESDC gap-analysis evidence paths, a PROD Terraform runbook link, and an older runtime-config changelog path.
- Docs/Tooling: Added `scripts/check-doc-links.py`, a read-only local Markdown reference checker for the docs tree, and documented it in the project-memory maintenance guidance.
- Docs/Ops: Moved DB/TEST/PROD/AWS profile command detail from `docs/AGENTS.md` into `docs/ops/agent-operational-access.md` so the agent entry point stays shorter while preserving operational access notes.
- Docs/Data: Added a README gate to `docs/data/temp/` to classify tracked binary source artifacts and defer any keep/archive/delete decision to a focused cleanup.
- Docs/Meta: Added `docs/meta/documentation-cleanup-plan-2026-04-29.md` as the active progress tracker for the broader docbase cleanup effort, including completion criteria and the next work queue.
- Docs/Meta: Expanded the documentation cleanup plan scope to include the sibling public portal docbase at `../ISET-intake/docs` as part of the same cross-app Codex memory base.
- Docs/Meta: Extended `scripts/check-doc-links.py` to scan both admin and public-portal docbases, added README gates across `../ISET-intake/docs`, and recorded the portal first-pass inventory in the cleanup plan.
- Docs/Meta: Compacted `docs/AGENTS.md` by replacing duplicated subsystem status blocks with canonical dashboard, feature, data, and ops doc pointers.
- Docs/Ops: Added `Status` and `Last reviewed` metadata to every admin and portal ops Markdown doc, checked documented deploy/data/migration command names against current package scripts, and marked historical TEST/prod environment notes so they are not mistaken for live runbooks.
- Docs/Security: Redacted literal DB password values from historical docs and strengthened the standing directive so future doc cleanup redacts credentials/tokens/secrets instead of preserving them.
- Docs/Meta: Added `docs/meta/planning-cr-archive-triage-2026-04-29.md` as the first-pass classification index for planning docs, change requests, DOCX source artifacts, and portal archive docs, with initial delete/archive candidates recorded but not deleted.
- Docs/Data: Added `docs/meta/data-artifact-retention-2026-04-29.md` and `docs/data/DB-Structure-Dump/README.md` to classify generated schema dumps and tracked temp binaries as generated/source artifacts, not maintained agent guidance; the dump directory ignore rule now permits the README gate while keeping dump files ignored.
- Docs/Meta: Added `docs/meta/meta-log-retention-2026-04-29.md` to define search, update, retention, and future split rules for large admin and portal meta logs.
- Docs/Planning: Replaced superseded Query Editor, document-model ERM, and public-intake renderer planning notes with redirect stubs pointing to current docs/source; the public-intake renderer stub also removes the old file's invalid text encoding.
- Docs/Meta: Marked the 2026-04-29 cross-app documentation cleanup pass complete in `docs/meta/documentation-cleanup-plan-2026-04-29.md`, with remaining work framed as ongoing maintenance rather than unfinished cleanup blockers.
- Docs/Meta: Indexed this cleanup/context-persistence thread in `docs/meta/codex-thread-index.md` under the exact Task History title `Clarify thread context persistence`.

## 2026-04-28
- Fix/Application workspace: Stabilized the application workspace Secure Messaging widget so global maintenance-announcement countdown renders do not retrigger message reloads every second.
- Ops/TEST rehearsal: Completed the second PROD-like privacy ERM rehearsal in TEST, including duplicate-case consolidation. Measured app-stop-to-healthy-targets downtime was about 38m41s; canonical migrations took 10m37s and app build/deploy took 12m29s.
- Ops/SQL: Made the message-item cleanup preview/apply SQL schema-adaptive so it works before canonical migrations with legacy `messages.sender_id` / `recipient_id` and after migrations with typed `sender_user_id` / `recipient_user_id`.
- Ops/Data rehearsal: Added duplicate-case consolidation preview/apply SQL for the one-client/one-case model after the PROD-like TEST privacy ERM rehearsal exposed four duplicate client case groups. The rollback-only TEST validation reported four merge pairs, zero blockers, and zero remaining duplicate groups or dangling case references after the scripted consolidation.

## 2026-04-27
- Fix/Portal/DEV: Pre-submission public-portal document finalization now records uploads in `iset_application_file` plus intake `doc_refs` until application/case scope exists, then materializes them into `iset_document` during intake completion so `chk_iset_document_application_submission_scope` stays strict.
- Fix/Portal/DEV: Public-portal intake-state saves now persist "no client linked yet" as `NULL` instead of `0` for `input_json_state.client_id`, preserving the hardened FK while allowing early applicant workflow saves before client creation.
- Ops/DEV: Removed the synthetic privacy-denial live-smoke fixture graph and ignored local `tmp/privacy-denial-*.env` files after verification, leaving the live denial harness ready for fresh-token reseeding when needed.
- Security/API/DEV: Fixed payment-packet case-scope evaluation so rows using the legacy `assigned_to_user_id` compatibility alias are still treated as assigned staff-profile rows; seeded live denial checks now reject out-of-region Regional Manager payment packet reads/PDFs.
- Dev tooling/Security: Added `npm run seed:privacy-denials`, an idempotent DEV-only fixture seeder for the real-token privacy route-denial smoke harness.
- Ops/Security: Updated message-item cleanup preview/apply SQL to use typed message participant columns after physical retirement of `messages.sender_id` / `recipient_id`; applied the guarded DEV cleanup for 11 stale mailbox rows.
- Data/Schema/DEV: Hardened internal notification identity by adding typed staff-profile/applicant-user audience and dismissal viewer columns with FKs and CHECK constraints, initially keeping legacy `audience_user_id` / dismissal `user_id` as compatibility shadows.
- Data/Schema/DEV: Constrained `pending_uploads.user_id` to shared `user(id)` and `application_lock.application_id` to `iset_application(id)`, while documenting lock owner, event receipt, and session audit IDs as opaque actor identifiers rather than shared-user FKs.
- Security/Dev tooling: Extended the privacy ERM audit with notification audience/viewer counts, pending-upload ownership counts, and an opaque actor identifier inventory.
- Data/Schema/DEV: Added a staff-profile FK to legacy `iset_case.assigned_to_user_id`, keeping it aligned as a compatibility shadow of `assigned_staff_profile_id` before physical retirement.
- Security/Dev tooling: Classified user-like audit rows as legacy staff-profile shadows, typed notification shadows, opaque principals, or retired legacy identities so the remaining inventory is less misleading.
- Data/Schema/DEV: Retired the confirmed-empty `jordan_application` and `jordan_application_draft` experiment tables through a fail-closed migration that records zero-row retirement counts and refuses non-empty TEST/PROD drops.
- Data/Schema/DEV: Retired five broken appointment/queue stored procedures after confirming their backing tables are absent and no live code `CALL` sites remain.
- Data/Schema/DEV: Added and hardened typed staff-profile/applicant-user actor references on `iset_event_entry`, backfilled deterministic legacy event actors, and updated shared event writes/reads to avoid raw `actor_id` authorization assumptions.
- Data/Schema/DEV: Added typed staff-profile/local-user author references to `iset_application_version`, updated version writes/responses to carry explicit author IDs, and retired the free-form `created_by_id` shadow in DEV.
- Data/Schema/DEV: Hardened application submission/version lineage and CFA case/version/document/participant relationships with FKs plus audit coverage for CFA document case/client mismatches.
- Data/Schema/DEV: Preserved and deleted 40 orphan client-account event rows, then hardened remaining deterministic relationship FKs for client account events, input-state clients, assessment budget pots, reminder action plans, and staff-profile regions through migration `20260427_0018`.
- Data/Schema/DEV: Retired the empty `zzz_legacy_documents` experiment table through a fail-closed migration and classified the remaining no-FK ID-like columns as runtime keys, external references, audit principals, upload tokens, tutorial keys, or lookup keys.
- Dev tooling/Security: Added `npm run smoke:privacy-erm`, a read-only smoke checker for the cleaned privacy ERM model covering retired tables/columns, required FKs/CHECK constraints, message/document/application/client-account invariants, and informational workflow string-key rows.
- Security/API/DEV: Hardened finance allocation evidence upload/delete/presign routes so raw object keys require finance-role access plus allocation/pot metadata provenance or current-user pending-upload ownership.
- Dev tooling/Security: Added `npm run smoke:privacy-routes`, a static route-scope guard tripwire for high-risk document, message, signing, event, and finance evidence routes.
- Data/Schema/DEV: Added typed staff-profile/applicant-user viewer references plus a single-viewer CHECK to `iset_event_receipt`, and updated event feed/read-state paths so legacy `recipient_id` is only a compatibility shadow.
- Fix/API/Documents/DEV: Manual supporting-document uploads now preserve or resolve the real `case_id` for application, action-plan, and client-scoped inserts, keeping the hardened `chk_iset_document_manual_upload_scope` privacy guard intact.
- Data/Schema/Documents/DEV: Backfilled the remaining application-linked system-generated document with applicant scope, tightened `chk_iset_document_system_generated_scope`, and kept global payment batch exports out of `iset_document`.
- Security/Messaging/DEV: Secure-message admin and portal responses now expose canonical typed actor/thread objects, the main admin widgets no longer fall back to raw `sender_id` / `recipient_id` for applicant direction, and secure-message events include typed actor payload fields.
- Security/Dev tooling: Added a legacy compatibility-shadow retirement inventory to the privacy ERM audit and documented physical retirement gates for message participant, assignment, notification, event receipt, application-version, and case/application shadow fields.
- Data/Schema/Messaging/DEV: Physically retired `messages.sender_id` and `messages.recipient_id` after removing secure-message runtime reads/writes and recording aggregate 0-drift counts in a retirement audit table.
- Data/Schema/Assignment/DEV: Physically retired `iset_case.assigned_to_user_id` after removing runtime reads/writes and recording aggregate 0-drift counts in a retirement audit table.
- Data/Schema/Notifications/DEV: Physically retired `iset_internal_notification.audience_user_id` and `iset_internal_notification_dismissal.user_id` after removing runtime reads/writes and recording aggregate 0-drift counts in a retirement audit table.
- Data/Schema/Events/DEV: Physically retired `iset_event_receipt.recipient_id` after moving read-state joins/writes to typed viewer keys, adding typed viewer unique keys, and recording aggregate 0-drift counts in a retirement audit table.
- Security/API/DEV: Limited Query Editor server export to the active environment PATH database and added route-smoke guards so visible non-PATH schemas cannot be selected for dump export.
- Security/API/DEV: Generated consent, authorization-release, client-acknowledgement, Indigenous-declaration, and conflict-declaration PDFs now validate application visibility before rendering from a request body `applicationId`.
- Docs/Ops: Added the privacy ERM grand cleanup rehearsal runbook covering DEV gates, TEST rehearsal order, PROD preflight, stop conditions, rollback expectations, and the no-constraint-weakening rule.

## 2026-04-26
- Docs/Security: Added the privacy ERM cleanup grand-release plan, setting the DEV-first strategy for fixing secure-message identity-domain confusion, case/application/client scope, document/message attachment relationships, stale backend experiments, and the eventual rehearsed PROD data migration.
- Security/Dev tooling: Added a read-only privacy ERM audit script and first DEV report covering ID-domain confusion, unconstrained message/document relationships, stale `message_item` rows, dead experiment tables/routes, and old stored procedures.
- Security/Messaging: Stopped admin case secure-message reads from seeding nonparticipant `message_item` rows for staff case viewers, and blocked admin mailbox-state mutations for users who are not the message sender or recipient.
- Data/DEV cleanup: Added preview/apply SQL for unsafe `message_item` rows and applied it in DEV, preserving 38 deleted rows in `privacy_erm_message_item_cleanup_audit` and leaving only sender/recipient mailbox rows.
- Security/Portal: Public-portal secure-message attachments now persist `message_attachment.case_id` at insert time, reducing later case-scope inference during admin attachment adoption.
- Security/API cleanup: Retired obsolete admin GOV.UK component routes, old case-based application-version routes, and the direct application-answer patch route so they return `410` instead of running missing-table or mismatched-column legacy SQL.
- Data/DEV cleanup: Added preview/apply SQL for document scope and applied it in DEV, preserving old/new values while backfilling missing document client/case/application scope and clearing invalid document `user_id` values.
- Data/Schema/DEV: Added `iset_case.assigned_staff_profile_id` with an FK to `staff_profiles(id)`, backfilled it from valid legacy assignments, normalized invalid legacy assignment values to unassigned, and updated admin/portal assignment writes plus the privacy audit to track drift during cutover.
- Security/Case access: Cut high-risk admin/shared case-assignment reads over to explicit staff-profile semantics, including case-access helpers, RBAC predicates, coordinator/regional filters, staff joins, reporting filters, and owner-resolution comparisons.
- Data/Schema/DEV: Added typed secure-message actor-domain columns with FKs to `user(id)` and `staff_profiles(id)`, backfilled existing DEV messages, and updated admin/portal message writes plus the privacy audit to track actor-domain gaps.
- Data/Schema/DEV: Hardened secure-message attachment scope with `client_id`, corrected `application_id` typing, FKs to message/case/application/client/user, public-portal client-scope writes, and admin adoption mismatch checks.
- Data/Schema/DEV: Added referential constraints for legacy secure-message sender/recipient, message case/application scope, and `message_item` message/owner rows after DEV cleanup proved those relationships clean.
- Security/Messaging: Cut public-portal applicant secure-message reads and reply targeting over to typed actor plus case/application scope, and moved admin mailbox-state authority from legacy sender/recipient IDs to typed sender/recipient user fields.
- Data/Schema/DEV: Hardened `iset_document` scope references by normalizing document user/message ID column types and adding FKs for user, applicant user, case, application, and origin message relationships.
- Security/API cleanup: Retired the unscoped `POST /api/applications/ingest-from-submission` admin endpoint so applications are no longer created without client/case scope through that legacy path.
- Security/Messaging: Updated admin secure-message widgets and the public-portal reply composer so message direction and reply targeting no longer depend on legacy `sender_id` / `recipient_id` response fields when typed actor data is available.

## 2026-04-25
- Docs/Security: Added the public-portal legacy fallback security review, documenting remaining high-risk applicant-portal identity/linking fallbacks after the secure-message breach and the recommended next hardening pass.
- Security/Portal: Hardened the current deployed public portal repo (`../ISET-intake`) against legacy identity fallback risks: Cognito/local-user linking no longer returns already-bound email matches, applicant data routes require the primary applicant portal Cognito client and reject staff/admin roles, client linking no longer claims existing clients by SIN/email/name fallback or overwrites another subject, staff message recipients no longer resolve by arbitrary email fallback, and legacy `POST /api/applications` now returns `410`.
- Ops/Portal: Deployed the portal hardening to TEST, then followed up with release `portal-security-hardening-message-20260425-test` so staff/admin or wrong-client public-portal sign-ins show an explicit applicant-account-required message instead of a generic workflow-schema load error.
- Fix/Portal: TEST validation with `jack@sillery.co.uk` showed a false applicant-account-required block where the token role was `Applicant` but the client match failed. Portal auth now prefers the HttpOnly portal access cookie over any bearer header, preventing stale bearer tokens from shadowing the applicant portal session.

## 2026-04-23
- Fix/Application Assessment: Step 13/14 in the application workspace now trusts the canonical recorded application decision before the older assurance-only fallback, so denied files cannot reopen the approval branch just because `assessment_nwac_review` still says `agree`.
- Ops/Data repair: Applied a guarded one-off PROD correction for `ISET-20260409-123477`, forcing the persisted assessment review fallback onto the denied path and bumping the application row version so step 13 / step 14 in the application workspace hydrate consistently as a denial.
- Ops/Maintenance: Shortened the default ALB fallback maintenance-page body copy to `PATH is temporarily unavailable while maintenance is in progress.` so incident holds do not imply an immediate reopen.
- UX/Homepage: Reworked the NWAC Administrator and Regional Manager Work Queue into a clearer application pipeline with `New Applications`, `In Assessment`, `Pending Decision`, and `Pending Completion`, while keeping all decision-stage application and intervention work combined in the final decision queue.
- UX/Homepage: Removed the redundant NWAC Administrator `All Applications` queue card now that the homepage application pipeline is represented directly by the four stage buckets.
- UX/Homepage: Narrowed `Pending Assessment` to submitted assigned files still waiting for EI verification, and expanded `New Applications` to also include EI-verified submitted files that have not yet entered active assessment.
- UX/Homepage: NWAC Administrators no longer see the narrower EI-pending queue separately; those files are folded into `New Applications`, while Regional Managers keep the same stage under the shorter label `EI Check Needed`.
- UX/Homepage: Added `Pending Completion` across the role homepages as the post-decision application stage for files that still need letters, funding-form/signature follow-through, or other closeout work before the application workflow is complete, and aligned the coordinator's former funding-agreement queue to the same concept.

## 2026-04-22
- Docs/Ops: Clarified the standing deploy-intent rule in `docs/AGENTS.md`: when Bill asks to deploy to TEST or PROD, Codex should assume the full current awaiting-release checkout state, including relevant code/config/runtime/schema promotion work, unless he explicitly narrows the release. Data resets or one-off live data mutation still require explicit intent.
- UX/Finance/Email: Finance payment-packet emails now use a lean AP-style body with `Payee`, `Payment Instructions`, and `Coding` sections, rendering the payment details as a compact line table and only showing optional PATH-entered references when staff provided them.

## 2026-04-21
- UX/Intake/Uploads: Applicant file-upload fields in the legacy public portal now use one visible `Upload` action that opens a `Take photo` / `Choose file` chooser on likely camera-capable mobile devices, while keeping the authored broad document/image accept lists for normal file picking.
- UX/Workflow/Preview: Admin Workflow Preview and the intake-step editor now show a static upload-preview callout explaining the mobile camera chooser behavior so authoring screens stay aligned with the live applicant runtime.
- Fix/Notifications/Approvals: Approval-decision bell alerts now show the actual approver action for application reviews, with `Request Changes` and denials no longer reusing a generic green `Assessment submitted` notification and request-changes alerts now surfacing as yellow warnings.
- UX/Landing Page: Public landing-page release notes are now generated from the maintained release-notes log during build, stamped with the deployed release ID/date, and no longer depend on a separate hardcoded version label that can drift from the live build.
- UX/Admin shell: The visible admin build/version line now uses the deployed release/build identity instead of the stale package semver, keeping the footer build stamp aligned with the published landing-page release notes.
- Fix/Approvals/Wizards: Queue-launched application and intervention approvals now keep the explicit `decision` entry step instead of letting local wizard-step restore or the old Cloudscape navigation-priming workaround bounce approvers back to step 1 or another stale step.
- Fix/Approvals/Workspaces: Queue-launched application and intervention approvals now start on their approval-review board layouts without overwriting the user's saved normal workspace layout, and board quick actions/reset work again after launch.
- UX/Workflow/Wizards: Application Assessment and Intervention Assessment now switch their widget heading and lead-in copy to match the current phase, so drafting, approval, and follow-up states no longer reuse assessment-era labels.

## 2026-04-20
- Fix/Agreements/CFA: Client Funding Agreement signature prefill now prefers the assigned case manager on the case and stores that signer name in the CFA version snapshot so later sends/regenerations do not drift to the staff member who happened to click Generate or Send.
- Fix/Documents/PDF: Case manager assessment signature blocks now prefer staff display names from PATH profiles and read approval/submission signatures from the current shared event store before falling back to legacy case-event rows, avoiding raw email addresses on newly generated assessment PDFs.
- Fix/Workflow/Applications: Application Assessment request-changes decisions now refresh Notes and Timeline immediately after commit, and the auto-created request-changes case note is now written in the main case-update transaction with the normal note-added audit event.
- Fix/Workflow/Documents: Assessment submission now warns before replacing uploaded `Application form` or `Financial overview` files and lets staff retain those current uploads while still generating the case manager assessment PDF.
- Fix/Documents/PDF: Case manager assessment PDF redlines now stay clean on version 1 and compare later versions against the immediately previous submitted assessment so changed text fields render prior values in red strikethrough above the new green replacement text.

## 2026-04-19
- Fix/UX/Casework: Case Workspace now prefers the action plan that owns the latest open intervention proposal when a case is reopened, and the `Proposal in progress` warning now offers a direct jump to that draft proposal instead of leaving staff on the wrong plan tab.
- UX/Notifications/Admin+Portal: PATH-generated emails now support a configurable sender display name and `Reply-To` address in addition to the shared sender email, and applicant-facing mailers now use those settings consistently across notifications and account invitations.

## 2026-04-17
- Docs/Ops: Expanded the durable bug/change triage guidance so Codex now treats triage requests as full queue review plus internal notes, intentional status updates, duplicate/info-gap handling, and a prioritized planning analysis for Bill, while keeping autonomous implementation/deployment out of scope unless explicitly requested.
- Docs/Ops: Added a standing weekly-summary instruction so user-facing "last week" fix/change bullets must review both the release-notes working log and the thread index, catching relevant non-bug/non-CR changes instead of relying only on the feedback queue.

## 2026-04-18
- Fix/Notifications/Admin+Portal+Events: `Auto assigned`, `Case assigned`, and `Case reassigned` now act as separate configurable SES notification events from the Manage Notifications matrix. System auto-assignment sends `Auto assigned`, manual first assignment sends `Case assigned`, and manual reassignment sends `Case reassigned`, all to the actual assignee plus any case watchers using the configured role rows and shared runtime sender email, with the portal-side pre-case `auto_assigned` event suppressed from email delivery so auto-assignment workflows do not double-send.
- UX/Workflow/Applications: Moved the Application Assessment `Deny Funding` shortcut back onto `What is being proposed?`, so staff capture proposal context before taking the denial path.
- UX/Configuration/Admin shell: Demo-toolbar visibility is now stored in shared runtime config instead of browser-local storage, with hidden-by-default fallback and a single System Administrator control that applies consistently across sessions.
- Docs/Ops: Tightened the TEST deploy runbooks to spell out the app-coupling rule for admin changes that depend on sibling `shared` or `ISET-intake` runtime modules, so operators do not incorrectly use an admin-only TEST rollout for coupled server paths such as notification email rendering.

## 2026-04-15
- Security/Auth/Portal: Public password-reset requests now write a durable audit trail keyed by normalized email, including page route, request flow, source IP, user agent, outcome, and small Cognito delivery/error metadata so future investigations can distinguish `/forgot-password`, `/activate-account`, and `/reset-password` resend traffic.
- Fix/Workflow/Applications: Application approvals now move `iset_application.status` to real decision outcomes at commit time, using `approved` or `rejected` immediately instead of the placeholder `decision_ready`, while keeping the approval path open until letters and any required funding forms are finished.
- UX/Approvals/Workspaces: Opening a row from the homepage `Approvals` queue now launches the target workspace in an approval-focused board layout and lands the relevant wizard on its decision step, including selecting the correct intervention proposal in case workspace.
- UX/Approvals/Casework: `Proposed new intervention` now uses `Approved`, `Denied`, and `Request Changes` as the intervention-decision labels, commits the approval at `Record of decision`, and keeps decision-letter preparation as a separate post-decision follow-up instead of another wizard step.
- UX/Home/Docs: Updated the homepage approvals queue messaging, help-panel content, and durable docs to reflect the current `Approvals Items` layout, including province, EI status, compact timeline badges, and workspace-only approval actions.

## 2026-04-14
- Docs/Ops: Updated the standing handoff docs to require live PROD feedback-log updates during Codex bug/change triage, documented the short outcome-first hotfix-note wording style, and captured the later same-thread PROD Regional Manager case-access and feedback-log follow-up under the exact Codex task-history title.
- Fix/API/Casework: Regional Manager case-workspace access now treats direct assignment as a first-class grant across the `/cases/:id` workspace family and the shared action-plan/intervention validators, so directly assigned out-of-region files no longer fail with a region-scope `403`.
- UX/Workflow: Intake step authoring and Workflow Preview now expose the same runtime-backed checkbox-array conditional-visibility operators and whole-step skip behavior as the public portal, bringing the admin editor suite back in line for renderable intake content.
- Ops/Workflow: Verified that DEV workflow `21` authoring rows now regenerate the published intake runtime payload, so the step library, workflow library, and `publish/workflow.schema.intake` row are back in sync in DEV.
- UX/Applications: Application Overview now exposes the manual status selector to `NWAC Administrator` users as well as `System Administrator`, while keeping the existing role-scoped transition checks and finalized-status confirmation flow.
- UX/Home: Reordered the homepage `Work Queue` for `NWAC Administrator` and `Regional Manager` so `Approvals` now sits directly below the case queue in both the card layout and the `Work queue preferences` list.
- UX/Workflow/Manual Intake: Manual Application Intake now uses the same shared conditional-visibility operators and visible-step skipping logic as the public-intake-aligned admin preview/editor path, so support-driven follow-up steps like the Step 19 checkbox flow stay navigable in the admin console without stale hidden answers leaking into submission.
- Fix/UX/Casework: Case Workspace `Intervention Assessment` Step 6 now loads payment-type mapping from the existing payments read endpoint used by the coordinator assessment flow, so `Regional Manager` and `ISET Coordinator` users no longer lose all `Add cost item` options because of a finance-config `403`.
- Fix/UX/Applications: `ISET Application Form` financial totals and amount displays now use the shared two-decimal CAD currency helper instead of a one-off formatter that could show inconsistent decimal precision.
- Fix/Messaging/Portal: Applicant message replies now stay allowed when the replied thread belongs to the applicant's current case and application but the original staff sender is no longer the current case assignee, preventing false `recipient_not_allowed` reply failures after reassignment.

## 2026-04-11
- Fix/Security/Casework: Hardened Word supporting-document viewing so the internal preview path now falls back to a cached self-contained HTML preview when a deployed host cannot launch Chromium for PDF rendering, instead of failing the document view outright.
- Workflow/UX/Configuration: Added a configurable `EI Status Verification` timing target between Assignment and Assessment, seeded through `sla_stage_target`, and exposed it in `Configuration > Workflow timing targets`.
- Fix/UX/API/Applications: Unified application due/overdue stage selection across the assessment dashboard, application overview, homepage queues, and server-side work-queue counts so assigned files with blank `assessment_esdc_eligibility` now report against the EI Status Verification target before moving into Assessment.
- Ops/UX/Admin shell: Added a runtime-config-driven maintenance announcement rail to the admin shell, polling `/api/service-announcement/current` every 15 seconds and rendering a non-dismissible Cloudscape `Flashbar` warning with a live local countdown.
- Ops/Deployments: Added the `path:maintenance` operator command so Codex can set or clear planned or unscheduled maintenance warnings in `iset_runtime_config(scope='runtime', k='service.announcement')` as part of deploy or incident workflows.
- Ops/Deployments: Added the `path:maintenance:fallback` operator command so TEST/PROD HTTPS ALB host rules can be switched to a static HTML `503` maintenance page and later restored, giving users a deliberate maintenance message instead of a generic browser error during hard downtime.

## 2026-04-10
- Security/UX/Casework: Supporting Documents now exposes a separate `Download` action for `System Administrator` and `NWAC Administrator` only, gated by a privacy-risk confirmation and backed by a server-enforced original-file attachment path.
- Fix/Security/Casework: Supporting Documents and other shared document-view actions now render `.doc` and `.docx` through an internal cached preview artifact instead of exposing the raw Word object to browser/Office Online handling, and admin-side manual document uploads now accept Word files in the same workflow.

## 2026-04-07
- UX/AI/Casework: Expanded the Case Workspace help panels and embedded AI help context so staff get explicit guidance for backloading historical action plans, interventions, and supporting documents on imported/application-less cases.
- Fix/UX/Casework: Supporting Documents now keeps imported/application-less cases in case-based document mode whenever the case has no linked application, even if the client already has a PATH account, so `Upload existing documents` no longer asks staff to attach application-scoped document types to a nonexistent application.
- Fix/API/Admin users: Replaced the `Administrative Users > Resend invite` placeholder with a real Cognito `RESEND` flow for staff accounts still in `FORCE_CHANGE_PASSWORD`, and now return clear guidance to use `Force reset` only for active accounts.
- Fix/Security/Admin users: Hardened admin-user management routes so they resolve the target user's actual Cognito admin group server-side instead of trusting role labels sent from the browser, closing gaps across disable, enable, role change, role removal, region update, resend invite, and force-reset actions.
- UX/Admin users: Scoped the Administrative Users dashboard to the roles the current actor is allowed to manage, tightened toolbar button enablement to match account state, and surfaced route `detail` messages in flash errors instead of generic HTTP failures.

## 2026-04-06
- Workflow/API/Finance: Stopped auto-creating payment packets from intervention approval or auto-generated assessment interventions, and now treat approved intervention funding as authorization only until staff create a packet for a specific claim period or receipt.
- Fix/API/Finance: Payment packet creation now allows multiple packets over time for the same intervention, while validating the initial line against remaining authorized funding and adding duplicate warnings at create time.
- UX/Finance: Updated the Payments queue, detail help, and create-packet form to reflect period-based claims, including separate-packet guidance and amount entry against the approved funding ceiling instead of defaulting to the full approved total.
- UX/API/Finance: Added an `Include carry-over` option to `Budgets and Finance > Financial Reports`, surfacing best-effort carry-in/carry-out estimates plus row-level carry-over adjustments derived from payment-line dates when available and intervention schedules otherwise.
- UX/API/Finance: Replaced the old Financial Reports demo dashboard with a live annual `Budgets and Finance > Financial Reports` page for CRF/EI approved intervention funding, including province/territory and case-manager slice-and-dice filters, province totals, intervention-level detail, and finance follow-up on each intervention row.
- UX/Export/Finance: Added workbook-style Excel export for the Financial Reports page, producing a summary worksheet plus separate CRF and EI detail worksheets from the current filtered report view, with finance follow-up fields beside the approved funding amounts.
- UX/Finance: Simplified the top controls on `Budgets and Finance > Financial Reports` by renaming the page to `ISET Advances and Active Clients`, keeping only fiscal-year and region filters in the header, and moving `Reset Filters` into the header actions beside Excel export.
- Fix/API/Finance: Retired the legacy intervention-ledger shortcut so approved interventions no longer create live `finance_transaction` rows. Live commitments now start when a payment packet is sent to finance, and actuals start only when PATH records a posted/confirmed payment.
- Workflow/Schema/Finance: Simplified the payment workflow to a packet-first canonical status set: packet statuses are now `Draft`, `Ready to send`, `Sent to finance`, `Payment confirmed`, and `Cancelled`; line statuses are `Needs evidence`, `Ready to send`, `Sent to finance`, `Paid`, `Held`, and `Cancelled`; optional finance batches no longer act as packet/line statuses.
- UX/API/Configuration: Added the restricted `Configuration > Applicant Watchlist` manager page so NWAC and System Administrators can search, view, add, edit, deactivate, and reactivate SIN-based watchlist entries directly.
- Data/Schema/Watchlist: Rebuilt `iset_applicant_watchlist` to the clean active/inactive model with canonical 9-digit SIN storage plus update/deactivation audit fields, intentionally using a destructive migration because the feature was not yet live in production.
- Events/Admin+Portal: Added shared applicant-watchlist lifecycle events (`added`, `updated`, `removed`, `hit`) and now emit watchlist-hit events from both admin manual intake and the public intake completion path using masked SIN payloads only.
- Security/Home: Homepage watchlist-hit matching now ignores inactive entries, and generic event-feed responses now filter watchlist events for users who do not have access to the Applicant Watchlist dashboard.

## 2026-04-05
- UX/API/Admin shell: Added in-app bug reporting and change requests from the admin-console top header. Staff can now open a dedicated help panel, launch a floating non-modal report window, capture severity plus description, and attach supporting files without leaving PATH.
- Data/Storage/Admin shell: Added the dedicated `admin_feedback_report` and `admin_feedback_attachment` schema plus `POST /api/admin/feedback-reports`, keeping internal bug/change evidence out of `iset_document` while reusing the shared object-store upload path.
- UX/API/Home: System Administrators now see a new `Bug & Change Requests` widget on the homepage, with live filters/search plus a floating review panel for internal bug/change triage without leaving the shell.
- Data/Storage/Admin shell: Added dedicated feedback-management routes plus `admin_feedback_status_history` and `admin_feedback_note` so System Administrators can persist status changes and internal notes on internal feedback reports.
- Fix/API/Finance: `manual_backload` interventions now write historical posted finance ledger entries from their `actual amount`, stay blocked from payment-packet creation, and appear in the payment-ledger export without entering the live finance submission workflow.
- Fix/API/Casework: Backloaded existing interventions now enforce plan-lifecycle compatibility, blocking archived-plan placement, limiting closed plans to completed/cancelled interventions, requiring an active plan for in-progress or suspended interventions, and suppressing retroactive finance/CFA/payment side effects when `manual_backload` interventions are later edited or closed.
- Fix/Data/Casework: Backloaded action plans and closed interventions now seed their lifecycle timestamps from the entered historical dates so `activated_at`, `closed_at`, result dates, and end dates stay internally consistent.
- Docs/Casework: Updated the client-file import and case-header references plus `docs/AGENTS.md` to document the enforced backload rules for imported/application-less cases.

## 2026-04-04
- Ops/Deployments: Established `sql/migrations/` as the canonical PATH shared-schema migration path, moved one-off SQL into `sql/ops/`, added the explicit `path-schema-migrate` CLI (`db:migrate:inventory|plan|apply`), and updated deployed portal paths to force `AUTO_MIGRATE=false`.
- Ops/Deployments: Added an allowlisted PATH data-sync CLI (`data:sync:*`) and prod/test SSM SQL helpers so intake runtime config and workflow-authoring graph promotion can be planned, bundled, and applied without ad hoc copy/paste SQL.
- Ops/Deployments: Added a non-destructive TEST DB refresh planner command (`test:db:refresh:plan`) so Codex can validate the current test account/ASG/instance state before the full refresh implementation lands.
- Ops/Deployments: Added the `path:deploy` control-plane command and runbook so PATH deploys now have a single orchestrated entry point for AWS identity preflight, remote canonical schema apply, optional allowlisted data sync, app rollout, TEST target-group smoke checks, and local release-manifest capture.
- Ops/Deployments: Hardened deployed schema ownership by forcing `DISABLE_AUTO_MIGRATIONS=true` in deployed admin env render paths, standardised the Codex/operator prod profile alias to `nwac-prod`, and aligned the prod-facing deploy helpers/docs to that explicit profile name.
- Ops/Deployments: Verified the prod control plane end to end for read-only preflight, hardened AWS-backed Node/npm operator scripts to route through bash/WSL so they use the Codex-managed AWS profiles correctly, and fixed the prod SSM SQL helper to use explicit DB host/name/port defaults because the prod secret currently holds credentials only.
- Ops/Deployments: Replaced the TEST DB refresh planner-only gap with an executable `test:db:refresh` operator command that uploads or references a scrubbed dump, restores it over SSM on a live TEST app host, reapplies canonical schema, runs TEST smoke, and records a local manifest.
- Ops/Deployments: Prod deploy plans/runs now model restore points explicitly; DB-affecting prod runs auto-capture an Aurora cluster snapshot restore point for `nwac-prod-db` before schema/data mutation begins.
- Ops/Deployments: Closed the last manual TEST-reset gap by teaching `test:db:refresh` to generate its own DEV-derived baseline snapshot (full schema plus allowlisted safe/reference data only) and by adding `--refresh-test-db` to `path:deploy` so TEST can be reset and redeployed from one command with no manual dump step.

## 2026-04-03
- UX/API/Home: System Administrators now see a new `Operations Snapshot` widget on the homepage with live counts for ILMP submission blockers, applicant activation backlog, and staff access follow-up, replacing the default Development Tracker tile.
- UX/API/Home: The new System Administrator snapshot links now open filtered `ILMP Submissions & Exports` and `Manage Users` views, and the ESDC participant queue now honors `readiness` / legacy `filter` URL params so blocked and needs-review links land on the correct queue state.
- UX/API/Home: System Administrators now see a role-aware `Recent Admin Activity` widget that mixes workflow publishes, upload-config changes, event-capture updates, and relevant admin/system case events without a schema change.
- Fix/Home: Homepage activity links now open case workspace records via `/cases/:caseId` instead of the stale `/case/:id` path.
- UX/API/Home: Added a new full-width `AWS Environment Status` widget for System Administrators, showing live read-only checks for staff Cognito, applicant Cognito, and SES mail in the active environment with direct links into User Management and Notification Settings.
- UX/API/Home: Added a new full-width `Users & Access Alerts` widget for System Administrators, showing staff MFA/reset/disabled-account follow-up plus applicant activation backlog with direct filtered links into User Management.
- UX/Home: System Administrator homepage layout storage now rolls to `admin-home-layout-v9` so the new `AWS Environment Status` widget is included by default without resetting other roles' saved homepage layouts.

## 2026-04-02
- Fix/Notifications: Applicant secure-message and reminder emails now recover the public-portal link from standard portal host env vars (`REACT_APP_PORTAL_URL`, `REACT_APP_API_BASE_URL`, `PORTAL_DOMAIN`) when explicit `APPLICANT_PORTAL_*` settings are missing, preventing TEST emails from degrading the sign-in call to plain text with no hyperlink.
- Docs/Ops: Updated the TEST portal env template, runtime notification doc, and environment config map to make the applicant-portal email-link dependency explicit for future deployments.
- Docs/Auth: Added a TEST staff Cognito recovery guide and thread-index entry covering `staff_profiles.cognito_sub` drift, why `Administrative Users` can fall back to primary-region-only display, and the correct recovery paths for legacy `FORCE_CHANGE_PASSWORD` staff accounts when Cognito mail is missing or fails.

## 2026-04-01
- Intake/PDF: Updated the signed intake declaration PDFs and the generated application-form PDF so their English record output matches the current published workflow-21 intake wording for consent/declarations, gender, social-assistance follow-up, target-program options, and support/student-aid sections.
- Intake/Workflow: Removed the generic Step 24 `Other support documents` upload from DEV workflow `21` and republished the intake so selecting `Other` support no longer creates a mandatory catch-all document blocker at submission time.
- Intake/Portal: Completed a French-copy pass on the current DEV intake publish for recently edited consent/funding forms, the new social-assistance and childcare follow-up questions, and the Step 24 support-driven upload requests so the public intake no longer falls back to placeholder or English-only text in those updated areas.
- Portal/Landing Page: Updated the public ISET landing-page French copy to mirror the latest English eligibility/support wording, including the publicly funded institution bullet, the moved support note, and the revised NWAC ISET case-manager wording. This code change still requires a portal deploy to become visible.
- Intake/Portal: Added public-portal checkbox-array conditional operators (`contains`, `notContains`, `containsAny`, `notContainsAny`, `containsAll`) so Step 19 support selections can drive later workflow-21 questions and document uploads without refactoring `Supports Requested` into separate yes/no fields.
- Intake/Portal: Public intake runtime now auto-skips steps whose authored components all hide after conditional evaluation and renumbers visible progress accordingly, allowing irrelevant Step 21/22 support-driven steps to disappear entirely instead of showing placeholder notices.
- Intake/Workflow: Updated DEV workflow `21` authoring so Step 19 `requested-supports` now drives Living Allowance income/expense follow-up, Transportation/Childcare/Other expense questions, and new support-specific Step 24 upload requests for tuition statements, books/materials proof, transportation proof, childcare cost proof, and other support evidence.
- Intake/Workflow: Split workflow `21` Step 19 into two branched variants after Step `93`, so applicants who answered `No` to `dependent-children` are routed to a no-childcare copy of `Financial Supports Requested` and are no longer offered `Childcare` in the public intake.
- Docs/Meta: Added `docs/meta/codex-thread-index.md` as the searchable cross-thread recovery index for durable handoff notes and prior-thread findings, and updated `docs/AGENTS.md` to require future chats to use and maintain it.
- Docs/Ops: Updated the TEST DB access guide and thread index with the 2026-04-01 intake-import finding that large JSON exports through SSM stdout truncate, so future TEST form pulls should export large authoring rows component-by-component with base64 wrapping before reconstructing them locally.
- Docs/Planning: Added `docs/planning/step19-checkbox-conditionality-followup.md` to capture the remaining parity work for Manual Intake, Workflow Preview, and the intake-step editor after the new public-portal-only Step 19 checkbox conditionality landed.

## 2026-03-31
- UX/Casework: Case Workspace now includes an `Events timeline` widget on the default board and a new `View audit trail` quick action that switches to a focused audit layout using the same case-event feed as Application Workspace.
- UX/Landing Page: Reframed the public PATH landing page as a staff access/support entry point, removed development/marketing-oriented content from the default view, and moved release notes behind an optional expandable section so sign-in/help content leads the page.
- Docs/Landing Page: Updated the landing-page feature doc and `docs/AGENTS.md` to reflect that the public landing page is pre-sign-in, not role-aware, and that role-specific home dashboards begin after authentication.
- Fix/API/Casework: Case Workspace secure messaging now works for imported application-less client files when the case is linked to a participant PATH account, resolving the recipient through the client applicant account when no application submission exists.
- UX/Casework: The shared Secure Messaging widget now shows a disabled/unavailable state for cases that do not yet have a linked participant account instead of surfacing a generic load failure.
- Fix/API/Finance: Payment packet list/detail hydration now resolves applicant user IDs for imported application-less cases through the linked client PATH account when no application submission exists, preventing imported-case finance evidence flows from losing applicant document access.

## 2026-03-30
- UX/Integration: Replaced the broken in-page Job Bank iframe with an explicit launch panel because Job Bank now returns `X-Frame-Options: SAMEORIGIN` on the search and summary URLs PATH uses, so browsers refuse to display those pages inside PATH.
- UX/Help: Updated Job Bank Search guidance to explain that PATH still builds the correct Job Bank destination URL, but staff now continue on Job Bank in a separate tab instead of an embedded frame.
- Docs/UX/Casework: Rewrote the coordinator-facing PATH help panels and AI chat context for Home, Manage ISET Applications, Manual Application Intake, Application Workspace, and Case Workspace to align guidance with NWAC staff training expectations around acknowledgement, documentation, assessment, active case management, and closure.
- UX/AI/Casework: Tightened the shared help-panel AI system prompt so coordinator-facing PATH chats answer more like a staff job aid, including direct yes/no answers when appropriate, stronger PATH-specific next-step guidance, and explicit reminders around financial evidence for living allowance and post-intervention follow-up before closure.
- UX/Tutorials/Casework: Reworked the coordinator-facing PATH tutorials and first-run tutorial prompts so they explain how staff should actually use PATH in their daily work, not just where widgets are. The home intro, application workspace, case workspace, and NWAC decision walkthroughs now emphasize choosing priorities, opening the right file, recording follow-up, supporting recommendations with evidence, and not closing cases before required post-intervention follow-up.
- UX/Tutorials/Casework: Versioned the coordinator home intro to `iset-coordinator-intro-v2` and the application/case workspace walkthroughs to `application-workspace-overview-v3` and `case-workspace-overview-v3` so the rewritten PATH quick-start guidance can reprompt for staff who had already completed the older generic tours.
- UX/Tutorials/Home: Added the missing homepage `home-info-link` tutorial hotspot to the header `Info` link so tutorial steps can point directly at the help-panel entry point for contextual guidance and AI support.
- UX/Casework: Added missing widget-level `Info` access for the main ISET Applications table and the Manual Intake form, and fixed the ISET Application Form widget so its help panel now opens with its own AI context instead of the generic fallback.
- Ops/Dev/Home: Restored local-dev `Clear ISET test data` behavior by starting the Admin Backend from `start-dev.ps1` with `ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES=true`, and updated the Demo Controls error copy to explain the missing env flag instead of showing a misleading bare `not_found`.
- UX/API/Home: NWAC Administrators now see new first-position `All Applications` and second-position `All Cases` cards in the homepage Work Queue, exposing the full non-terminal application portfolio and the full open case portfolio from the same widget.
- UX/API/Home: Regional Managers now see a new first-position `Applications in My Region` card in the homepage Work Queue, showing all non-terminal applications in their assigned provinces and territories while leaving `My Applications` as a separate queue.
- UX/API/Home: Regional Managers now also see a new second-position `Clients in My Region` card in the homepage Work Queue, counting open case files in their regional portfolio while keeping `dormant` and `ready_to_close` in scope and excluding only `closed`/`archived`.
- Fix/API/Home: `/api/applications` now supports `excludeTerminal=1` for staff-scoped open-application queues, and terminal-application normalization was tightened to treat withdrawn/denied-style terminal values consistently.
- Docs/Home: Updated the homepage Work Queue reference, help-panel copy, and `docs/AGENTS.md` with the live Regional Manager queue order, regional scoping rules, and the new case-based `Clients in My Region` semantics.

## 2026-03-29
- UX/Notifications: The admin-shell `Notifications` footer control is now visible to all signed-in roles and continues to refresh bell alerts in place instead of acting like a Notification Settings permission-gated link.
- UX/API/Reminders: Reminder due/overdue events and case reminder badges now classify by the PATH business day in `America/Toronto` instead of UTC/browser-local day boundaries, and reminder reschedules/reopens now clear prior due/overdue emit flags so future reminder bells can fire again.
- UX/Notifications: Staff bell alerts now append a date/time in the heading, using the notification delivery/creation timestamp rendered in the viewer browser timezone with an `America/Toronto` fallback.
- Docs/Notifications: Updated the notification dashboard reference, reminder runtime notes, help-panel copy, and `docs/AGENTS.md` with the current bell-alert timestamp rule, the reminder business-day rule, and the fact that PATH does not yet persist per-user timezone preferences.

## 2026-03-25
- UX/API/Configuration: Query Editor now includes a `Server Export` tab with a MySQL Workbench-style object-selection flow for choosing one database, selecting the tables to include, and writing a self-contained SQL dump file directly on the admin server.
- Docs/Configuration: Updated the live Query Editor dashboard reference, help-panel copy, and `docs/AGENTS.md` for the new server export flow, hardwired dump options, and Windows/WSL dump-path behavior.

## 2026-03-26
- UX/API/Auth: `Manage Users` now includes a new `Applicant Accounts` tab for imported participant accounts, with PATH-managed statuses, silent account creation, and manual `Send activation` / `Resend activation` actions.
- API/Auth/Import: Client-file import now silently creates or links applicant Cognito accounts only when the imported row resolves to one clean email value, suppresses all account emails during import, and skips account creation for missing, invalid, or ambiguous email rows.
- UX/Auth/Portal: Added a dedicated public-portal `Activate your account` page that wraps Cognito’s forgot-password mechanics in first-time activation wording, and the portal now marks linked applicant accounts as activated on first successful sign-in.
- UX/API/Casework: Case Workspace `Case header` now shows `PATH Account Status` and includes a quick action to activate or resend activation for the participant account directly from the case.
- Docs/Auth/Data: Added applicant-account activation workflow documentation, updated the user-management feature doc, and expanded `docs/AGENTS.md` with the client-anchored invitation/activation model and import rules.
- Feature: Notification Settings now includes a configurable PATH sender email stored in `iset_runtime_config`, and PATH-generated SES mail from both the admin dashboard and portal reads that shared runtime value.

## 2026-03-24
- UX/API/Reporting: Added inline drilldown on non-zero `Intake and Assessment` and `Interventions` values in `Reporting > Data and Results`, showing the contributing records directly beneath the clicked row with linked applicant/participant names that open the related application or case workspace.
- Docs/Reporting: Updated the live `Data and Results` dashboard reference, help-panel copy, and `docs/AGENTS.md` with the new inline drilldown behavior, fiscal-window rules for monthly vs cumulative clicks, and the current demo-mode limitation.
- UX/API/Reporting: Added a new `Intake and Assessment` section to `Reporting > Data and Results`, placed above `Interventions` in the default board layout, with participant home province/territory rows, month columns, a `Show` selector for new/approved/denied applications, and a local province filter input.
- Docs/Reporting: Added a live `Data and Results` dashboard reference, updated the dashboard help content, expanded `docs/AGENTS.md` with the new section and date-bucketing guardrails, and noted that the board layout storage key moved to `reporting-data-and-results-layout.v2`.
- UX/API/Home: Homepage count metrics now open the matching records in the shared `Work Queue Items` widget, which has a dedicated metric-results mode with neutral columns, a `Back to work queue` action, and automatic restore if the Items widget had been removed from the board.
- Fix/API/Home: Homepage metrics scope now honors all resolved Regional Coordinator `regionIds`, so multi-region summary counts and metric drilldowns reconcile correctly instead of silently falling back to a single region.
- Docs/Home: Added a live homepage Metrics dashboard reference, updated the homepage help-panel copy for metric drilldown behavior, refreshed the planning note, and expanded `docs/AGENTS.md` with homepage metrics/items pointers and guardrails.
- Fix/Auth: Removed the remaining admin dev-bypass and simulated-header auth paths, centralized frontend auth/current-user state in `AuthContext`, isolated `/auth/callback` from the main app shell, removed the stale placeholder `src/auth/AuthProvider.js`, and cleaned auth/config UI so sign-in now runs only through real Cognito/IAM.
- Fix/Auth: Removed the last auth-disabled/mock runtime branches from the server middleware and admin-user routes, stopped `/api/tasks` from falling back to a hardcoded user, removed duplicate admin-route mounting, and updated the docs base to describe Cognito-only admin auth.
- UX/Casework: Submitted intervention proposals and submitted revisions can now still be edited by all casework roles with case access, including cost-line changes, while final decision recording remains limited to approver roles.

## 2026-03-23
- Fix/Auth: Hardened the post-login callback path so AppContent no longer crashes if the real Cognito role is briefly null while the session claims are still resolving; role normalization now treats missing role state as empty instead of dereferencing `null`.
- Auth/UX: Removed the old local IAM toggle and simulated-user mode from the admin dashboard; the client now always uses real Cognito/IAM identity, assignment no longer offers placeholder staff identities, and the auth middleware no longer honors dev-bypass headers.
- UX/Letters: Denial-letter generation now rewrites internal decision notes into applicant-facing prose instead of pasting raw assessor wording like `Person is...` directly into the letter body, improving flow for both coordinator funding denials and intervention denial letters.
- UX/API/Casework: `Add existing action plan` now mirrors standard action-plan closeout requirements for closed plans, including result education, future education for `Returned to school`, and NOC version/code for `Employed`, and persists those values into the real action-plan closeout payload.
- UX/API/Casework: Imported/application-less client files now have explicit Case Workspace backload actions for `Add existing action plan`, `Add existing intervention`, and `Upload existing documents`; the new action-plan/intervention backload paths create real records silently without approval routing, checklist progression, or applicant notifications.
- UX/API/Casework: Supporting Documents now has a case-based mode for imported/application-less client files, using `GET/POST /api/cases/:id/documents*` so staff can upload case documents without an applicant account, including application-type documents that fall back to action-plan or case storage when no real application exists; the checklist tab is intentionally hidden in that mode.
- UX/Casework: Supporting Documents in Case Workspace now uses clearer relevance-filter language (`Show documents relevant to`) and a dismissible case-mode notice so the widget no longer implies that intervention is the primary attachment scope for every document.
- UX/Casework: Supporting Documents now places the application/intervention relevance filter below the tabbed document area instead of above it, reducing top-of-widget clutter in Case Workspace.
- Fix/Casework: Supporting Documents case-based uploads now preserve client resolution for client-scoped documents instead of dropping the case context before `client_id` is derived, and the widget now surfaces `client_id_required` as a specific upload error.
- Fix/Casework: The `ISET Clients` widget now paginates grouped client rows correctly by grouping the full filtered case list first and then paging the grouped client result, so the Cloudscape page control can move beyond page 1.
- UX/Auth: Removed the legacy `Developer bypass mode` top-navigation account item when IAM is off; local auth simulation still works through the existing dev IAM toggle without surfacing that early-dev label in the UI.
- Fix/Auth: Restored the top-navigation account dropdown in local auth simulation mode so the signed-in identity remains visible and `Sign Out` works again even when IAM is off.
- UX/API/Casework: Client Batch Import no longer blocks on malformed or checksum-failing SIN values; dry run now warns, imports the raw digits for later case-management correction, and stores raw SIN values in the imported client/case profile payloads instead of import-side hashing.
- UX/API/Casework: Client Batch Import dry-run now auto-detects the real header row, skips leading guidance rows before the first participant row, and lets staff override the first data row explicitly for spreadsheets with extended headers or setup rows.
- UX/Configuration: Moved `/iset/imports/client-files` into `Configuration` and renamed the navigation entry to `Client Batch Import`.
- UX/API/Casework: Added `Client Batch Import` at `/iset/imports/client-files`, with spreadsheet dry-run preview, duplicate/client matching, and transactional commit into real `client` + application-less `iset_case` records.
- Docs/Casework: Added a live Client Batch Import dashboard reference and updated the client-file import guide/gateway docs to reflect the implemented import workflow and its non-goals.
- UX/Configuration: Query Editor now supports loading a single `.sql` or `.txt` file into the SQL editor before running it through the existing multi-statement query execution flow, with a 900 KB client-side upload limit to stay within the server's 1 MB JSON body limit.
- Docs/Operations: Added a live Query Editor dashboard reference doc and corrected the gateway docs to reflect current behavior, including SQL file upload support and the shared execution path.
- Docs/Architecture: Added a client-file import guide clarifying that the schema supports application-less cases, documenting the new core case support, and calling out the remaining participant-account-dependent caveats around secure messaging and applicant-scoped documents.
- API/Casework: `POST /api/cases`, `PUT /api/cases/:id`, and `GET /api/cases` now support true client-file cases with no linked application, and the Case Workspace secure-messaging widget now suppresses message actions when no participant account is linked.

## 2026-03-22
- UX/API/Reporting: Wired `Regional Snapshot` coordinator salary values to the new `Budgets and Finance > Salaries` data so monthly, quarterly, and annual snapshots now derive salary from the selected region's annual salary entry instead of storing a separate manual amount.
- UX/API/Finance: Added `Budgets and Finance > Salaries`, a new standard board-based dashboard for annual salary tracking by province or territory, with a fiscal-year control, explicit budget-pot assignment, annual salary entry, and derived monthly values for review.
- Data/Finance: Added the `finance_regional_salary_entry` table for annual regional salary totals keyed by `region_code + fiscal_year_start`, and seeded the current dev fiscal year with logical regional salary-pot assignments.

## 2026-03-20
- API/UX/Reporting: Wired Regional Snapshot `C. Funding` and the matching Excel export to live PATH client funding by summing scheduled payment lines for the selected region and period, split by `CRF` and `EI`, and removed manual editing of those two client-funding fields from the snapshot editor.
- Fix/API/Reporting: Refactored Regional Snapshot client activity to use the case-level `portfolio_region_id` as the canonical reporting region, defaulted from applicant/client province, and backfilled current dev cases so regional counts no longer depend on staff assignment or finance records.
- UX/API/Reporting: Corrected the Regional Snapshot funding labels from OCR-derived `ER` / `IF` to `CRF` / `EI`, including the saved snapshot schema, edit form, on-screen report, and Excel export.
- UX/Reporting: Added Excel export to `Reporting > Regional Snapshot`, including `Download Excel` for the current region and `Download all Excel` for the selected period with a summary tab followed by one worksheet per region.
- UX/Reporting: Added `Download CSV` to the Data and Results board-item menus for each data section, exporting the exact filtered/demo/monthly-or-cumulative view currently shown on screen.
- UX/API/Home: Reworked the homepage Metrics widget into a configurable KPI widget with cleaner defaults (`New applications`, `Applications approved`, `Applications denied`, `Active cases`, `Employed`, `Returned to school`) and added metric selection from a longer list of application, outcome, case, intervention, and funding measures.
- API/Home: Redefined homepage `Funds committed` to sum approved intervention value in the selected period, and started stamping intervention review timestamps when proposals are approved or otherwise decisioned so commitment reporting aligns with approvals rather than downstream finance transactions.
- UX/Home: Simplified the NWAC homepage Work Queue by merging application approvals and intervention approvals into a single `Approvals` queue so the summary card and item table reflect one combined approval workload.
- UX/Home: Moved the Metrics widget period range from the header into the widget body below the metric tiles, keeping the exact applied date range visible without crowding the header actions.
- Data/Reporting: Added the `iset_regional_snapshot_report` schema for saved regional Board-style reporting snapshots by region and reporting period, including manual funding/admin fields, compliance flag, comments, and authoring metadata.

## 2026-03-19
- UX/Reporting: Renamed the reporting side-navigation sections to `ILMP Submissions` and `Reporting`, and added a new `Reporting > Data and Results` dashboard scaffold using the standard Cloudscape board pattern. Default access is enabled for System Administrators and NWAC Administrators through the route access matrix.
- UX/Reporting: Refined `Reporting > Data and Results` into a fixed workbook-aligned reporting page with the report sections ordered to match the NWAC spreadsheet and a shared province/territory multi-select filter bar for future slice-and-dice controls.
- UX/Reporting: Added a `Demo mode` toggle to `Reporting > Data and Results` that fills the workbook-aligned sections with in-page development/demo data and applies the existing province/territory filter to those demo values.
- API/Reporting: Connected `Reporting > Data and Results` section `Quarterly Data Uploads` to a live backend endpoint backed by PATH reporting-package records, while preserving workbook-aligned quarter due dates and showing agreement-wide schedule status when no package rows exist yet.
- API/Reporting: Wired the remaining `Reporting > Data and Results` workbook sections to live cumulative PATH reporting aggregates, including year-end results, intervention completions, client results, data-upload outcomes, and action-plan status snapshots, with optional AOP targets loaded from reporting runtime config when available.
- UX/API/Reporting: Added an admin-editable `Edit targets` flow on `Reporting > Data and Results` so the three AOP target values can be maintained directly from the dashboard and stored in runtime config.
- UX/API/Reporting: Added an admin-editable `Edit comments` flow on `Reporting > Data and Results` so `Additional Comments` is now a saved fiscal-year narrative note stored in runtime config and shown read-only in the report.
- UX/Reporting: Clarified the shared geography filter label in `Reporting > Data and Results` to explicitly mean participant home province/territory, matching the live backend filter behavior.
- UX/Reporting: Simplified the `Reporting > Data and Results` control bar by removing redundant `Current geography` and `Data source` summary tiles; the active geography is already visible in the filter control and demo/live state is already conveyed elsewhere on the page.
- UX/API/Reporting: Expanded `Reporting > Data and Results` controls to a 3-column layout with top-row context (`ISP Name`, `Portfolio`, `Demo mode`) and second-row filters (`Participant home province / territory`, `Case manager`, `Fiscal year`), and wired the live report aggregates to respect the new case-manager filter.
- UX/API/Reporting: Scoped `Reporting > Data and Results` AOP targets by fiscal year so the new fiscal-year control drives workbook sections, saved comments, quarterly uploads, and target editing consistently.
- Fix/Reporting: Repaired the `Reporting > Data and Results` live-report fetch after the new case-manager filter wiring introduced an ambiguous participant-submission query, and stopped target-save success states from being visually wiped by a follow-up live-report reload failure.
- UX/Reporting: Rewrote the `Reporting > Data and Results` page copy, status text, section descriptions, and help content so they read as end-user reporting guidance rather than development-oriented implementation notes.
- Fix/Reporting: Corrected the `Reporting > Data and Results` route wiring so the internal help-panel AI context is no longer rendered in the page header description.
- UX/Reporting: Made the top `Sample Data View` banner dismissible so demo mode does not keep an extra persistent alert on screen unless the user wants it.
- UX/Reporting: Enabled striped rows on the embedded Cloudscape tables in `Reporting > Data and Results` and emphasized the `TOTAL` row in the Interventions matrix for easier scanning.
- UX/Reporting: Narrowed row striping in `Reporting > Data and Results` so only the Interventions matrix is striped; the Overall Results and Quarterly Data Uploads tables now render unstriped while the Interventions `TOTAL` row remains emphasized.
- UX/Reporting: Moved `Demo mode` into the Report Controls header actions and replaced the in-content control slot with a `Results view` segmented control that switches the matrix sections between cumulative and monthly values while keeping `Final (p14)` as the year-end total.
- UX/Reporting: Replaced passive reporting guidance on `Reporting > Data and Results` with contextual popovers for demo mode, filter behavior, and quarterly upload behavior, while keeping alerts for actual empty/error states and save confirmations.
- Fix/Reporting: Stopped demo-mode AOP target figures in `Reporting > Data and Results` from changing with case-manager or province/territory filter selections; demo targets now stay agreement-level while demo results continue to respond to the selected filters.
- Fix/Reporting: Reworked the `Reporting > Data and Results` demo dataset so the sample sections reconcile with each other, including matching `Clients Served` totals across Overall Results, Client Results, and the Interventions `TOTAL` row.
- UX/API/Reporting: Added Interventions-only header controls on `Reporting > Data and Results` so that table can be viewed by `Completed`, `Planned`, `Active`, or `Cancelled` interventions and grouped by `By start date` or `By end date`, with the default workbook-aligned view set to completed interventions by end date.
- UX/API/Reporting: Expanded the `Reporting > Data and Results` Interventions section with a `Show` selector for `Count` or `Cost`; `Cost` uses payment-month allocation, and completed interventions use actual cost when available before falling back to planned cost.
- UX/Reporting: Converted `Reporting > Data and Results` workbook sections into removable Cloudscape board items with standard `Add section` / `Reset layout` controls, and moved `Interventions` to the top of the default layout under the report filters.
- Fix/Reporting: Corrected a Cloudscape board runaway-loop regression on `Reporting > Data and Results` by aligning the new board palette synchronization with the repo’s known-good dashboard pattern, preventing initial palette sync from repeatedly triggering upstream re-renders.
- UX/Release Notes: Published landing-page release notes as `v0.5.6` dated `19th March 2026`, and promoted the new reporting dashboard from `Coming Soon` to the top of `What’s New` in both English and French.
- UX/API/Reporting: Renamed the reporting section to `ILMP Data Uploads` and reduced it to the supported `Submitted` row only, removing implied gateway outcome rows that PATH cannot currently source.

## 2026-03-18
- Fix/Agreements: Participant-facing redline CFAs now render the intervention update badge correctly and apply explicit strike/add styling to redlined details cells, so removed funding lines no longer appear as plain rows and badge HTML no longer leaks into the document.
- UX/Layout: Starting or resuming intervention proposal/revision work from Case Workspace now switches the dashboard into an intervention-focused layout with `Case header`, `Action plans`, `Interventions`, and the intervention workflow widget visible together.
- Messaging/Workflow: Approval-letter funding packages no longer auto-attach `Client Acknowledgement of Funding Source`, because that form is now collected during the application process.
- Fix/Messaging: Case Workspace proposed-intervention approval letters now attach the funding package (`Client Funding Agreement`, `EFT/Wire form`) when the approved intervention being sent includes funded cost lines, even if the original assessment on the case had no funding.
- UX/Workflow: Case Workspace proposed-intervention approval now exposes inline parent Action Plan funding settings (`Funding stream`, `Budget pot`, `Paid from`) in the decision step when approval needs them, instead of forcing staff to leave the wizard to repair the plan first.
- UX/Lettering: Application Workspace approval letters now switch to intervention-focused wording when the approved assessment has no funded cost lines, emphasizing the approved intervention(s) and dates instead of funding-disbursement language.
- Messaging/Workflow: Sending an approval letter from Application Workspace now skips the auto-attached funding package (`Client Funding Agreement`, `EFT/Wire form`) when the approved assessment contains no funded cost lines.
- UX/Agreements: Revised Client Funding Agreements now generate and send as redline revisions against the prior signed CFA, with amended funding rows and totals shown inline using strikeout/added markup instead of only storing a separate coarse diff PDF.
- UX/Agreements: Client Funding Agreement generation now reflects already-paid intervention cost lines in the detail text, for example switching one-time items from `payable on ...` to `paid on ...` and showing partial-payment wording for recurring lines with historical paid amounts.
- Refactor: Intervention status handling now uses a canonical set only: `draft`, `submitted`, `in_review`, `changes_requested`, `approved`, `rejected`, `in_progress`, `suspended`, `completed`, `cancelled`.
- UX: Pre-start approved interventions now display as `Approved` across Case Workspace and finance flows instead of using the legacy `planned` state.
- API: Auto-created and newly approved interventions now persist `approved` as the pre-start status, and activation flows transition only from `approved` to `in_progress`.
- Ops: Added `sql/20260318_0001_cleanup_intervention_statuses.sql` to normalize old intervention statuses and change the table default to `draft`.
- Fix/Payments: Auto-generated payment packets now create their line items transactionally, and payee-type storage was widened to fit the configured detailed payee codes used by approved cost lines.
- Fix/Payments: Aligned the `payment_packet.status` DB enum with the live scheduling workflow so `awaiting_trigger` and `released` are now valid persisted packet statuses, matching the existing server/UI behavior.

## 2026-03-17
- UX/Lettering: Approval-letter packs in Application Assessment and Case Workspace proposed interventions now generate dedicated `Loan Provider` letters for funded `Student Loan Repayment` lines, grouped by provider/account and available as a separate preview/download tab.
- UX/Assessment: Cost-line modals now relabel the payee fields for `Student Loan Repayment` to `Loan provider / servicer name` and `Loan account number`, making the approval-letter data entry explicit at assessment time.
- UX/Data: Payee-type selectors in Application Assessment, Case Workspace, and Finance payment modals now load from a runtime-config payee-type catalog instead of a hardcoded frontend list; seeded the catalog in runtime config and added `Student Loan Provider / Servicer` for `Student Loan Repayment` lines.
- Fix/Workflow: Eligibility-denial reporting seeding now keys off a persisted structured denial reason code from the denial-letter workflow instead of the free-text assessment note, so `eligibility_not_met` denials reliably create the reporting-only downstream records.
- UX/Wording: Application-status labels now display `Not Approved` instead of `Rejected` across application-facing admin UI surfaces while keeping the underlying system status code as `rejected`.
- Workflow/Reporting: Eligibility denials (`eligibility_not_met`) now auto-seed reporting-only downstream records: ensure client, create a closed action plan, create one completed `Career Research and Exploration` intervention, and initialize ESDC participant validation without sending the record into normal casework queues.
- Workflow/Reporting: Denied-ineligible records now stay editable in Application Workspace for ILMP corrections after rejection, with automatic downstream resync/revalidation and clear Application Overview status messaging for blocked vs ready ESDC reporting state.
- Reporting/Batching: ESDC batch prepare/submit now include only `ready` participants and automatically exclude `blocked` / `needs_review` records instead of failing the whole batch; the batch widget now shows ready/review/blocked counts and excluded-record details.

## 2026-03-16
- Workflow/Content: Added `scripts/update-workflow21-trauma-copy.js` and revised workflow `21` intake step-library copy in the dev database for trauma-informed, bilingual applicant-facing language, including summary-page label snapshots and document-upload/legal declaration text cleanup.
- Workflow/Content: Simplified workflow `21` step `76` consent copy further into plain-language informed permission, removing statute references from that step while leaving the later legal-submission consent block unchanged.
- Docs/Planning: Added `docs/planning/intacct-mock-dashboard-design.md` as the durable handoff and design baseline for the separate mock Sage Intacct dashboard, PATH bill-splitting correction, phased MVP plan, and future reconciliation sync work.

## 2026-03-13
- UX/Integration: Refactored the Job Bank Search dashboard into two tabs: `Find a Job` retains the original posting-search flow, while `Explore a Profession` adds a PATH 2021-NOC autosuggest plus location input that resolves to the matching Job Bank profession summary page in the lower embedded frame.
- API/Integration: Added a Job Bank profession-summary resolver endpoint that translates PATH profession/location inputs into Job Bank's own occupation and location identifiers before building the final summary-page URL.
- UX/Help: Updated the Job Bank Search help panel to explain the new tabbed flow, the 2021-NOC profession picker, and the Job Bank summary-page resolver behavior.

## 2026-03-12
- Messaging/Workflow: Approval letters now carry required funding-signature forms as attachments in the same secure message (`Client Funding Agreement`, `Client Acknowledgement of Funding Source`, `EFT/Wire form`) instead of sending a separate follow-up message.
- Messaging/Workflow: Sending an approval letter now triggers docs-requested/reminder automation through the same secure-message path as manual form requests because non-letter signing attachments are included with the letter send.
- UX/Lettering: Approval draft generation now uses a single privacy-safe AI copy-edit pass with placeholder tokens (no applicant personal data sent), then deterministically injects case values locally and preserves fixed funding/forms paragraphs.
- Fix/Checklist: Approval-letter auto-attachments now stamp EFT signing requests with canonical `EFT_form`, so signed EFT submissions correctly clear the funding forms checklist item.
- UX/Lettering: Approved communication now behaves as an admin letter pack: the client approval letter remains editable, while institution and other funding source letters appear as separate read-only tabs with download actions for admin-side use.

## 2026-03-11
- UX/Assessment: Cost-item choices in `What will it cost?` now follow the wizard `Childcare Need` answer (yes/no) so childcare cost items are presented or hidden accordingly.
- Fix/Assessment: Application Assessment default-intervention auto-seeding now waits for the payment-intervention mapping fetch to complete before running, preventing false “seeded” state on first render.
- Security/Messaging: Hardened secure-message isolation so applicants only see messages where they are sender/recipient (`/api/messages`), with defensive cleanup of stale invalid mailbox rows; case-thread fetch (`/api/cases/:id/messages`) now blocks applicant access to other applicants' cases.
- UX/Help: Finance Settings `Payment type mapping` now shows a widget `Info` link with dedicated help-panel guidance, and the intervention default column label was shortened to `Auto-add?`.
- Workflow/UX: Renamed approval follow-up stage from `Complete funding documentation` to `Funding forms and signatures`; final action now reads `Mark application complete`, and step guidance now explicitly requires all required checklist items to be `Complete` before completion.
- Messaging/Workflow: Sending secure messages with signing-form attachments now sets docs-requested state/reminders server-side (`docs_requested_active=1`, source `secure_message`, reminder creation, and event capture) even for system-triggered sends.
- Messaging/Workflow: Applicant signing completion now clears docs-requested state/reminders when all pending non-letter signing requests for the case are complete.
- Messaging/Workflow: Approved communications now include attachments for `Client Funding Agreement`, `Client Acknowledgement of Funding Source`, and `EFT & Wire Transfer Direct Debit` in the approval-letter send flow (no separate funding-forms message).
- API/Checklist: Gate 6 funding-document requirements now enforce `assessment total cost > 0` for funding package artifacts (`funding_agreement`, `client_acknowledgement`, `EFT_form`/wire transfer form, and `voided_cheque`), so zero-cost approved assessments no longer block on those documents.
- Intake/Docs: Intake submission now auto-generates and stores `iset_client_info_release` (Authorization for Release of ISET Client Information) as a signed PDF, and the Application Form widget now includes a dedicated link/modal + PDF download action for that signed form.

## 2026-03-10
- UX/Data: Refactored `Other funding` in both Application Assessment and Case Workspace Proposed Interventions wizards to a structured flow (`involved?`, repeatable non-NWAC funders, NWAC coverage, notes) while retaining backward-compatible summary text persistence for existing records.
- Help: Updated Application Assessment and Case Workspace Proposed Interventions help-panel guidance/AI context to match the new structured Other funding step behavior.
- Refactor/UX: Intervention proposal cost-line modals in both Application Workspace and Case Workspace now support early payee capture (`payee type`, `payee name`, optional `reference`) without adding a new costing-table column.
- API/Data: `assessment_proposed_interventions` cost-line normalization/serialization now supports optional payee payloads so early payee values persist with proposed interventions.
- Payments/API: Auto-generated payment packet lines now prefer payee values from proposal cost lines (with existing fallback derivation retained) and now forward `payee_reference` when present.
- Validation: Payment packet validation now blocks submission with explicit `payee_missing` policy errors when line payee details are incomplete.
- UX: Payment packet detail table now shows line-level `Payee missing` indicators after validation, complementing top-level validation-block messaging.
- Docs: Added planning tracker `docs/planning/vendor-payee-early-capture-refactor.md` and updated related help-panel guidance for Application Assessment, Case Workspace Proposed Interventions, and Finance Payment Detail.
- Docs: Expanded `docs/AGENTS.md` interview directives (single-question interview flow, avoid preference-boundary probing, Codex-owned code/data decisions, and minimal-question policy).

## 2026-03-09
- Ops/Storage: `POST /api/clear-iset-test-data` now also purges object-store files linked to records being cleared (collects object keys before DB delete, then deletes keys after commit), returning `objectPurge` and `objectKeySources` in the response for audit visibility.
- Safety/Ops: Clear-test object purge now blocks deletion when `OBJECT_BUCKET` appears production-like (`prod`) to prevent accidental production bucket removal.

## 2026-03-06
- Feature: Added a new `Application Intake` dashboard route (`/iset/applications/intake`) under New ISET Applications for manual staff-entered intake.
- UX: Added `Manual Application Intake` page scaffold with frontend-held working state, session autosave, field-level validation, and `Create Application` gating until required fields are valid.
- API: Added `POST /api/applications/manual-intake` to create manual-origin records transactionally (`user` -> `iset_application_submission` -> `iset_application` -> `client` -> `iset_case`).
- Events: Manual intake create now emits `application_submitted` via shared case event service with manual-origin metadata (`origin_channel=admin_manual`, actor/timestamp details) while preserving baseline submission payload keys.
- UX: Successful manual create now redirects directly to the new application workspace (`/application-case/:id`) with a success flash banner.
- Access: Enabled `Application Intake` route access for System Administrator, Program Administrator, Regional Coordinator, and Application Assessor in role matrix/navigation.

## 2026-03-05
- Docs: Rewrote `docs/AGENTS.md` as a thread-handoff/quick-onboarding guide focused on durable codebase/docbase/database context, critical conventions, known pitfalls, and location-first references.
- Docs: Clarified `docs/AGENTS.md` to explicitly frame assistant/user collaboration as a design dialog (challenge assumptions, discuss tradeoffs before high-risk implementation, avoid literal blind execution).
- UX: Home work-queue conflict rows now show inline actions `Open workspace` and `Reassign` (falling back to `Assign` if no current owner), while hiding the inline `Resolve` action; underlying resolve code path remains in place for potential reinstatement.
- Docs/UX: Updated homepage help-panel content (`Home dashboard`, `Work Queue`, `Work Queue Items`, `Metrics`, `My Tagged Applications`, `Recent Activity`, and `Development Tracker`) to align guidance with current role-based queues, inline actions, tagging behavior, and widget controls.
- Docs: Added `docs/meta/next-release-notes-log.md` as the standing running log for next-release "What's New" drafting (version-tagged entries), and updated `docs/AGENTS.md` to require maintaining it in future threads.
- UX: Assessment wizard Step 1 is now titled `Assess Eligibility`, with simplified role guidance and clearer copy for EI status ownership/eligibility lock messaging.
- UX: Assessment wizard `Cancel` now exits edit mode via confirmation instead of appearing to discard changes with no navigation effect.
- UX: EI verification UX in assessment Step 1 now surfaces current documents inline, flags the latest document as current, and updates immediately when a new report is selected.
- UX/Validation: ISET Application Form SIN handling now combines strict edit-mode validation (9-digit + checksum), numeric/length input constraints, and grouped read-only display formatting (`XXX XXX XXX`).
- UX/Data: Version history modal refreshed for readability (smaller footprint, tighter columns, inline-link actions), `Saved by` now resolves from `staff_profiles.display_name` (fallback `email`), and `View` now shows a human-readable field-diff view (`View changes`) instead of raw JSON.
- UX: Successful version restore now closes the Version History modal automatically.
- Fix/Storage: Secure Messaging Message Details attachments now resolve to presigned S3 download URLs instead of local `/uploads` links.
- Ops/Storage: Removed legacy static `/uploads` delivery and remaining local-direct document download fallbacks; admin document/evidence download flows now operate as S3-only.
- Workflow: Secure messaging (applicant portal + case widgets) now uses per-user mailbox items for folder state, so delete/purge operations only affect the current user’s folders and no longer remove messages for other participants.
- Fix: Applicant portal replies now inherit case/application linkage from the replied message, restoring visibility of applicant replies in case-scoped secure messaging widgets.
- Fix: Assessment cost-line recurrence policy now resolves payment-type aliases/legacy labels (including wage subsidy variants), so `optional` recurrence settings correctly enable installments in coordinator and case-workspace editors.

## 2026-03-03
- UX: Removed the `Supporting documents` section from the ISET Application Form widget; document review/management remains in the dedicated Supporting Documents widget.
- UX: Moved the Application Assessment `Deny Funding` shortcut from Step 2 (`What is being proposed?`) to Step 1 (`EI Eligibility Check`) as a step-header action.
- UX: Application Assessment Step 2 (`What is being proposed?`) now promotes `Add intervention` as the only primary action until at least one intervention exists; once present, wizard `Next` returns as the primary action.
- API: Conflict-of-interest declaration updates in `PUT /api/cases/:id` now consistently resolve the active `staff_profile_id` from request context for both write and response readback, preventing stale conflict state when auth identity fields differ.

## 2026-03-02
- Payments: Auto-generated intervention payment packets are now schedule-driven and grouped by intervention + scheduled date; recurring occurrences create separate dated packets, manual-trigger groups are created as `awaiting_trigger`, packet queue ordering now prioritizes scheduled dates (`due_by`), and queue rows now show due/overdue/upcoming schedule indicators.
- UX: Batch payments queue now defaults to visible columns ordered as Packet, Client, Schedule, Status, Amount, and Blocking (others hidden by default), with sorting enabled on key operational columns (including Packet, Client, Intervention, Schedule, Status, Amount, Reporting unit, Submitted, and Age).
- Docs: Added `docs/planning/thread-handoff-2026-03-02.md` as a self-contained conversation handoff capturing locked payment scheduling decisions, related intervention-widget decisions, deferred scope, and execution order for continuation in a fresh thread.
- Docs: Added and expanded `docs/planning/payment-packet-scheduling-design.md` to capture full payment packet scheduling decisions, including canonical packet status model and transition rules for implementation handoff.
- Fix: Case workspace `Propose new intervention` wizard now deletes interventions reliably from the framing-step table even when hydrated draft IDs differ in type (string vs number).
- UX/Validation: Intervention NOC requirements now apply to codes `6–13` (and existing employer-type `17`) in both case workspace and coordinator assessment intervention flows, with matching NOC field visibility and required-field enforcement.
- API/Validation: Intervention create/update no longer treats proposal-stage end dates as closure; outcome-required closeout validation now applies only when status is `completed` or `cancelled`.
- UX/API: Finance Settings Payment Type Mapping now supports per-payment-type submission timing (`intervention start`, `intervention end`, `recurrence schedule`, `manual trigger`) with recommended defaults persisted in runtime config.
- UX/API: Finance Settings `Payment type mapping` widget now includes a required-evidence multiselect per payment type and saves those rules via runtime config (`finance:payment.evidence.rules`) through `/api/config/runtime/payment-type-mapping`.
- API: Payment type mapping runtime payload now returns `paymentEvidence`, `paymentEvidenceUpdatedAt`, and `evidenceTypes` so the widget can manage line-level evidence rules without hardcoded UI lists.
- UX/API: Payment recurrence is now configured per payment type (required/optional/not allowed) in Finance Settings and persisted in assessment costing runtime config (`assessment:coordinator.costing.line_item_defaults`).
- API: Payment validation, recurring-line creation, and auto-generated payment lines now apply recurrence policy from runtime config instead of hardcoded payment-type rules.

## 2026-02-27
- UX: Added a second Demo Controls action, `Create Case + Payments Data`, with a modal for client count, interventions per client, intervention-type selection, and optional prompt guidance.
- API: Added `POST /api/ai/create-dummy-case-payments` (with optional `?stream=1`) to generate coherent client/case/assessment/action-plan/intervention records plus draft payment packets and lines for finance workflow testing.

## 2026-02-26
- UX: Renamed Finance Payments user-facing labels to Batch Payments (route title/breadcrumbs, queue/detail/comms widget titles, and help panel wording) to reflect the batch-submission workflow.
- UX: Removed draft delete actions from the Finance Payments submission queue to keep the dashboard focused on batch submission.
- UX: Removed Export ledger from the Finance Payments submission queue header so the widget stays focused on due-for-submission packet actions.
- UX: Finance Payments queue now scopes to packets due for submission only (draft stage), excluding already submitted/cancelled packets from this widget.
- UX: Simplified Finance Payments queue header controls by replacing the Ready filter button with a true toggle and keeping selection/submission actions focused on due-for-submission work.
- API: Hardened AI dummy-draft generation to enforce published intake schema conformance before save (drop unknown keys and coerce values to expected scalar/multi/signature/file shapes).
- API: Added defensive coercion for identity spillover objects (e.g., `{ first_nations_band, registration_number }`) so text fields never persist raw objects that can crash workspace rendering.

## 2026-02-23
- ILMP: Added backend validation that first/last names cannot be numeric-only, matching ESDC ILMP guide rules.
- ILMP: Tightened intervention outcome enforcement so outcome is required when an action plan result date is present (queue validation + action-plan close endpoint).
- ILMP: Added strict NOC validity checks (2016/2021) against `noc_code` during action-plan/intervention save and close flows, with queue validation parity and aligned NOC-version allow-lists.
- ILMP: Locked action plan identity fields after ESDC submission by blocking post-submission changes to action plan start date and agreement number.
- ILMP: Fixed grouped batch XML duplication by deduplicating action plans when a client has multiple participant-submission rows.
- ESDC Dashboard: Participant queue now requests grouped-by-client rows so each client appears once with child rows for related submissions/plans.

## 2026-02-20
- Messaging: Internal `/messages` now supports explicit `Forward` compose mode with `Fwd:` subject handling and forwarded body prefill.
- Messaging: Reply delivery semantics now honor explicitly selected recipients instead of auto-notifying all historical thread participants.
- Messaging: Message list recipient/participant metadata is now derived per-message (mailbox-item based), enabling correct `Reply all` defaults.
- Messaging: Compose now allows empty subjects for new messages (display fallback remains `(No subject)`).
- Messaging: Added `Mark unread` action and backend endpoint (`PATCH /api/me/staff-messages/:itemId/unread`).
- Messaging: Read/delete/restore/permanent-delete flows now emit refresh events so side-nav unread counts stay synchronized.
- API: Removed staff-messaging missing-table compatibility fallbacks in dev to keep internal messaging code path clean.
- API: Existing-thread sends now require sender membership in the thread (`thread_access_denied` when not a participant).

## 2026-02-16
- API: `/api/admin/upload-config` now uses admin-local runtime config storage (`iset_runtime_config`) by default, removing the implicit intake proxy dependency; legacy proxy behavior is opt-in via `UPLOAD_CONFIG_PROXY=true`.

## 2026-02-18
- UX: Summary List "Summary Source" field picker in Modify Intake Step now includes `character-count` and `signature-ack` inputs (plus legacy input aliases), fixing missing data keys like `long-term-goal`.

## 2026-02-15
- UX: Notifications in the Case and Application workspaces now show only notifications tied to the current case/application (matching notification metadata), instead of the user's full notification list.

## 2026-02-13
- UX: Moved the assessment "Deny Funding" shortcut into the Proposed Interventions table header actions (next to Add intervention) and renamed the section to "Propose Intervention(s)".

## 2026-02-11
- Feature: Added a new `Case workspace overview` hands-on tutorial in the centralized platform, with first-run prompt on `/cases/:id`, help-panel start/restart controls, and role-consistent tutorial lifecycle handling.
- Fix: Case workspace tutorial startup now resets case workspace layout before launch so required hotspot widgets are present and step progression remains stable.
- Fix: Application workspace and NWAC tutorials now force-reset the application dashboard layout before starting, preventing `Next` dead-ends when required hotspot widgets were removed from a customized board layout.
- UX: Rewrote all `Application workspace overview` tutorial steps to reflect real widget behavior and first-run workflow guidance (orientation, quick layouts/actions, assessment progression, documents/messaging interplay, notes/tasks, calendar, and audit trail).
- Fix: Application workspace tutorial first-run prompt now recognizes role aliases (`ISET Coordinator`, `Program Admin`, `Regional Manager`, etc.) and no longer relies on only `Application Assessor`.
- UX: On application-case pages, NWAC tutorial prompt is now evaluated first for NWAC reviewers on `pending_approval`; otherwise the workspace overview prompt can still appear.
- UX: ISET Application Assessment help panel now includes a direct tutorial start/restart card (aligned with the homepage help-panel tutorial pattern).
- Docs: Updated `docs/AGENTS.md` with a standing rule to keep dashboard/widget help panel content in sync with refactors in the same change.
- UX: Refreshed homepage Work Queue help content (`Work Queue`, `Work Queue (ISET Coordinator)`, `Work Queue Items`, and tagged-items guidance) to match current widget behavior, bucket preferences, and terminology.
- Refactor: Replaced ad-hoc tutorial definitions with a centralized tutorial platform (`src/tutorials/tutorialPlatform.js`) and converted legacy tutorial files into thin category wrappers.
- UX: Home intro hotspots now anchor to stable homepage controls (`home-overview`, `home-layout-controls`, `home-info-link`) to reduce blocked `Next` transitions.
- UX: Added tutorial help-panel actions (`Restart tour`, `End`) for homepage/workspace/NWAC tutorial contexts.
- Fix: Resetting tutorial progress from Tutorials dashboard now clears in-memory prompt guards so auto-prompts can reappear in the same session.
- UX: Homepage tutorial/help copy now uses `Tag/Tagged` terminology for personal follow-up items (separate from Watchlist Hits).
- Docs: Added `docs/features/tutorial-platform.md` as the canonical tutorial architecture/runbook and updated `docs/data/tutorial-progress.md`.

## 2026-02-10
- Feature: Added an ISET Coordinator "Take a tour" intro hands-on tutorial with a one-time sign-in prompt (Start tour / Not now).
- Data: Tutorial completion/dismissal is now persisted per staff in MySQL (`staff_tutorial_progress`) instead of browser-only localStorage.
- API: Added tutorial progress endpoints (`/api/me/tutorial-progress`) plus a localStorage-to-DB migration helper (`/api/me/tutorial-progress/bulk-complete`).
- Ops: Admin deploy scripts now stage `sql/` so the server migration runner can apply new migrations.

## 2026-02-05
- Docs: Added database documentation index and overview, including demo-data guidance and schema dump pointers.
- UX: Application assessment now includes a Deny Funding shortcut on the framing step that routes to the Review step before submitting to Pending Approval and jumping to the decision step; denial letters now mark the application as rejected after sending.
- UX: Assessment wizard action buttons now hide once the application is finalized to avoid inert controls.
- UX: Decision letter editor now locks after sending to prevent duplicate letters.
- UX: Funding documentation step now preserves the primary action button label even when the checklist is incomplete.
- UX: Added guidance above the funding documentation checklist about uploading files or sending forms via Secure Messaging.
- Feature: Case workspace intervention approvals now auto-create draft payment packets from the proposed cost lines (no assessment fallback).
- UX: Planned interventions are now eligible for manual payment packet creation.
- API: Payment packet creation now blocks duplicates for interventions that already have a non-cancelled packet.
- API: Payment initiation no longer blocks interventions in planned status.
- API: Case workspace intervention approvals now require/derive an action plan budget pot so finance transactions can be created.
- API: Intervention-level finance transactions now record one entry per cost line instead of a single total.
- API: Payment packet submission now creates line-level finance transactions and posts them on confirmation.

## 2026-02-03
- UI: Authentication widget now exposes separate applicant inactivity timing fields (warning trigger + countdown duration).
- UX: Reconciliation dashboard copy, hints, and help panel guidance now clarify the exception workflow and data source.
- Feature: Reconciliation dashboard now loads live finance transactions and persists request/resolve actions in transaction metadata.

## 2026-02-04
- UX: Reconciliation dashboard now focuses on Sage Intacct REST submission outcomes with a packet-level submission queue and detail view.
- API: Added Intacct submission listing endpoint for packet-level REST attempt history.
- Data: Intacct REST submission attempts now record outcome + reason metadata for queue filtering.
- UX: Payment packet queue now surfaces Sage Intacct submission outcomes as intelligent status labels.
- UX: Payment packet detail now allows reopening failed/partial Sage submissions for resubmission, while blocking duplicates for accepted packets.
- UX: Finance Overview now defaults to only the Spend trend widget; other tiles start in the palette.

## 2026-02-02
- UX: Added Query Editor configuration dashboard scaffold with System Administrator-only access.
- Feature: Query Editor now includes SQL input, results widgets, and admin-only query execution endpoint (100-row cap).
- UX: Query Editor input now uses the Code Editor component for SQL entry.
- UX: Query Editor results now render in Code View with copy support.
- UX: Query Editor results now use tabs for Table, JSON, and CSV views.
- UX: Query Editor results now default to CSV and use Code View for CSV output.
- Feature: Query Editor now supports multiple SQL statements per run with per-statement selection.

## 2026-02-01
- Fix: Published workflow schema metadata now includes workflow type for runtime consumers.
- Fix: Workflow publish now blocks non-main-intake types and the editor shows type labels instead of raw values.

## 2026-01-27
- Fix: Admin user MFA status now reflects Cognito software token MFA via AdminGetUser enrichment.
- Ops: Deployment scripts now build POSIX-path zip archives to avoid Linux unzip failures.
- UX: Proposed Interventions widget now includes an info link with dedicated help panel guidance and AI context.
- UX: Proposed Interventions status badge now sits in the header actions next to Save Progress.
- Docs: Rewrote Proposed Interventions help content to align with PATH case management guidance.
- Fix: Proposed Interventions wizard now clears draft data after approvals or rejections so the next proposal starts clean.
- Fix: Rejected interventions can now be deleted from the case workspace.
- Feature: Regional Managers now support multi-region scoping in dev via `staff_region`, backend scoping updates, and admin user management changes.
- Ops: Added `scripts/run-prod-sql.ps1` helper for running ad-hoc SQL against prod via SSM.

## 2026-01-28
- Ops: Test deploy now falls back to tar/Compress-Archive if ZipArchive types are unavailable.
- Fix: Initial CFA drafts now generate from assessment data when no action plan exists, keeping secure message CFA attachments working before completion.
- Fix: CFA draft generation now uses application submission ownership fields to match the current schema.
- Fix: CFA draft generation now selects the intervention funding stream from the current schema to avoid SQL errors and allow plan-based CFA drafts to generate.

## 2026-04-10
- Fix: Staff/admin user management no longer writes legacy Cognito `custom:region_id` / `custom:user_id` attributes for staff-region changes and now persists region access through `staff_profiles` / `staff_region`.
- Fix: Staff auth enrichment now preserves DB-backed region assignments on sign-in and resolves effective `userId`, `regionId`, and `regionIds` from the staff profile model instead of depending on legacy token claims.

## 2026-01-29
- Fix: Application assessment no longer blocks submissions with a "Reason for not approving" error when the recommendation is not "Do not recommend funding".
- Fix: Case workspace cost item installment counts now handle dates entered with slashes.
- Fix: Case workspace cost item modal now auto-calculates installments when start/end dates are already set.
- UX: Payment line validation errors now return clearer, actionable messages instead of generic codes.
- Fix: Case scoping now uses `portfolio_region_id` so region-filtered application queries stop failing in dev.
- Fix: Funding authorization now recognizes payment-type labels in funding breakdowns when deriving category caps.
- UX: Payment packet detail now adds a Validate action and only shows Submit once validation passes; edits reset validation.

## 2026-01-30
- UX: Payment packet detail now includes an Intacct XML (Draft) preview tab with copy/download actions and missing-field flags for demo use.
- UX: Finance Settings now includes a Sage Intacct integration widget to capture XML Web Services credentials and defaults.

## 2026-01-26
- Assessment: Coordinator assessment now supports multiple proposed interventions with per-intervention cost tables, inline amount edits, and line-item modals.
- Assessment: Proposed interventions step now uses an embedded table with modal-based editing for intervention details and delete-only row actions.
- Assessment: Costing tables are now embedded Cloudscape tables with visible inline delete actions for cost lines.
- Assessment: Removed the duplicate top-level total from the costing step; totals remain in each table footer.
- Assessment: Proposed interventions and costing tables now allow column resizing.
- Assessment: Installments column now displays text ("in X installments") instead of icons.
- Assessment: Removed per-intervention header totals so only the table footer total is shown.
- Assessment: Restored the overall total at the top of the costing step.
- Assessment: Cost line modal now recalculates installments/amounts when dates or installment counts change, using intervention dates as defaults.
- Data: Assessment submissions now persist proposed interventions + cost lines in `assessment_proposed_interventions` with runtime-config defaults for suggested items.
- API: Added runtime config endpoints for coordinator assessment costing defaults.
- Data: Removed legacy intervention type references from schema/mapping sources.
- Ops: Added production Terraform environment scaffolding under `infra/terraform/environments/prod` to keep test and prod isolated.
- Ops: Parameterized Terraform module log group and IAM path prefixes so prod can be applied without test hard-coding.
- Docs: Added production Terraform runbook for baseline apply steps.
- Ops: Added Terraform-managed artifacts bucket and prod-safe bootstrap configuration.
- Ops: Added ASG capacity controls to the compute module and staged prod to start at zero capacity until env parameters are ready.
- Ops: Enabled S3 backend configuration blocks in Terraform env roots for remote state usage.
- Ops: Added explicit S3 backend state keys for test/prod to avoid interactive init prompts.
- Ops: Aligned backend lock table names with bootstrap naming convention.
- Ops: Resolved Terraform plan-time unknown count issues in compute listener rules and artifacts bucket encryption.

## 2026-01-17
- Feature: Funding agreements now generate versioned CFA PDFs (CFA vN) per plan when approved interventions change.
- API: Added CFA version list/create endpoints and automated sent/signed status updates through secure messaging.

## 2026-01-16
- UX: Finance Settings now uses a configurable dashboard layout with widget palette controls.
- UX: Added a Payment type mapping widget to manage intervention payment type rules.
- API: Added runtime config endpoints for payment intervention type mapping.
- UX: Docs requested thresholds now create case calendar reminders and clear them when the request is removed.

## 2026-01-15
- Assessment: Case workspace "Proposed Interventions" wizard rebuilt to support multi-intervention proposals with action plan selection, costing, and simplified documents.
- Assessment: Decision step now captures approve/request changes/reject outcomes with EI verification upload required for approvals and case-note logging for changes/rejections.
- API: Added endpoint to link EI verification documents to approved interventions.
- UX: Proposed Interventions wizard blocks navigation past the action plan step until a plan exists.
- UX: Proposed Interventions cost item modal now mirrors coordinator assessment behavior, including editable amount inputs and installment controls.
- UX: Proposed Interventions wizard auto-saves draft progress when navigating between steps.
- Fix: Proposed Interventions NOC autosuggest now matches coordinator search behavior and returns suggestions.
- Fix: Proposed Interventions draft data now restores when returning to an incomplete proposal without a saved draft.
- Fix: Proposed Interventions wizard validates framing data before moving forward and only auto-saves when a draft can be created.
- Fix: Proposed Interventions wizard now shows field-level validation errors across framing, type, cost, and decision steps.
- Fix: Proposed Interventions wizard restores submitted proposals on workspace load instead of blocking new navigation.
- Fix: Create payment packet modal now excludes rejected interventions from the eligible list.
- UX: Interventions widget status filter now includes Rejected.
- UX: Interventions widget status filter moved into the header as a select control.
- Fix: Proposed Interventions wizard defers auto-save until required NOC fields are available for NOC-required codes.
- UX: Proposed Interventions wizard now captures delivery details (NOC, partner, ITP, wage subsidy) in the add/edit modal instead of a separate step.
- UX: Proposed Interventions wizard disables Next on the framing step until at least one intervention is added.
- Fix: Proposed Interventions wizard no longer errors on load when checking framing readiness.
- Fix: Decision step navigation no longer blocked by draft auto-save logic on submitted proposals.

## 2026-01-14
- UX: Case portfolio Cases widget no longer shows the "New Case" action button.
- UX: Case portfolio ISET Cases search filter now renders inside the table header.
- UX: Case portfolio headings now use "Client" wording (ISET Clients dashboard, Clients widget, ISET Clients table).
- UX: Case portfolio Open Interventions badge uses the dormant status grey when the client is dormant.
- UX: Case portfolio Next action due now uses the next open case reminder date with overdue severity colors.
- UX: Case workspace Interventions table removed Duration and ESDC Outcome columns; Cost now follows Type.
- UX: Case workspace Interventions table Start - End shows a single date when no end date or same-day range.
- Fix: Auto-created action plans now map application childcare support status into the childcare funding code.
- UX: Intervention edit modal no longer asks for a title and the close hint now reads "Required to close".
- UX: Intervention edit modal now opens in a view state with an Edit toggle; close quick actions keep only closeout fields editable.
- UX: Closure status now shows a required hint in the intervention closeout section.
- UX: Action plan details modal now opens in view mode with Edit and closeout flows matching the intervention modal.
- UX: Payment packet queue now shows packet labels that include the case number.
- Data: Case creation now sets `portfolio_region_id` from the client's province to populate reporting unit data downstream.
- Fix: Band funding decision documents now satisfy band funding evidence and checklist requirements.
- UX: Case header quick actions now use client wording, updated labels, and the new order.
- UX: Payment packet "Submit to finance" now shows a loading spinner and submitting label while the email is generated.
- UX: Payment packet detail alerts are now dismissible.
- UX: Removed Program Payments from the Current ISET Clients navigation group.
- Fix: Action plan result date validation now compares date-only values so same-day closeouts pass.
- UX: Action plan closeout education level options now start at the plan's education level.

## 2026-01-12
- UX: Landing page release notes updated to v0.5.1 with application assessment fixes.
- Feature: Document request tracking is now stored independently of application status with new `docs_requested_*` fields and event emission on set/clear.
- UX: Application Overview and work queues now show a Docs Requested badge alongside the application status, with a manual toggle to start/clear the timer.
- Config: SLA settings include document-request reminder/closure thresholds for future event-triggered automation.
- UX: Role labels now consistently display System Administrators, NWAC Administrators, Regional Managers, and ISET Coordinators across the admin UI.
- Policy: Regional Manager approval threshold now escalates above $15,000.
- Policy: NWAC Administrators can approve up to $24,999; only sstacey@nwac.ca can approve above that limit.
- UX: Program Admin work queue labels now read "Application Assessments" and "New Interventions" with updated hint text.
- Feature: Added applicant watchlist quick actions in Application Overview and Case Header, backed by a new applicant watchlist table and API endpoint.
- UX: Renamed the homepage My Watchlist widget to My Flagged Applications.
- UX: Homepage work queue now surfaces watchlist hits (applications with watchlisted SINs) in place of ILMP issues.
- UX: Homepage work queue now loads "Marked for Closure" applications in the queue and items table.

## 2026-01-11
- Assessment: Wizard navigation now auto-saves assessment progress on Next/Previous to preserve cost line edits without manual saves.
- Assessment: Empty proposed intervention shells are filtered on load/save to prevent blank rows.
- Fix: Eligibility step no longer warns about concurrent updates when auto-save runs before Next.
- Fix: Do not persist zero-cost legacy totals when no interventions exist, avoiding blank proposed rows on new assessments.
- Fix: Assessment submit validation alerts now flatten nested error objects to avoid React child rendering crashes.
- UX: Decision communication step no longer shows the introductory info alert.
- UX: Denial letter drafting omits Next steps unless a clear remedy exists and avoids carrying generic steps.
- UX: Denial letter prompt now paraphrases assessor input into applicant-facing language instead of repeating labels or form wording.
- UX: Denial letters no longer include the worthiness/judgment reassurance line.
- UX: Denial letter prompt now references applicant-requested program/supports instead of assessor-proposed interventions.
- UX: Denial letters now use narrative paragraphs (no Decision/Reason labels) and focus on requested supports in the opening.
- UX: Communication step now sends letters on completion, hides checklist for denials, and simplifies the letter editor header text.
- UX: Decision letters now start blank unless a draft exists, and denial letters reference requested supports in lower-case phrasing.
- UX: Denial letter drafts now retain assessor-provided suggestions from the denial reason modal.
- UX: Communication step title switches to "Send denial letter" when the decision is not approved.
- UX: Approval letters now use a "Send approval letter" step and the funding checklist moved into a "Complete funding documentation" step that finalizes approved applications.
- UX: Approval letter drafting now lists funded supports with plain-English payment wording and removes label-style formatting.
- UX: Approval letters now aggregate supports across all interventions and paraphrase justification text instead of quoting it.
- UX: Approval letters now always add a second paragraph for authority, payment explanations, and missing-document requirements.
- UX: Approval letter drafts now use a fixed three-paragraph structure with the submission reference/date and per-intervention cost line amounts plus payment methods.
- UX: Decision letter attachments now render funding lists with proper bullet formatting in the portal and PDFs.
- UX: Secure messages now include the full decision letter body in the message text.

## 2026-01-10
- Fix: Assessment intervention total now parses currency values correctly to avoid inflating approval thresholds or dashboard totals.

## 2026-01-09
- UX: Denial letter drafting now collects a single program-level denial reason with a short explanation before generating the AI draft.
- UX: Denial letter AI prompt now enforces authority, non-judgment language, and options-forward requirements without introducing new reasons.

## 2026-01-08
- Ops: Intake uploads now ensure a client record exists pre-upload and pin `client_id` for the session.
- Data: Added `client.applicant_cognito_sub` and `iset_document.client_id` to anchor intake documents to clients.
- Ops: Intake-generated PDFs now attach to the resolved client record.
- Data: Added `iset_document.action_plan_id` + `iset_document_intervention`, expanded `document_type.scope`, and removed `linked_intervention_id`.
- Fix: Aligned `client.applicant_cognito_sub` collation to match `user.cognito_sub` to avoid ER_CANT_AGGREGATE_2COLLATIONS during document uploads.
- UX: Supporting Documents widget now supports action-plan scoping with optional multi-intervention links and updated scope labels.
- Payments: Evidence links now attach at the packet level and require client ID matches when attaching documents.
- UX: Sending decision letters now generates a PDF supporting document tied to the client/application and refreshes the decision checklist.
- Fix: Communication step now loads Gate 6 checklist items and blocks completion until required agreements are present.
- Fix: Checklist progression now skips Gate 1 in admin, enforces Gate 2 on the eligibility step, and enforces Gate 3 for assessment submission before switching to Gate 6.
- Authoring: File-upload components now expose the validation panel and persist rules into published workflows.

## 2026-01-06
- UX: Regional Manager work queue now includes a My Applications bucket for assigned files.
- Fix: Conflict of interest signing now routes no-conflict submissions to step 1 and blocks progress with a modal when a conflict is declared.
- Fix: Work queue escalation actions now open a modal and submit to the escalation API.
- UX: Messaging recipient list now shows region-coded role labels for ISET Coordinators and Regional Managers.
- Fix: Escalation action notes now create case notes automatically.

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

## 2026-01-05
- UX: Combined the payment packet evidence checklist and documents list into a single table in the detail widget.
- UX: Evidence table now lists all packet evidence requirements across lines and shows all attached documents per requirement (no separate document rows).
- UX: Removed the notes section from the payment packet detail widget.
- UX: Evidence table now uses row-level actions to view, link, upload, replace, or unlink supporting documents.
- Payments: Finance submission email now lists document names and includes a 7-day packet bundle download link.
- Payments: Auto-generated draft packets now prefill line items from assessment cost breakdowns, including recurrence and payee inference.
- Fix: Auto-generated payment packets now resolve requester user IDs to avoid FK insert failures.
- UX: Submit-to-finance alerts now summarize policy blockers with line ranges.
- Fix: Payment packet bundle generation now handles typed-array buffers to avoid archiver crashes.
- Access: Archived applications now only appear to System Administrators in application lists and counts.

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
- Docs: Added `docs/data/runtime-config/ai-runtime-config.md` and updated project map notes (cross-app config flow).

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
## 2026-01-19
- Fix: Align MySQL connection collation with event tables to prevent doc-request threshold poll collation errors.

## 2026-01-27
- Cleanup: Removed legacy evaluator/PTMA assignment APIs and UI (intake-officers, PTMA evaluators, assigned evaluator display).
- UX: Secure messaging now relies on sender/recipient names without evaluator lookups.
- DB: Added migration to drop legacy `iset_evaluators` and `iset_evaluator_ptma` tables if present.

## 2026-02-04
- UX: Intacct XML draft preview no longer flags Bill date/Due date as missing while a packet remains in draft status.
- API: Payment packet validation now enforces Intacct REST submission requirements (vendor, GL account, required dimensions) and REST payload includes bill/due dates plus Intacct line fields.
- API: Payment packet validation now syncs packet evidence document IDs into finance transactions for reconciliation.

## 2026-02-10
- Feature: Implemented Tutorials dashboard (`/tutorials-dashboard`) under Support to run hands-on tutorials and view per-staff completion state.
- Feature: Added self-service reset endpoint to clear tutorial completion/dismissal state (`POST /api/me/tutorial-progress/reset`), used by the Tutorials dashboard Actions widget.

## 2026-03-27
- Fix: Case Calendar weekday headers now align with the actual calendar grid in Canadian time zones.
- Fix: Case and application workspace calendar events now keep `YYYY-MM-DD` reminder/action-plan/intervention dates on the intended local calendar day instead of drifting through UTC parsing.
- Fix: Template editor now offers a dedicated environment-aware portal sign-in link insert option instead of only the raw `{portal_dashboard_url}` token, reducing hardcoded portal URL mistakes in applicant notification templates.
- Ops: Reduced the default prod ASG instance-refresh warmup from 900 seconds to 180 seconds in the refresh script and deployment docs so normal rollouts do not pause for an unnecessary 15-minute warmup.

## 2026-02-11
- Fix: Versioned case workspace tutorial to `case-workspace-overview-v2` so updated hotspot mappings (including final step return-to-header) are applied cleanly after prior persisted state.
- Fix: Home intro tour restart now always re-enters through the canonical `tutorials:start` event path, avoiding stale in-memory tutorial state.
- Fix: Home intro role mapping now tolerates underscore/hyphen role keys (for example `ISET_Coordinator`, `Program_Administrator`, `Regional_Manager`).
- Fix: Tutorials now start from a fresh runtime clone (`completed: false`, cloned tasks/steps) so Restart works reliably even after completion state is saved.
- UX copy: Replaced user-facing “bucket(s)” language with “queue(s)” across home intro tutorials, home/work-queue help content, and work-queue widget preferences/empty states.
- Feature: Tutorials dashboard now shows role-relevant tutorials in a table (one row per tutorial) with per-row completion toggles.
- Feature: Tutorial toggle OFF now resets that tutorial progress via single-tutorial reset, while toggle ON marks it completed.
- UX: Refactored tutorials reset action to a dedicated `Reset all tutorial progress` control.
- Docs: Added initial non-System-Administrator workflow inventory tranche (Application Assessment, Case Management, ILMP Reporting, Payments AP Integrations) with workflow docs and widget-level documentation index/files.
## 2026-04-14
- Finance semantics: Re-aligned PATH summaries to treat `Approved` as intervention approval in PATH, `Committed` as payment packets submitted to finance, and `Actual` as PATH-recorded paid spend.
- Home: Metrics widget now reports `Funds approved`, `Funds committed`, and `Funds actual` with those meanings.
- Case workspace: Funding header and Finance panel now separate approved, committed, and actual amounts, and remaining balances subtract both committed and actual.
- Finance budgets: Pot rollups and remaining-balance calculations now derive committed totals from submitted finance transactions rather than approved intervention amounts.

## 2026-04-21
- UX: Batch Payments now behaves as an oversight dashboard, not a second send/edit workbench.
- UX: Finance queue selection is now single-select and no longer auto-loads the first packet when nothing is selected.
- UX: Batch Payments detail is now inspection-only; create/edit/validate/send flows stay in the program workspace.
- UX: Batch Payments communications now clearly switch between active-packet and all-packets views, and the finance page hides manual-log actions.
- UX: SLA snapshot now starts in the widget palette instead of the default Batch Payments layout.

## 2026-04-23
- Security: Fixed public-portal applicant secure-message routing so assigned case managers resolve through staff user accounts instead of overlapping `staff_profiles.id` values, preventing applicant-origin messages from landing in unrelated applicant inboxes.
- Ops: Hardened the in-place TEST admin/portal deploy scripts to remove deployed `node_modules` before remote `npm ci/install`, and updated the deploy docs to treat that as the standard dependency-reinstall rule alongside the already-safe PROD bootstrap path.
- Ops: Added guarded PROD repair SQL to reassign existing misrouted applicant secure messages to the correct staff recipients and remove the wrong mailbox rows before reopening the portal.
- Ops: Restored the PROD public portal after final live verification that the five repaired messages had no remaining unauthorized applicant mailbox rows in any folder state and that both public portal hosts were returning healthy `200 {"status":"ok"}` responses.
- Access control: Regional Managers can no longer record application decisions or intervention proposal/revision decisions; those approval/denial paths are now restricted to NWAC Administrators and System Administrators in both frontend gating and backend enforcement.
- Security: Removed the unused legacy portal `POST /api/case-events` endpoint after confirming the current portal source/build no longer calls it; current intake event capture remains on `/api/draft`, `/api/intake/complete`, `/api/applications`, and `/api/upload-application-file`.
- Security: Removed the unused legacy portal upload-delete alias and the Jordan experiment draft/application lookup endpoints after confirming the current portal source/build no longer calls them; current upload deletion is `DELETE /api/uploads/remove`.
- Maintenance: Removed stale current-portal references to old slot-search/save-draft endpoint names; the dashboard start flow and `DynamicTest` fallback now use only the current draft/intake endpoints.
- Maintenance: Removed orphan current-source leftovers that were not mounted in the live portal server, including the unused test-notification helper, the dead admin-auth-metrics router/snippet pair, and the stale `/api/get-profile` test mock.
- Security: Hardened finance payment routes so audit-owner user IDs now resolve from authenticated staff context on the server and no longer trust caller-supplied actor/requester/verifier ID fields.
- Security: Hardened admin note/reminder/escalation/document audit writes so staff requests now resolve to the real local `user.id` by Cognito subject instead of falling back to `staff_profiles.id` or other raw auth numeric IDs.
- Maintenance: Clarified admin identity semantics by exposing explicit `staffProfileId` values for staff-profile comparisons in backend requester identity and frontend current-user state, while leaving application-lock ownership on its existing opaque actor/subject identity.
- Maintenance: Staff auth hydration now writes an explicit `staffProfileId` field on admin auth state, and shared RBAC/authz helpers now prefer that field for staff assignment scope checks.

## 2026-04-24
- Ops: PROD release `20260424-094930` completed successfully after a failed first attempt exposed an IAM gap in the reduced operator role: `path:deploy` could not finish automatic restore-point capture because `CreateDBClusterSnapshot` also required `rds:AddTagsToResource` on the snapshot resource.
- Ops: Verified before the rerun that DEV and PROD already had identical `intake-release` payloads for workflow `21` and `publish/workflow.schema.intake`, so the successful PROD rerun safely used `--skip-schema --skip-data --skip-build` and rolled only the shared/admin/portal app artifacts.
- Docs: Updated the deploy runbooks to stop claiming restore-point snapshots are currently fully covered by `nwac-prod-codex-operator`, and to require explicit checksum proof before using an app-only rerun to bypass a blocked prod schema/data path.
- Ops/Feedback: Reviewed TEST and PROD admin feedback queues again. TEST still contained only the older 27-report set already represented in PROD, so no TEST-only bug/CR rows were merged. The TEST feedback tables were then cleared with guarded script `sql/ops/test-clear-admin-feedback-log-20260424.sql`, leaving `admin_feedback_report`, `admin_feedback_note`, `admin_feedback_status_history`, and `admin_feedback_attachment` empty in TEST.
- Ops/Data: After Amanda Curtis confirmed `kiyaostisondenisehelen@gmail.com` is Denise Chalifoux's real PATH login, the guarded PROD duplicate-client merge in `sql/ops/prod-merge-denise-chalifoux-client-126-into-108-20260424.sql` was executed successfully. Temporary precautions during the live merge were a manual `application_lock` on application `31` plus a short admin service-announcement banner telling staff to avoid Denise's record until the notice cleared. The merge kept activated client `108` / user `115` as the survivor, repointed case `113`, application `31`, submission `31`, and all linked documents away from duplicate client `126` / user `159`, corrected the remaining `submission_snapshot.user_id` in `iset_application.payload_json` to `115`, then cleared the temporary lock/banner. The merged-away client row was intentionally retained without live references for audit/recovery, and PROD feedback report `#51` was resolved as a data fix rather than a code defect.
- Fix: DEV application-document loading now includes only those historical intake uploads that the current application submission payload proves belong to that application, even when older `application_submission` documents were stored with `application_id = NULL`. The same narrow proof rule now feeds both `/api/applicants/:id/documents` and `/api/applicants/:id/document-checklist`, so application workspaces and compliance checklists recover missing legacy intake files without widening document visibility across multiple applications.

## 2026-04-25
- Ops: PROD release `20260425-100201` completed successfully as a normal full deploy with shared/admin/portal app rollout plus `intake-release` data sync for workflow `21`.
- Ops: The reduced prod operator role's restore-point path is confirmed working again. Release `20260425-100201` automatically captured Aurora cluster snapshot `path-prod-20260425-100201-20260425100220` for `nwac-prod-db`, then finished with all three public prod health checks returning `200 {"status":"ok"}`.
- Docs: Updated the deploy runbooks and standing guidance to remove the stale `rds:AddTagsToResource` caveat now that the repaired IAM policy has been validated by a real full prod deploy.
- Security: Added the post-incident privacy/security review note at `docs/planning/privacy-security-systematic-review-2026-04-25.md`, with the current audit method, fixed exposure classes, and remaining review lanes.
- Security: Hardened admin supporting-document routes so applicant/case document listing, checklist computation, presigned file access, uploads, edits, intervention links, duplication, and deletes now validate case/application/action-plan/intervention/client/payment scope instead of trusting staff auth plus document IDs.
- Security: Hardened finance payment-packet routes so casework payment roles are scoped to their authorized cases, while payment batches and full ledger exports require finance/admin payment access.
- Security: Hardened admin secure-message routes by retiring broad legacy list/create endpoints, requiring case access before case-thread reads or sends, and validating message case context before attachment presign/adoption or mailbox mutation.
- Security: Hardened case notes, reminders, and timeline events so narrative client data is returned or mutated only after case/reminder target scope validation.
- Ops/Security: Fixed the public portal TEST deploy installer so the runtime `auth/` helper is copied to `/opt/nwac/portal/auth` alongside `server.js`; the stale helper had caused real TEST applicant-pool users to fail the new applicant-account gate with `applicant_account_required`.
- Ops/Security: Promoted the public-portal auth helper and legacy-fallback hardening to PROD as portal-only release `portal-auth-helper-copy-20260425-prod`, with no schema/data/admin/shared changes and post-deploy health/runtime-file verification passing.

## 2026-04-26
- Security/DB: Started the DEV privacy ERM cleanup with additive migrations for `iset_case.assigned_staff_profile_id`, typed secure-message actors, message attachment scope, secure-message FKs, and document relationship FKs.
- Security: Hardened secure-message applicant/admin access to typed actor plus case/application scope and moved the main admin/portal secure-message UI response contract away from legacy `sender_id` / `recipient_id` authority.
- Security: Retired the unscoped admin `POST /api/applications/ingest-from-submission` endpoint to prevent new applications without client/case ownership.
- Maintenance/Security: Added explicit staff-profile assignment aliases to high-risk admin API responses and updated the application list, home queues, work-queue table, and application overview to compare assignment through staff-profile IDs first.
- Security/DB: Hardened remaining DEV staff-profile actor references with FKs for admin feedback, CFA, applicant-account invite/event, and tutorial-progress tables.
- Security/DB: Added DEV secure-message/document privacy constraints requiring case-scoped typed message actors, exactly one applicant actor, scoped message attachments, source-specific document lineage, and `RESTRICT` delete rules for privacy-sensitive message/document relationships.
- Security/DB: Hardened DEV signing requests with FKs to workflow, case, participant user, and creator user, plus audit coverage for wrong-applicant and message/case mismatch anomalies.
- Security/DB: Hardened DEV escalation routing and case-task audit users with explicit application/case/user FKs, and made escalation creation fail closed when an application has no case scope.
- Docs: Updated older case/work-queue/data notes to describe case ownership as `assigned_staff_profile_id`, with `assigned_to_user_id` documented only as a transitional legacy fallback.

- Maintenance/Security: Completed the DEV assignment response/event naming cleanup for known lower-risk surfaces. Case creation, assignment/reassignment, applicant application-list responses, frontend assignment aliases, portal auto-assignment events, and shared notification routing now prefer explicit staff-profile IDs while retaining legacy `assigned_to_user_id` / `assigned_user_id` aliases for compatibility.
- Security/DB: Completed the DEV case/application pointer cutover. Runtime code no longer reads or writes `iset_case.application_id`, application ownership is derived from `iset_application.case_id`, and migration `20260427_0013` records row-level legacy pointer audit data before dropping the case-side pointer.
- Security/DB: Hardened DEV application ownership. Public portal, admin/manual intake, demo, and seed paths now insert applications only after resolving the owning case, and migration `20260427_0014` makes `iset_application.client_id` and `iset_application.case_id` required after recording row-level scope audit data.
- Security/DB: Retired DEV application-version author shadow `created_by_id` through migration `20260427_0015` after moving version write/read paths to typed staff-profile/local-user author refs.
- Security/DB: Hardened DEV event-entry actors through migration `20260427_0016`; staff/applicant event rows now require typed actor refs, while raw `actor_id` is retained as audit text only.
- Security/DB: Hardened DEV application/CFA relationship FKs through migration `20260427_0017`, including application submission/version lineage and CFA case/version/document/participant links after recording 0 relationship blockers.
- Security/DB: Hardened remaining DEV relationship FKs through migration `20260427_0018` and retired the empty `zzz_legacy_documents` experiment table through migration `20260427_0019`.
- Security: Added DEV privacy smoke checks for the cleaned ERM and route-scope guard markers.
- Security: Hardened admin allocation evidence uploads/downloads/deletes so object keys require finance role access plus allocation/pot metadata provenance or actor-owned pending-upload scope.
- Security: Hardened workflow/component authoring and legacy raw Nunjucks/blockstep debug routes so authoring is step-editor-only and legacy debug routes require explicit unsafe debug enablement plus System Administrator access.
- Security: Hardened application/case raw-ID surfaces in DEV: case watches, application detail/version/lock routes, escalation create/respond/list, case detail/save, case assignment, conflict actions, and ILMP/ready-to-close actions now validate case/application visibility before returning or mutating data.
- Security: Removed remaining checked shared-user-to-staff-profile email fallback paths in DEV. Portal/admin message, signing, and funding-agreement helper paths now resolve staff profiles from local users by Cognito subject only, and the privacy route smoke prevents those email fallbacks from returning.
- Security: Tightened public portal AI support filtering so both the current prompt and recent chat history are scanned for obvious sensitive content before any OpenRouter request.
- Security: Added route-scope smoke coverage for admin feedback attachments, preserving the rule that attachment presign URLs are only returned from System Administrator report-detail reads.
- Security: Hardened admin OpenRouter surfaces in DEV. Admin AI chat now blocks obvious raw applicant/client identifiers before proxying, denial-letter drafts use local templates instead of sending applicant context externally, and AI dummy-data generators require the unsafe debug gate plus System Administrator access.
- Security: Hardened notification configuration APIs in DEV so notification templates, notification routing rows, and shared sender/reply-to settings require System Administrator or NWAC Administrator access server-side.
- Security: Retired legacy generic `/api/users` shared-table endpoints in DEV so the mixed staff/applicant local `user` table is no longer exposed as a broad directory API.
- Security/Ops: Added the live DEV privacy route-denial smoke harness for real-token checks of wrong-role, wrong-surface, wrong-applicant, generated PDF, finance evidence, payment-packet, and explicit out-of-scope case/application/document access before TEST rehearsal.
- Ops: Tightened the privacy ERM grand cleanup TEST rehearsal runbook with exact preflight, cleanup, migration, smoke, maintenance-window, and blocker-decision steps.

## 2026-04-28
- Fix/Homepage/DEV: Denied applications now leave `Pending Completion` once the denial letter is recorded as sent, so sending the denial letter is treated as the terminal follow-up action without changing the denied outcome status.
- Fix/Approvals/DEV: Intervention approvals opened from the Pending Decision queue still land on `Record of decision`, but the queue-provided step intent is now consumed once so approvers can click earlier wizard steps without being snapped back to the decision step.
- Fix: Case manager assessment PDFs generated from new/revised intervention proposals now populate “Previously funded under the ISET Program” and infer the approved-assessment coordinator agreement checkbox from the proposal decision.
- UX: NWAC Administrators are now exempt from the per-case conflict-of-interest declaration gate in the application assessment/approval widget; the gate still applies to case managers.
- UX: Case Workspace quick actions now relabel the intervention action when a draft, changes-requested, or pending intervention proposal/change already exists, and the action opens that current proposal instead of trying to start a new one.
- Fix: Public portal signing-request completion now materializes embedded applicant upload fields, such as the EFT voided-cheque upload, into scoped `iset_document` rows. The generated signed form PDF and the applicant-provided attachment now both appear in Supporting Documents/checklist scope when the signing request is linked to a case/application.
- Ops/Security: Completed the PROD-like TEST rehearsal for the privacy ERM grand-cleanup release. TEST was restored from sanitized PROD data, side-effect guarded, migrated through `20260427_0020_allow_casefile_secure_message_document_scope.sql`, identity-overlaid for TEST Cognito, and deployed as release `prod-like-privacy-erm-test`; both TEST target groups are healthy and SSM DB smoke checks are clean.
- Security/DB: Added rehearsal-discovered migrations for historical pre-materialisation portal uploads (`legacy_intake_upload` quarantine), application-linked manual/system document applicant-scope backfill, unresolved event actor system reclassification, event actor audit reconciliation, and application-less case-file secure-message document scope.
- Fix/Assessment/DEV: Application assessment submission now fails closed if the required generated PDFs cannot be created and recorded before the Pending Decision status transition commits.
- Ops/Data: Repaired Wabanang Polson's PROD pending-decision application by generating the missing system PDFs for case manager assessment, application form, and financial overview, then verified both DB rows and S3 objects.
- Fix/Migrations/DEV: Made the pending document-scope and event-actor audit reconciliation migrations tolerant of the current one-client/one-case schema by removing the retired `iset_case.application_id` dependency and normalizing the audit/event ID collation comparison; local DEV migrations now plan clean with 0 pending.
- UX/Release Notes/DEV: Regenerated the v0.6.0 landing-page release notes from the PROD feedback queue, replaced inferred Known Issues/Coming Next copy with feedback-derived bullets, removed the pre-sign-in summary sentence, and made optional release-note sections hide when empty.

## 2026-04-30
- Fix/TEST: Deployed `regional-manager-doc-scope-test-20260430` to the admin console so Application Workspace `All documents` sends case scope for Regional Managers and the backend includes the case's primary application documents in case-scoped applicant document reads.
- Ops/Data: Backfilled Hailey Lafrance-Chaput's PROD pending-decision assessment PDFs for application `16` / case `98` (`ISET-20260414-53A087`), generating `Case manager assessment v2` and `Case manager assessment redline v2` with Kelly Hyde's original 2026-04-20 submission signature.
- Ops/Data: Submitted Felicia Erickson's PROD amended application assessment for application `10` / case `92` (`MI-MNTBETVR-00DF7C`) as a repair, generating `Case manager assessment v3` and `Case manager assessment redline v3` signed as case manager Amanda Curtis and moving the application back to Pending Decision.
- Ops/Data: Deleted Felicia Erickson's erroneous duplicate PROD case-workspace intervention proposal `13` / intervention `12` with run id `felicia-delete-duplicate-intervention-proposal-prod-20260430` after the earlier withdrawn state still appeared as a resumable draft in Case Workspace; linked document `1384` was archived and the application assessment v3 remains the active Pending Decision item.
