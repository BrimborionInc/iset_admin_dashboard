# Changelog - Admin Dashboard

Format: YYYY-MM-DD - Category: Short description

## 2026-01-27
- UX: Proposed Interventions widget now includes an info link with dedicated help panel guidance and AI context.
- UX: Proposed Interventions status badge now sits in the header actions next to Save Progress.
- Docs: Rewrote Proposed Interventions help content to align with PATH case management guidance.
- Fix: Proposed Interventions wizard now clears draft data after approvals or rejections so the next proposal starts clean.
- Fix: Rejected interventions can now be deleted from the case workspace.

## 2026-01-28
- Fix: Initial CFA drafts now generate from assessment data when no action plan exists, keeping secure message CFA attachments working before completion.
- Fix: CFA draft generation now uses application submission ownership fields to match the current schema.
- Fix: CFA draft generation now selects the intervention funding stream from the current schema to avoid SQL errors and allow plan-based CFA drafts to generate.

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
