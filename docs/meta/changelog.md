# Changelog - Admin Dashboard

Format: YYYY-MM-DD - Category: Short description

## 2026-03-25
- UX/API/Configuration: Query Editor now includes a `Server Export` tab with a MySQL Workbench-style object-selection flow for choosing one database, selecting the tables to include, and writing a self-contained SQL dump file directly on the admin server.
- Docs/Configuration: Updated the live Query Editor dashboard reference, help-panel copy, and `docs/AGENTS.md` for the new server export flow, hardwired dump options, and Windows/WSL dump-path behavior.

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
