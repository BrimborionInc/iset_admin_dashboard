# Changelog - Admin Dashboard

Format: YYYY-MM-DD - Category: Short description

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
