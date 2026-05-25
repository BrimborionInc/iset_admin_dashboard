# Admin AI Chatbot Coverage Register

Status: current working register
Last updated: 2026-05-07

## Purpose

This is the system-wide coverage register for the admin `Ask the AI` knowledge-base overhaul.

Use it to track which PATH surfaces have verified workflow guidance, policy/process guidance, source refs, and eval coverage. This register exists to prevent the chatbot work from becoming a series of isolated fixes for whatever prompt failed most recently.

## How To Use

- Start here after reading `docs/planning/admin-ai-chatbot-knowledge-base-transformation.md`.
- Treat `inventory-only` as not covered. It means the surface has been identified but does not yet have verified guidance cards and evals.
- Do not mark a surface as `verified` until exact UI behavior has been checked against code/API behavior or an appropriate live environment.
- Run `npm run ai:inventory -- --format=summary` or `npm run ai:inventory -- --format=markdown` before broad coverage updates to refresh the raw route/help/training source map.
- Every knowledge-card task should update one or more rows here.
- Every high-risk workflow should gain at least one eval prompt before it is considered covered.
- `/documentation` training content can supply policy/process expectations, but it does not prove current PATH UI behavior.

## Status Values

| Status | Meaning |
| --- | --- |
| `inventory-only` | Surface/source identified; no curated chatbot guidance coverage yet. |
| `partial` | Some page-local help, `aiContext`, docs, or seeded guidance exists, but coverage is incomplete or untested. |
| `drafted` | Guidance card content exists but has not been fully verified or covered by evals. |
| `verified` | Guidance was checked against implementation/source evidence and has passing eval coverage. |
| `source-only` | Source corpus exists for policy/process extraction, but it is not deployed chatbot guidance. |
| `defer` | Surface is intentionally low priority or legacy/preview-only, with reason recorded. |

## Coverage Priorities

Priority is about execution order, not scope.

| Priority | Meaning |
| --- | --- |
| `P0` | High-risk staff workflow where wrong guidance can create bad casework, privacy, approval, payment, or compliance outcomes. |
| `P1` | Common staff workflow or route likely to generate help questions. |
| `P2` | Admin/config/reporting surfaces where guidance is useful but lower risk. |
| `P3` | Legacy, preview, or narrow technical surfaces. |

## Source Inventory

| Source | Role In Chatbot KB | Status | Notes |
| --- | --- | --- | --- |
| `src/routes/AppRoutes.js` | Route/page inventory and top-level help context wiring. | inventory-only | Initial route inventory below was derived from this file on 2026-05-07. |
| `src/helpPanelContents/*` | Existing staff-facing help and page-local `aiContext`. | partial | Many files have `aiContext`, but they are not equivalent to verified knowledge cards. |
| `docs/widgets/admin/*` | Widget-level reference docs. | partial | Useful for source refs; many docs still need endpoint/UAT detail. |
| `docs/dashboards/*` | Dashboard-level reference docs. | partial | Useful for workflow/queue behavior after code verification. |
| `docs/workflows/admin/*` | Cross-widget workflow docs. | partial | Useful for domain grouping and workflow language. |
| `docs/features/*` and `docs/guides/*` | Feature docs and maintained how-to docs. | partial | Use as source refs after checking current implementation when necessary. |
| `src/documentation/documentationLinks.js` | `/documentation` library catalog. | source-only | Identifies current training documents shown in the admin Guidance Library. |
| `src/documentation/runtime/trainingModules2025.json` | Runtime training module content for `/documentation`. | source-only | Policy/process source corpus; not UI behavior truth. |
| `docs/training/TRAINING_MODULES_September_2025_extracted.md` | Extracted NWAC training/process source. | source-only | Baseline for staff expectations and job-aid language. |
| `src/server/adminAiGuidanceService.js` | Current DB-backed guidance retrieval, seed data, no-match guardrail prompt, and guidance-card schema bootstrap. | partial | Current seed covers application Request Changes review, application missing-document follow-up, homepage Pending Completion, imported/application-less backload guidance, and approved intervention proposal/revision approval-letter follow-up; unmatched help-panel workflow questions now get a strict no-match guard instead of a free general answer. |
| `sql/migrations/20260507_0001_harden_admin_ai_guidance_schema.sql` | Migration record for richer guidance-card and approved-example metadata. | partial | Adds source type/domain/status, workflow states, expected anchors, forbidden patterns, applicability/steps/side-effect/restriction text, review date, example context, source refs, eval fixture IDs, and indexes. |
| `src/AppContent.js` | Help-chat shell, system prompt, page-context payload. | partial | Client prompt still discourages invention; server retrieval/no-match prompts now carry the stricter grounding policy. |
| `isetadminserver.js` `/api/ai/chat` | OpenRouter proxy, privacy filter, guidance/no-match prompt injection, debug-gated guidance diagnostics. | partial | Preserve sensitive-content gates while expanding retrieval; `_guidance` metadata is System Administrator-only and requires `ADMIN_AI_GUIDANCE_DEBUG=true`. |
| `scripts/admin-ai-inventory.js` | Read-only inventory helper for route/help/training source maps. | partial | Run with `npm run ai:inventory -- --format=markdown`, `--format=json`, or `--format=summary`. |
| `docs/testing/admin-ai-chatbot-eval-fixtures.json` | Initial eval fixture set for high-risk prompts. | partial | Fixtures are broad and drafted; source refs must be verified before promotion. |
| `scripts/admin-ai-eval-fixtures-check.js` | Read-only fixture-shape check. | partial | Run with `npm run ai:eval:check`; this does not call OpenRouter. |

## Route Surface Register

Initial route inventory from `src/routes/AppRoutes.js`.

| Route | Surface | Domain | Priority | Current Help Source | KB Status | Next Coverage Work |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Home dashboard | Home / work queues | P0 | `homeDashboardHelp.js`; homepage widget help files | partial | Seeded card now covers Pending Completion purpose/routing. Map remaining role-specific queues, homepage widgets, work-item routing, and common "what do I do next" prompts. |
| `/case-assignment-dashboard` | Manage ISET Applications | Applications / intake triage | P0 | `caseAssignmentDashboardHelp.js`; `applicationsWidgetHelp.js` | inventory-only | Cover filters, assignment, auto-assignment, flagged items, search, status groups, and route to Application Workspace. |
| `/application-case/:id` | Application Workspace | Application assessment | P0 | `applicationCaseDashboardHelp.js`; application widget help files | partial | Seeded cards now cover missing-document follow-up during assessment and Request Changes during application approval review. Convert broader application assessment, approval letters, funding forms/signatures, supporting documents, secure messaging, notes, and events into cards. |
| `/cases/:caseId` | Case Workspace | Case management | P0 | `caseWorkspaceHelp.js`; case-workspace widget help files | partial | Seeded cards now cover backloads and approved intervention proposal/revision approval-letter follow-up; create coverage for case header, participant details, action plans, broader interventions, proposed interventions, documents, messages, notes, finance, compliance, and timeline. |
| `/iset/cases` | Case Management portfolio | Case management | P0 | `portfolioDashboardHelp.js`; `portfolioCasesTableHelp.js` | inventory-only | Cover portfolio filters, assigned/region/global views, case open behavior, status meanings, and quick actions. |
| `/iset/applications/intake` | Manual Application Intake | Intake / applications | P0 | `manualApplicationIntakeHelp.js` | inventory-only | Cover manual-intake limits, step handling, portal-only step omissions, drafts, submission effects, and privacy cautions. |
| `/iset/imports/client-files` | Client Batch Import | Imports / backload | P0 | `clientFileImportDashboardHelp.js`; `clientFileImportWidgetHelp.js`; `docs/guides/client-file-imports.md` | inventory-only | Cover dry-run, commit, application-less cases, imported users, duplicate identity rules, and historical documents. |
| `/support/bugs-change-requests` | Bugs and Change Requests | Support / feedback triage | P0 | `homeSystemAdminFeedbackQueueHelp.js`; `docs/features/admin-feedback-reporting.md` | inventory-only | Cover triage workflow, status changes, notes, PROD feedback resolution logging, and prioritization. |
| `/messages` | Staff Messages | Secure messaging | P0 | message dashboard code; secure-message docs | inventory-only | Cover message dashboard behavior, pinned messages, case-thread vs mailbox state, privacy expectations. |
| `/contact-communications` | Contact Communications | Communications | P1 | `contactCommunicationsHelp.js`; contact widget help files | inventory-only | Cover public contact queue, insights, response handling, and routing boundaries with secure messages. |
| `/manage-notifications` | Manage Notifications | Notifications | P1 | `manageNotificationsHelp.js`; `docs/dashboards/manage-notifications-dashboard.md` | inventory-only | Cover notification setting rows, event keys, owner/watcher scoping, email templates, and safe testing. |
| `/template-editor` | Template Editor | Notifications / templates | P1 | `templateEditorDashboardHelp.js`; `manageTemplatesWidgetHelp.js` | inventory-only | Cover template editing, placeholders, scenarios, unsupported placeholders, and email privacy. |
| `/documentation` | Guidance Library | Training / policy source | P1 | `documentationLinks.js`; `trainingModules2025.json` | source-only | Extract policy/process cards and connect them to PATH workflow cards. |
| `/tutorials-dashboard` | Tutorials Dashboard | Training / onboarding | P1 | `tutorialsDashboardHelp.js`; `docs/features/tutorial-platform.md` | inventory-only | Cover tutorial assignment/status, role filtering, reset behavior, and help relationship. |
| `/configuration-settings` | Configuration Settings | System configuration | P1 | configuration widget help files | inventory-only | Cover AI config, environment, security, locking, SLA, CORS, backend jobs, appearance, secrets, sessions. |
| `/configuration/query-editor` | Query Editor | Configuration / database | P1 | `queryEditorHelp.js`; query editor widget help files | inventory-only | Cover allowed use, result limits, upload behavior, safety, and environment display. |
| `/configuration/applicant-watchlist` | Applicant Watchlist | Configuration / risk flags | P1 | `applicantWatchlistHelp.js`; `docs/dashboards/applicant-watchlist-dashboard.md` | inventory-only | Cover SIN-hash purpose, hit review, false positives, and privacy boundaries. |
| `/admin/upload-config` | File Upload Configuration | Configuration / uploads | P1 | `uploadConfigDashboardHelp.js`; file-upload docs | inventory-only | Cover upload categories, portal behavior, document checklist relationship, and mobile chooser caveat. |
| `/finance/overview` | Finance Overview | Finance | P1 | `financeOverviewHelp.js`; finance widget help files | inventory-only | Cover finance KPIs, deadlines, compliance, budget burn, and status language. |
| `/finance/budgets` | Finance Budgets | Finance | P1 | `financeBudgetsHelp.js`; budget widget help files | inventory-only | Cover hierarchy, active view, saved views, pot details, structure manager, budget burn. |
| `/finance/allocations` | Finance Allocations | Finance | P1 | `financeAllocationsHelp.js`; allocation widget help files | inventory-only | Cover transfers, approvals, history, policy, snapshots, evidence access rules. |
| `/finance/payments` | Finance Payments | Finance / payment packets | P1 | `financePaymentsHelp.js`; payment widget help files; `docs/features/payments-module.md` | inventory-only | Cover payment-packet queues, detail, communications, requests, SLA, type mapping, Intacct sync. |
| `/finance/reconciliation` | Finance Reconciliation | Finance | P1 | `financeReconciliationHelp.js`; reconciliation widget help files | inventory-only | Cover transactions, exception detail, bulk actions, sync status, and evidence. |
| `/finance/reports` | Finance Reports | Finance / reporting | P1 | `financeReportsHelp.js`; financial reports docs; `finance-reports-iset-advances-active-clients` seeded guidance | partial | Annual approved-funding workbook semantics, funded-interventions default, all-approved override, export scope, and PATH payment-follow-up caveat now have verified guidance/eval coverage. Continue only if future report lifecycle, validation, certification, or export-history surfaces return to this route. |
| `/finance/monitoring` | Finance Monitoring | Finance / compliance | P1 | `financeMonitoringHelp.js`; monitoring widget help files | inventory-only | Cover evidence coverage, sampling tasks, findings, bundles, and monitoring workflow. |
| `/finance/forecasting` | Finance Forecasting | Finance | P2 | `financeForecastingHelp.js`; forecasting widget help files | inventory-only | Cover scenario workspace, charts, comparison, commit behavior. |
| `/finance/salaries` | Finance Salaries | Finance | P2 | `financeSalariesHelp.js`; salary widget help files | inventory-only | Cover salary summary, annual entries, controls, allocation relationship. |
| `/finance/settings` | Finance Settings | Finance / configuration | P2 | finance settings widget code/help | inventory-only | Cover payment types, Intacct, email routing, settings overview. |
| `/reporting/data-and-results` | Data and Results | Reporting | P1 | `dataAndResultsDashboardHelp.js`; dashboard docs | inventory-only | Cover operational reporting, filters, exports, and dashboard interpretation. |
| `/reporting/regional-snapshot` | Regional Snapshot | Reporting | P1 | `regionalSnapshotDashboardHelp.js`; regional reporting docs | inventory-only | Cover regional metrics, workbook interpretation, and export behavior. |
| `/reporting-and-monitoring-dashboard` | Reporting and Monitoring | Reporting / legacy | P2 | `reportingAndMonitoring` help key | inventory-only | Decide whether this route is current, legacy, or should be deferred. |
| `/esdc/overview` | ESDC Overview | ESDC / ILMP | P1 | `esdcOverviewHelp.js`; ESDC widget help files | inventory-only | Cover KPIs, readiness, submission activity, deadlines, validation summary. |
| `/esdc/participants` | ESDC Participants | ESDC / ILMP | P1 | `esdcParticipantsHelp.js`; participant widget help files | inventory-only | Cover participant queue, validation, readiness, and history. |
| `/esdc/participants/:clientId` | ESDC Participant Workspace | ESDC / ILMP | P1 | `esdcSubmissionDashboardHelp.js`; participant workspace help files | inventory-only | Cover payload preview, submission history, readiness checklist, validation, notes. |
| `/esdc/reporting` | ESDC Reporting Packages | ESDC / ILMP | P1 | `esdcReportingHelp.js`; `docs/workflows/admin/ilmp-reporting.md` | inventory-only | Cover reporting checklist, status, notes, batch submission, packages. |
| `/manage-components` | Intake Step Library | Workflow Studio | P1 | `manageIntakeStepsHelpPanel.js`; step-library widget help | inventory-only | Cover step library, modify step, preview, conditional visibility, supported component types. |
| `/modify-component/:id` | Modify Intake Step | Workflow Studio | P1 | `modifyIntakeStep.js`; component/widget help files | inventory-only | Cover editing step/component props, preview limits, save/publish implications. |
| `/manage-workflows` | Manage Workflows | Workflow Studio | P1 | `manageWorkflowsHelpPanel.js`; workflow widget help files | inventory-only | Cover workflow library, properties, runtime schema, preview, publishing. |
| `/modify-workflow` | Modify Workflow | Workflow Studio | P1 | `modifyWorkflow` help key; workflow-studio docs | inventory-only | Cover canvas editing, session storage, save/load, publish flow. |
| `/configuration/events` | Event Capture Configuration | Configuration / events | P2 | `eventCapture` help key | inventory-only | Cover event catalog/config behavior and notification relationship. |
| `/manage-security-options` | Manage Security Options | Configuration / security | P2 | security/encryption help files | inventory-only | Cover security settings, encryption, secret rotation intent, and safe admin scope. |
| `/access-control` | Access Control | Configuration / RBAC | P2 | access-control code/help | inventory-only | Cover role matrix, route access, admin-only editing, and default deny behavior. |
| `/user-management-dashboard` | User Management | Staff/applicant administration | P1 | `userManagement` help key; `docs/features/user-management.md` | inventory-only | Cover staff profile editing, display name, applicants, Cognito subject rules, region scope. |
| `/ptma-management` | Manage PTMAs | Configuration / locations | P2 | `manageLocationsHelp.js` | inventory-only | Cover PTMA/location administration and downstream effects. |
| `/locations-management-dashboard` | Manage Locations | Configuration / locations | P2 | `manageLocationsHelp.js` | inventory-only | Determine whether this route is current or legacy alias. |
| `/modify-ptma/:id` | Modify Location | Configuration / locations | P2 | `modifyPtma` help key | inventory-only | Cover edit behavior if route remains current. |
| `/new-location` | New PTMA | Configuration / locations | P2 | `newPtma` help key | inventory-only | Cover create behavior if route remains current. |
| `/nwac-hub-management` | NWAC Hub Management | Configuration / legacy | P3 | none identified in route wrapper | inventory-only | Verify current use and whether to defer. |
| `/job-bank-search` | Job Bank Search | Integrations | P2 | `jobBankSearchHelp.js` | inventory-only | Cover search behavior, job selection, and integration limits. |
| `/iset/payments` | Program Payments | Casework / payments | P1 | payment docs/help | inventory-only | Verify relationship to finance payment module and casework payment scope. |
| `/book-appointment-q1` through `/book-appointment-q8` | Book Appointment previews | Legacy previews | P3 | `bookAppointmentQ*` help keys | defer | Decide if these preview routes are still reachable/needed before writing cards. |

## Widget / Help Coverage Groups

This section groups known help-panel files into coverage domains. It is not exhaustive proof of behavior.

| Domain | Help Sources | Current Status | Notes |
| --- | --- | --- | --- |
| Home and work queues | `homeDashboardHelp.js`, `homeWorkQueueHelp.js`, `homeWorkQueueItemsHelp.js`, `homeCoordinatorWorkQueueHelp.js`, `homeApprovalsItemsHelp.js`, `homeMetricsHelp.js`, `homeWatchlistHelp.js`, `homeRecentActivityHelp.js`, System Admin home widget help files | partial | Pending Completion has a verified seeded card. Remaining work needs role-specific queue and item-routing cards. |
| Application assessment | `applicationCaseDashboardHelp.js`, `applicationAssessmentHelp.js`, `applicationOverviewHelp.js`, `isetApplicationFormHelpPanelContent.js`, `applicationsWidgetHelp.js`, `applicationEventsHelp.js` | partial | Missing-document follow-up and Request Changes review have verified seeded cards. Broader assessment, approval, and post-decision guidance cards/evals are still missing. |
| Case management | `caseWorkspaceHelp.js`, `caseWorkspaceCaseHeaderHelp.js`, `caseWorkspaceParticipantDetailsHelp.js`, `caseWorkspaceActionPlansHelp.js`, `caseWorkspaceInterventionsHelp.js`, `caseWorkspaceProposedInterventionsHelp.js`, `supportingDocumentsHelp.js`, `secureMessagesHelpPanelContent.js`, `caseNotesHelp.js`, `caseCalendarHelp.js`, `caseWorkspaceTimelineHelp.js`, `caseWorkspaceFinancePanelHelp.js`, `caseWorkspaceCompliancePanelHelp.js` | partial | Current DB guidance covers imported/application-less backloads and the approved intervention proposal/revision approval-letter follow-up. Most case-workspace surfaces still need cards and evals. |
| Intake authoring and workflow studio | `manageWorkflowsHelpPanel.js`, `workflowLibraryWidgetHelp.js`, `workflowPropertiesWidgetHelp.js`, `workflowPreviewWidgetHelp.js`, `workflowRuntimeSchemaWidgetHelp.js`, `manageIntakeStepsHelpPanel.js`, `modifyIntakeStep.js`, `intakeStepLibraryWidgetHelp.js`, `previewIntakeStepWidgetHelp.js`, `previewNunjucksWidgetHelp.js` | inventory-only | Needs authoring vs runtime distinction and portal parity warnings. |
| Documents and checklist | `supportingDocumentsHelp.js`, `documentChecklistConfigHelp.js`, upload config help, file-upload docs | partial | Missing application-document follow-up has a verified seeded card. Remaining high-risk work: checklist runtime config, manual upload scope, portal upload behavior. |
| Secure messaging and communications | `secureMessagesHelpPanelContent.js`, `contactCommunicationsHelp.js`, `contactMessageQueueHelp.js`, `contactMessageInsightsHelp.js` | inventory-only | Must preserve privacy/message participant guardrails. |
| ESDC / ILMP reporting | `esdcOverviewHelp.js`, `esdcParticipantsHelp.js`, `esdcSubmissionDashboardHelp.js`, `esdcReportingHelp.js`, all ESDC widget help files | inventory-only | Needs validation/readiness/export cards and policy wording. |
| Finance | finance overview/budgets/payments/allocations/reconciliation/reports/monitoring/forecasting/salaries help files | inventory-only | Large domain; needs payment-packet and reporting semantic precision. |
| Notifications and templates | `manageNotificationsHelp.js`, `templateEditorDashboardHelp.js`, `manageTemplatesWidgetHelp.js`, notification feature docs | inventory-only | Needs event-key, recipient scoping, template-placeholder, and email privacy cards. |
| Configuration and security | `aiConfigWidgetHelp.js`, `environmentWidgetHelp.js`, `secretsWidgetHelp.js`, `lockingSettingsHelp.js`, `slaWidgetHelp.js`, `corsOriginsWidgetHelp.js`, `sessionAuditWidgetHelp.js`, `backendJobsWidgetHelp.js`, `encryptionSettingsHelp.js`, access-control pages | inventory-only | Needs admin-only scope, debug-route, and operational-safety guidance. |
| Reporting and imports | `dataAndResultsDashboardHelp.js`, `regionalSnapshotDashboardHelp.js`, `clientFileImportDashboardHelp.js`, `clientFileImportWidgetHelp.js` | inventory-only | Needs source-of-truth and import/backload cards. |
| Support and tutorials | `adminFeedbackHelp.js`, `homeSystemAdminFeedbackQueueHelp.js`, `tutorialsDashboardHelp.js`, tutorial docs | inventory-only | Needs triage workflow and tutorial platform cards. |

## Training / Policy Coverage Register

Initial top-level sections from `src/documentation/runtime/trainingModules2025.json`.

| Training Section | Policy / Process Themes | PATH Linkage Needed | KB Status |
| --- | --- | --- | --- |
| Section 1 - Program overview, mandate, and eligibility | Contribution agreement, NWAC/PTMA context, eligibility, Status/Treaty Card, self-declaration. | Application assessment, supporting documents, intake eligibility explanations. | source-only |
| Section 2 - Interventions and funding streams | Intervention types, research, employability dimensions, resumes, multiple interventions, ITP/TWS/JCP/SEB/group training. | Case Workspace interventions, proposed interventions, action plans, approval rationale. | source-only |
| Section 3 - Delivery, case management, planning, outreach | Case manager role, workplans, ongoing communication, progress tracking, problem solving, follow-up, closure, partnerships. | Home queues, Case Workspace, notes, reminders, secure messages, closure. | source-only |
| Section 4 - Intake and processing | Client application, EI/LMDA, EI verification, client file setup, acknowledgement, document follow-up, compliance. | Manage ISET Applications, Manual Intake, Application Workspace, Supporting Documents, EI status verification. | source-only |
| Section 5 - Before approval | Pending application handling, ID, consents, authorizations, CRA reminders. | Application assessment, document checklist, secure messages, forms/signing. | source-only |
| Section 6 - Financial overview and verification | Monthly budget, income verification, expenses, childcare, accommodation, transportation. | Application assessment, living allowance decisions, supporting documents, finance context. | source-only |
| Section 7 - Living allowance | Eligibility, eligible expenses, attendance reporting. | Application/intervention funding decisions, checklist requirements, follow-up reminders. | source-only |
| Section 8 - Eligible expenses and documentation standards | Program/employment expenses, Band/Treaty letters, acceptance letters, fees, tuition, equipment, disability/dependent care. | Document checklist, Supporting Documents, intervention funding lines, assessment decisions. | source-only |
| Section 9 - Assessment, approval, and funding agreements | Case manager assessment, recommendation, approval, Client Funding Agreement. | Application Assessment, Intervention Assessment, approval letters, funding forms/signatures. | source-only |
| Section 10 - Reporting, EI Section 25/ATQ, hardship, records, contacts | Reporting, active client spreadsheet, minimum service level, ATQ, hardship repayment, program records, contacts. | ESDC/ILMP, reporting dashboards, case closure, communications, records completeness. | source-only |

## Cross-Domain Concepts To Card Once

These concepts appear across many surfaces and should become reusable guidance cards or shared snippets:

- Sensitive data and AI privacy boundaries.
- Application vs case vs client model.
- Assignment, owner, watcher, and region scope.
- Case notes as durable documentation.
- Secure Messaging vs Contact Communications.
- Supporting Documents scope: application, case, client, action plan, intervention, payment context.
- Application assessment lifecycle vs case lifecycle.
- Intervention proposal review state vs intervention delivery state.
- Pending Decision vs Pending Completion.
- Approval letters vs funding forms/signatures.
- Historical/imported backload vs live PATH workflow.
- Payment packets vs approved intervention funding.
- ESDC/ILMP readiness vs internal PATH status.
- Training/policy guidance vs current UI behavior.

## Initial Eval Backlog

These prompts seed the whole-system eval suite. Each should be expanded with route/help/role context, required anchors, forbidden phrases, and expected source refs.

The fixture source is `docs/testing/admin-ai-chatbot-eval-fixtures.json`; run `npm run ai:eval:check` after edits.

| Domain | Prompt | Status |
| --- | --- | --- |
| Case Management | How do I prepare approval letters for approved new interventions? | verified guidance card seeded |
| Home / Queues | What is Pending Completion for? | verified guidance card seeded |
| Imports / Backload | Can I backload an active intervention? | backlog |
| Application Assessment | What do I do when required documents are missing? | verified guidance card seeded |
| Application Assessment | How do I request changes instead of approving an application? | verified guidance card seeded |
| Living Allowance | What documentation is needed before recommending a living allowance? | backlog |
| Supporting Documents | Where should I upload a Band/Nation funding decision letter? | backlog |
| Secure Messaging | Should I send a secure message or use Contact Communications? | backlog |
| Case Notes | Where do I record missing-document follow-up attempts? | backlog |
| ESDC / ILMP | Why does an intervention with a planned end date not require an outcome yet? | backlog |
| Finance / Payments | Does approving an intervention create a payment packet? | backlog |
| Notifications | Why did only the owner receive an applicant secure-message alert? | backlog |
| Workflow Studio | Why does Manual Intake skip upload/signature steps? | backlog |
| Public Portal Relationship | Does admin preview exactly match public portal behavior? | backlog |

## Work Log

- 2026-05-07: Created initial coverage register from `src/routes/AppRoutes.js`, help-panel files, widget/dashboard/workflow docs, and the `/documentation` training corpus. Most surfaces are intentionally `inventory-only`; this is the baseline for systematic coverage work, not a claim that chatbot guidance is complete.
- 2026-05-07: Added `scripts/admin-ai-inventory.js` / `npm run ai:inventory` as a read-only helper to regenerate the raw route, help-panel, training-section, and docs-group inventory before broad coverage updates.
- 2026-05-07: Added `docs/testing/admin-ai-chatbot-evals.md`, `docs/testing/admin-ai-chatbot-eval-fixtures.json`, and `npm run ai:eval:check` as the initial eval scaffold for broad coverage work.
- 2026-05-07: Added debug-gated `_guidance` response metadata for System Administrators when `ADMIN_AI_GUIDANCE_DEBUG=true`, so no-match and matched-guidance behavior can be inspected during coverage work.
- 2026-05-07: Hardened the guidance-card schema and seed format with source type/domain/status, workflow states, expected anchors, forbidden phrases, applicability, steps, side effects, restrictions, example context, source refs, eval fixture IDs, and managed migration coverage.
- 2026-05-07: Added a no-match prompt guard for help-panel chat so workflow-specific questions without curated guidance are answered as not yet verified instead of filled in from generic SaaS assumptions.
- 2026-05-07: Added the first verified workflow card for approved new/revised intervention approval-letter follow-up from Case Workspace, with source refs and eval fixture linkage.
- 2026-05-07: Added a verified workflow card for homepage Pending Completion purpose/routing, covering application post-decision follow-through and approved intervention proposal/revision letter follow-up.
- 2026-05-07: Added a verified workflow card for missing required documents during application assessment, tying Supporting Documents checklist review to Secure Messaging requests and Notes/Case Notes follow-up documentation.
- 2026-05-07: Added a verified workflow card for Application Approval `Request Changes`, including the required Request Changes note, Case Notes side effect, and non-denial/non-letter guardrails.
