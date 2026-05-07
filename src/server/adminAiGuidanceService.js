const HELP_PANEL_SURFACE = "help-panel";
const ENTRY_TABLE = "admin_ai_guidance_entry";
const EXAMPLE_TABLE = "admin_ai_guidance_example";

const SEEDED_GUIDANCE_ENTRIES = [
  {
    slug: "case-intervention-approval-letter-followup",
    title: "Approved intervention proposal approval-letter follow-up",
    surface: HELP_PANEL_SURFACE,
    priority: 135,
    sourceType: "workflow",
    coverageDomain: "Case management / Intervention approval follow-up",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/cases/:caseId"],
    helpTitles: [
      "Case Workspace",
      "Interventions",
      "Intervention Assessment",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "approval letters",
      "intervention proposal",
      "approved intervention",
      "pending completion",
      "letter follow-up",
    ],
    keywords: [
      "approval letter",
      "approval letters",
      "approved new intervention",
      "approved intervention",
      "prepare approval letters",
      "generate drafts",
      "send client approval letter",
      "client approval letter",
      "institution letter",
      "loan provider",
      "other funder",
      "intervention proposal",
      "funding revision letter",
    ],
    stateHints: ["intervention-approval-followup"],
    workflowStates: ["approved", "approval_follow_up", "approved_letter_pending", "communication"],
    sourceRefs: [
      "src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx",
      "src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx",
      "src/utils/interventionStatus.js",
      "docs/widgets/admin/interventions-widget.md",
      "docs/widgets/admin/intervention-assessment-widget.md",
    ],
    expectedAnchors: [
      "Case Workspace",
      "Interventions",
      "Prepare approval letters",
      "Approval letters",
      "Generate drafts",
      "Client letter",
      "Send client approval letter",
    ],
    doNotSay: [
      "Approvals area",
      "Generate Approval Letter",
      "equivalent letter/print action",
      "record toolbar",
      "select the correct approval letter template",
      "sends institution letters automatically",
      "intervention denial letter",
    ],
    applicabilityText:
      "Use when staff ask how to prepare, review, send, or finish approval letters for approved new intervention proposals or approved intervention revisions.",
    stepsText:
      "Open the client in Case Workspace. In the Interventions widget, find the approved intervention proposal or approved revision with letter follow-up pending. Use Actions > Prepare approval letters for a new proposal, or Prepare funding revision letter for an approved revision. PATH opens the intervention approval follow-up on the Approval letters/Funding revision letters communication step. Select Generate drafts, review and edit the Client letter tab, then review or edit Institution letter, Loan provider letters, and Letters to other funders when those tabs contain generated letters. Use Send client approval letter for a new approved intervention, or Send client funding revision letter for an approved revision.",
    sideEffectsText:
      "Sending the client letter records the approval-letter follow-up as sent on the durable intervention, clears the pending letter follow-up, and stops that approved proposal or revision from blocking the next proposal/revision workflow. The client send attaches the client approval letter with the applicable funding forms; institution, loan-provider, and other-funder letters are reviewed or downloaded for manual handling.",
    restrictionsText:
      "This follow-up is only for approved new intervention proposals and approved applied revisions. Ordinary historical/backloaded approved interventions do not unlock this workflow merely because their status is approved, planned, or in progress. Denied or changes-requested intervention proposals do not show an intervention denial-letter path.",
    answerStyleText:
      "Give the Case Workspace path first. Distinguish new intervention approval letters from funding revision letters only when relevant. Explicitly say supporting institution/funder letters are not auto-sent by PATH.",
    guidanceText:
      "Approved new intervention proposals and approved intervention revisions are completed from Case Workspace, not from a generic Approvals area. The Interventions widget exposes the row action `Prepare approval letters` for an approved new intervention proposal whose approval-letter follow-up is still pending. The action opens the intervention approval follow-up directly on the `Approval letters` communication step, where staff use `Generate drafts`, review and edit the letter tabs, and then use `Send client approval letter` for the client-facing send. Institution, loan-provider, and other-funder letters are supporting outputs that staff review or download for manual handling; PATH does not automatically send those supporting letters.",
  },
  {
    slug: "home-pending-completion-purpose",
    title: "Pending Completion queue purpose and routing",
    surface: HELP_PANEL_SURFACE,
    priority: 132,
    sourceType: "workflow",
    coverageDomain: "Home / Work Queues",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/"],
    helpTitles: [
      "Home Dashboard",
      "Work Queue",
      "Work Queue Items",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "pending completion",
      "post-decision",
      "work queue",
      "approval letters",
      "funding forms",
      "intervention proposal",
    ],
    keywords: [
      "pending completion",
      "completion queue",
      "post decision",
      "post-decision",
      "approval letters",
      "funding forms",
      "funding forms and signatures",
      "approved application",
      "denied application",
      "approved intervention proposal",
      "approved intervention revision",
      "what is pending completion",
      "why pending completion",
    ],
    stateHints: ["home-work-queue", "pending-completion"],
    workflowStates: ["pending-completion", "pending_completion", "completion", "post_decision"],
    sourceRefs: [
      "src/pages/home/HomeDashboardPage.jsx",
      "src/pages/home/widgets/WorkQueueItemsTableWidget.js",
      "src/helpPanelContents/homeWorkQueueHelp.js",
      "src/helpPanelContents/homeWorkQueueItemsHelp.js",
      "docs/dashboards/admin-home-my-work-widget.md",
    ],
    expectedAnchors: [
      "post-decision",
      "approval letters",
      "funding forms and signatures",
      "approved intervention proposal",
      "approved intervention revision",
      "completed or closed",
      "open the workspace",
    ],
    doNotSay: [
      "completed applications only",
      "closed cases",
      "archive queue",
      "decision queue",
      "assign from Pending Completion",
    ],
    applicabilityText:
      "Use when staff ask what the homepage Pending Completion queue means, why a file appears there, or what to do next from that queue.",
    stepsText:
      "On the Home Dashboard, select Pending Completion in the Work Queue. In Work Queue Items, open the item name. Application rows open Application Workspace with an explicit post-decision step: Approval letters first, then Funding forms and signatures after the approval letter has been sent. Approved new intervention proposal and approved intervention revision rows open Case Workspace on the intervention approval-letter follow-up.",
    sideEffectsText:
      "Pending Completion does not itself complete, close, archive, assign, or decide the file. It is a launch queue for outstanding post-decision work. Application rows remain until the application workflow is completed or closed. Approved intervention proposal/revision rows remain until the intervention-scoped client approval/funding revision letter is sent.",
    restrictionsText:
      "Do not describe Pending Completion as a queue of already completed or archived records. It intentionally includes decision-recorded approved or denied application files that still need follow-through. It does not include ordinary approved/planned interventions, historical/backloaded interventions, or auto-assessment interventions created by an application approval.",
    answerStyleText:
      "Lead with the queue's purpose, then split application rows from intervention proposal/revision rows. Tell staff to open the item name; do not imply there is a default inline action.",
    guidanceText:
      "`Pending Completion` is the post-decision follow-through queue. It is for work where the decision has been recorded but PATH still needs letters, funding-form/signature work, final checklist/closeout, or intervention approval-letter follow-up before the file is truly complete. Application rows stay there until the application is completed or closed; approved application rows route first to `Approval letters`, then to `Funding forms and signatures` after the approval letter is sent. Approved new intervention proposals and approved intervention revisions also appear there until the intervention-scoped client approval or funding revision letter is sent. Staff normally open the row through the item name and complete the work in Application Workspace or Case Workspace.",
  },
  {
    slug: "application-missing-documents-followup",
    title: "Application assessment missing-document follow-up",
    surface: HELP_PANEL_SURFACE,
    priority: 130,
    sourceType: "workflow",
    coverageDomain: "Application Assessment / Supporting Documents",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/application-case/:id"],
    helpTitles: [
      "Application Workspace",
      "Application assessment workflow",
      "Supporting Documents",
      "Secure Messaging Help",
      "Case Notes",
      "Notes and Tasks",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "missing documents",
      "supporting documents",
      "document checklist",
      "secure messaging",
      "case notes",
      "application assessment",
    ],
    keywords: [
      "missing documents",
      "required documents",
      "documents missing",
      "missing information",
      "request documents",
      "request missing documents",
      "supporting documents",
      "document checklist",
      "checklist",
      "secure messaging",
      "case notes",
      "notes and tasks",
      "follow-up attempts",
      "application assessment",
    ],
    stateHints: ["application-assessment", "missing-documents"],
    workflowStates: ["submitted", "in_review", "docs_requested", "awaiting_applicant"],
    sourceRefs: [
      "src/helpPanelContents/applicationCaseDashboardHelp.js",
      "src/helpPanelContents/applicationAssessmentHelp.js",
      "src/helpPanelContents/supportingDocumentsHelp.js",
      "src/helpPanelContents/secureMessagesHelpPanelContent.js",
      "src/helpPanelContents/caseNotesHelp.js",
      "docs/planning/document-checklist-config-widget.md",
      "docs/training/TRAINING_MODULES_September_2025_extracted.md",
    ],
    expectedAnchors: [
      "Supporting Documents",
      "Checklist",
      "Secure Messaging",
      "New Message",
      "Notes and Tasks",
      "document follow-up attempts",
      "save a draft",
    ],
    doNotSay: [
      "email only",
      "approve while waiting",
      "ignore the checklist",
      "submit the assessment anyway",
      "delete the application",
    ],
    applicabilityText:
      "Use when staff ask what to do during application assessment when required checklist evidence, verification, forms, or clarification are missing.",
    stepsText:
      "Open the Application Workspace. Use Supporting Documents > Checklist to identify the required items that are missing or not counting. If a document is present but not counting, fix the document type or attachment scope in Supporting Documents. If the applicant needs to provide information, use Secure Messaging > New Message to request the missing documents or clarification. Save the assessment as a draft instead of submitting a recommendation that depends on missing evidence. Record the outreach, deadline, and follow-up attempts in Notes and Tasks/Case Notes, using follow-up dates when a reminder is needed.",
    sideEffectsText:
      "Secure-message attachments that staff open/adopt are copied into Supporting Documents for future reference, where labels and document types can be corrected. Case Notes follow-up dates create reminders on the Case Calendar. The training baseline expects applicant contact and missing-information requests to be documented; processing timelines run from receipt of all required documents.",
    restrictionsText:
      "Do not tell staff to approve, deny, or submit while required evidence is still missing unless the assessment recommendation is explicitly based on the documented absence of required evidence. Do not treat external email alone as the PATH record; important requests and outcomes need to be reflected in the file.",
    answerStyleText:
      "Give the operational path in order: identify the checklist gap, request the missing item, document the attempt, and keep the assessment in draft until the evidence/rationale is ready.",
    guidanceText:
      "When required documents are missing during Application Assessment, staff should work from the Application Workspace instead of relying on informal outside follow-up. Use `Supporting Documents` and its `Checklist` tab to identify what is missing or incorrectly classified. Use `Secure Messaging > New Message` to ask the applicant for missing documents or clarification when PATH messaging is available. Keep the assessment as a draft until the evidence needed for the recommendation is present, or until the documented lack of evidence is itself part of the recommendation. Record applicant contact, deadlines, and follow-up attempts in `Notes and Tasks` / `Case Notes` so the file has an audit trail.",
  },
  {
    slug: "application-request-changes-review",
    title: "Application approval Request Changes decision",
    surface: HELP_PANEL_SURFACE,
    priority: 128,
    sourceType: "workflow",
    coverageDomain: "Application Assessment / NWAC Review",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/application-case/:id"],
    helpTitles: [
      "Application Approval Help",
      "Application assessment workflow",
      "Application Workspace",
      "Help and Tutorials",
    ],
    roles: [
      "NWAC Administrator",
      "Regional Manager",
      "System Administrator",
    ],
    topicTags: [
      "request changes",
      "nwac review",
      "approval and decision",
      "application approval",
      "case notes",
    ],
    keywords: [
      "request changes",
      "request change",
      "send back",
      "push back",
      "push_back",
      "instead of approving",
      "not approve yet",
      "approval and decision",
      "funding decision",
      "request changes note",
      "case manager",
      "coordinator updates",
    ],
    stateHints: ["application-approval", "request-changes"],
    workflowStates: ["pending_approval", "pending_decision", "in_review", "decision"],
    sourceRefs: [
      "src/widgets/CoordinatorAssessmentWidget.js",
      "src/helpPanelContents/applicationAssessmentHelp.js",
      "docs/widgets/admin/application-assessment-widget.md",
      "isetadminserver.js",
    ],
    expectedAnchors: [
      "Application Approval",
      "Approval and decision",
      "Funding Decision",
      "Request Changes",
      "Request Changes note",
      "Commit",
      "Case Notes",
      "coordinator",
    ],
    doNotSay: [
      "deny the application",
      "edit the applicant submission directly",
      "delete the assessment",
      "approve and fix later",
      "send an approval letter",
    ],
    applicabilityText:
      "Use when an NWAC reviewer or administrator asks how to send an application assessment back for changes instead of approving or denying it.",
    stepsText:
      "Open the application in Application Workspace/Application Approval review. On Approval and decision, review the case manager recommendation and rationale, then set Funding Decision to Request Changes. Enter the required Request Changes note explaining what needs correction or clarification. Commit the decision.",
    sideEffectsText:
      "Request Changes returns the assessment to the coordinator/case manager for updates instead of unlocking approval or denial communication. PATH stores the request-changes reason, emits the NWAC review changes-requested event, refreshes the workspace, and writes the reviewer note into Case Notes/Notes and Reminders for audit visibility.",
    restrictionsText:
      "Use Request Changes when the assessment needs correction or clarification. Do not tell reviewers to deny merely because changes are needed, do not edit the applicant submission directly, and do not send approval/denial letters from this path.",
    answerStyleText:
      "Answer from the reviewer perspective. Keep the distinction clear: Request Changes is neither approval nor denial; it sends the assessment back with a required note.",
    guidanceText:
      "`Request Changes` is recorded from the Application Approval review inside Application Workspace. In `Approval and decision`, the reviewer selects `Request Changes` under `Funding Decision`, enters the required `Request Changes note`, and commits the decision. PATH sends the assessment back to the coordinator/case manager for updates, records the note in Case Notes/Notes and Reminders, and logs the changes-requested review outcome. It is not the same as denying the application and it does not start approval-letter or denial-letter communication.",
  },
  {
    slug: "case-backload-overview",
    title: "Imported/application-less backload overview",
    surface: HELP_PANEL_SURFACE,
    priority: 120,
    sourceType: "workflow",
    coverageDomain: "Case management / Backload",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/cases/:caseId", "/application-case/:id"],
    helpTitles: [
      "Case Workspace",
      "ISET Application Assessment",
      "Help and Tutorials",
      "Application assessment workflow",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: ["backload", "imported file", "application-less", "historic records"],
    keywords: [
      "backload",
      "existing intervention",
      "historic intervention",
      "historical intervention",
      "active intervention",
      "application-less",
      "imported client",
      "pre-path",
      "historic and active interventions",
    ],
    stateHints: ["applicationless", "cross-workspace"],
    workflowStates: ["applicationless", "imported", "historical_backload"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    expectedAnchors: [
      "Case Workspace",
      "Case Header",
      "Add existing action plan",
      "Add existing intervention",
      "Upload existing documents",
    ],
    doNotSay: ["CSV import", "bulk upload", "create a fake application"],
    applicabilityText:
      "Use when staff ask how to record pre-PATH, imported, application-less, or already-existing client-file records.",
    answerStyleText:
      "Lead with the correct PATH workspace and control. If the user is in Application Assessment, explicitly say the backload workflow belongs in Case Workspace.",
    restrictionsText:
      "These historical entry points must not be described as normal approval, payment, checklist, or applicant-notification workflows.",
    guidanceText: `When staff ask how to record pre-PATH or imported-file history, explain that the approved workflow is in Case Workspace, not in the Application Assessment widget. The correct entry points are the Case Header quick actions \`Add existing action plan\`, \`Add existing intervention\`, and \`Upload existing documents\`. Use those quick actions only when the plan, intervention, or document already existed before PATH go-live or before the client had a real PATH application. These are silent historical entry points: they do not start approval routing, checklist progression, payment packets, or applicant notifications.`,
  },
  {
    slug: "case-backload-intervention-lifecycle",
    title: "Backloaded intervention lifecycle guardrails",
    surface: HELP_PANEL_SURFACE,
    priority: 115,
    sourceType: "workflow",
    coverageDomain: "Case management / Backload",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/cases/:caseId", "/application-case/:id"],
    helpTitles: ["Case Workspace", "ISET Application Assessment", "Help and Tutorials"],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: ["intervention", "lifecycle", "status", "active plan"],
    keywords: [
      "existing intervention",
      "active intervention",
      "historic intervention",
      "archived plan",
      "closed plan",
      "completed intervention",
      "cancelled intervention",
      "in progress intervention",
      "suspended intervention",
      "end date",
    ],
    stateHints: ["applicationless"],
    workflowStates: ["applicationless", "imported", "historical_backload"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceInterventionsHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    expectedAnchors: [
      "archived plans are blocked",
      "closed plans only accept completed or cancelled interventions",
      "active plan",
      "real end date",
      "outcome",
    ],
    doNotSay: ["starts approval routing", "creates a payment packet"],
    applicabilityText:
      "Use when staff ask which intervention statuses are allowed during historical/imported backload.",
    answerStyleText:
      "When listing rules, keep them concrete and operational: archived plans blocked, closed plans limited to completed/cancelled, active statuses require an active plan, and completed historical records need real dates/outcomes.",
    restrictionsText:
      "Do not describe backload as a way to bypass normal proposal approval for new post-go-live services.",
    guidanceText: `Backloaded interventions must preserve the real plan and intervention lifecycle state. Archived plans cannot receive backloaded interventions. Closed plans only accept completed or cancelled interventions. In-progress or suspended interventions require an active plan. Completed or cancelled historical interventions need the real end date and outcome details recorded. If the user asks about both historic and active interventions, explain that ongoing pre-PATH services may still be backloaded, but they must be attached to an active plan and entered with their real current lifecycle state.`,
  },
  {
    slug: "case-backload-finance-history",
    title: "Backloaded intervention finance handling",
    surface: HELP_PANEL_SURFACE,
    priority: 110,
    sourceType: "workflow",
    coverageDomain: "Case management / Backload",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/cases/:caseId", "/application-case/:id"],
    helpTitles: ["Case Workspace", "ISET Application Assessment", "Help and Tutorials"],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: ["finance", "actual amount", "manual_backload", "payment packets"],
    keywords: [
      "actual amount",
      "payment lines",
      "manual_backload",
      "historic finance",
      "payment packet",
      "finance submission",
      "remaining amount",
      "unpaid work",
    ],
    stateHints: ["applicationless"],
    workflowStates: ["applicationless", "imported", "historical_backload"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceInterventionsHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    expectedAnchors: [
      "historical only",
      "do not create live payment packets",
      "do not create finance submissions",
      "new live intervention for remaining amount",
    ],
    doNotSay: ["payment request", "finance submission", "CFA side effect"],
    applicabilityText:
      "Use when staff ask whether backloaded actual amounts or payment lines create live finance workflow.",
    answerStyleText:
      "Explain the historical-only rule plainly and separate it from live PATH payment workflow.",
    restrictionsText:
      "Do not imply that backloaded finance history can be pushed through current live payment workflow.",
    guidanceText: `Actual amount and payment lines entered during backload are historical only. They do not create live payment packets, finance submissions, CFA side effects, or applicant notifications. For \`manual_backload\` interventions, PATH stores historical finance history so reporting and budget burn can reflect legacy spend, but those records stay outside the live payment workflow. If there is unpaid work that now has to be managed in PATH, staff should create a new live intervention for the remaining amount instead of pushing the backloaded record through live payments.`,
  },
  {
    slug: "application-living-allowance-documentation",
    title: "Living allowance documentation before recommendation",
    surface: HELP_PANEL_SURFACE,
    priority: 126,
    sourceType: "policy_process",
    coverageDomain: "Application Assessment / Financial Need",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/application-case/:id", "/cases/:caseId"],
    helpTitles: [
      "Application Workspace",
      "Application assessment workflow",
      "Supporting Documents",
      "Case Workspace",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "living allowance",
      "financial need",
      "income verification",
      "expense evidence",
      "financial overview",
    ],
    keywords: [
      "living allowance",
      "living allowance documentation",
      "financial overview",
      "financial situation",
      "income",
      "income verification",
      "expenses",
      "expense verification",
      "household income",
      "monthly expenses",
      "recommend living allowance",
      "before recommending",
      "proof of income",
      "proof of expenses",
    ],
    stateHints: ["application-assessment", "financial-need"],
    workflowStates: ["submitted", "in_review", "pending_approval", "assessment"],
    sourceRefs: [
      "docs/training/TRAINING_MODULES_September_2025_extracted.md",
      "src/documentation/runtime/trainingModules2025.json",
      "src/helpPanelContents/applicationCaseDashboardHelp.js",
      "src/server/config/checklists/iset-compliance.json",
      "docs/features/payments-module.md",
    ],
    expectedAnchors: [
      "Financial Overview",
      "household income",
      "income verification",
      "monthly expenses",
      "Supporting Documents",
      "rationale",
      "not a flat rate",
    ],
    doNotSay: [
      "approve first and collect later",
      "no proof needed",
      "estimate without evidence",
      "minimum living allowance",
      "flat rate amount",
      "back-date the living allowance",
    ],
    applicabilityText:
      "Use when staff ask what evidence is needed before recommending or approving a living allowance, or how to document financial need.",
    stepsText:
      "Review the application's Financial Overview and compare it with Supporting Documents. Confirm disclosed household income/revenue from all sources and attach income verification such as paystubs, social-assistance/caseworker letters, child tax benefit proof, alimony/child-support records, T4/income tax assessments, bank statements, Record of Employment, or employer letters as applicable. Confirm monthly expense evidence such as lease/mortgage or residence-fee documents, basic utility bills, childcare proof, and transportation evidence. Record the assessment rationale in Application Assessment and keep the supporting files in Supporting Documents before recommending the living allowance.",
    sideEffectsText:
      "A living allowance recommendation should be evidence-backed before approval. Payment still depends on the later payment workflow and, for monthly living allowance payments, the Client Monthly Attendance Report must be completed, signed by the client, and verified by the coordinator before payment processing.",
    restrictionsText:
      "Living allowance is needs-based, not a minimum/flat-rate amount. It is meant to subsidize basic needs during an eligible training or education intervention, not cover all monthly expenses, prior debts, ineligible personal expenses, or back-dated periods. An active EI claim can make the client ineligible until the claim is complete; Band funding that includes living allowance creates a double-dipping risk that must be documented and reflected in the recommendation.",
    answerStyleText:
      "Separate PATH location from NWAC policy expectation: say where to record evidence in PATH, then summarize the training-aligned documentation standard.",
    guidanceText:
      "Before recommending a living allowance, staff need financial evidence, not a rough estimate. Review the applicant's `Financial Overview`, confirm household income/revenue from all sources, and attach income and monthly-expense verification in `Supporting Documents`. Use the application assessment rationale to explain why the allowance is needed and how the evidence supports the amount. NWAC training says income verification and documentation of monthly income and expenses are required before approval; living allowance is needs-based, not a flat rate, cannot be back-dated, and is not meant to cover all expenses or old debts. Later payment processing also requires a signed and coordinator-verified Client Monthly Attendance Report for monthly allowance payments.",
  },
  {
    slug: "supporting-documents-band-funding-decision-letter",
    title: "Band or Nation funding decision-letter upload",
    surface: HELP_PANEL_SURFACE,
    priority: 124,
    sourceType: "workflow",
    coverageDomain: "Supporting Documents / Checklist",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/application-case/:id", "/cases/:caseId"],
    helpTitles: [
      "Supporting Documents",
      "Application Workspace",
      "Application assessment workflow",
      "Case Workspace",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "band funding",
      "nation funding",
      "decision letter",
      "supporting documents",
      "checklist",
    ],
    keywords: [
      "band funding",
      "nation funding",
      "band or nation funding",
      "band decision letter",
      "nation decision letter",
      "funding decision letter",
      "band funding denial",
      "band funding confirmation",
      "band funding decision",
      "where upload",
      "checklist",
      "supporting documents",
    ],
    stateHints: ["supporting-documents", "checklist"],
    workflowStates: ["submitted", "in_review", "pending_approval", "assessment"],
    sourceRefs: [
      "src/helpPanelContents/supportingDocumentsHelp.js",
      "src/server/config/checklists/iset-compliance.json",
      "src/server/config/checklists/iset-intervention.json",
      "docs/planning/document-checklist-config-widget.md",
      "docs/training/TRAINING_MODULES_September_2025_extracted.md",
    ],
    expectedAnchors: [
      "Supporting Documents",
      "Band or Nation funding Decision letter",
      "band_funding_decision",
      "band_funding_confirmation",
      "band_funding_denial",
      "per application",
      "Checklist",
    ],
    doNotSay: [
      "email it instead",
      "upload anywhere",
      "use Other by default",
      "global finance export",
      "client word is enough",
      "screenshot is enough",
    ],
    applicabilityText:
      "Use when staff ask where or how to upload Band, Treaty Nation, or Community funding approval/denial/decision letters.",
    stepsText:
      "Use Supporting Documents in the relevant Application Workspace when the letter supports an application. Select Upload, choose the specific Band/Nation funding decision document type when available, and attach it to the application so the Checklist can count it. Accepted checklist document types are band_funding_decision, band_funding_confirmation, or band_funding_denial. In Case Workspace, use the same Supporting Documents workflow only when the document truly belongs to the case/action-plan/intervention context; use Case header > Upload existing documents for historical imported files.",
    sideEffectsText:
      "Checklist completion depends on document type and attachment scope. A Band/Nation funding decision letter configured as per-application will not clear the application checklist if it is attached only to the wrong case/action-plan context or tagged with a generic/inactive type.",
    restrictionsText:
      "Do not use a generic Other document type unless no specific active type fits. NWAC training expects Band denial/funding letters to be current, on official Band/Treaty Nation letterhead, and to match the program/term; screenshots, notes, or the client's word are not sufficient.",
    answerStyleText:
      "Give the upload location and document-type/scoping rule first, then mention the training compliance standard for the letter.",
    guidanceText:
      "Upload Band or Nation funding decision letters in `Supporting Documents` and tag them with the specific Band/Nation funding document type so the checklist can count them. For application assessment, the checklist item is `Band or Nation funding Decision letter`, scoped per application, and accepts `band_funding_decision`, `band_funding_confirmation`, or `band_funding_denial` from applicant upload, staff/manual upload, or secure-message attachment sources. If the item is not clearing, check the document type and attachment scope before re-requesting the file. Training guidance requires a current official Band/Treaty Nation letter that matches the program/term; screenshots, written notes, or the client's word are not enough.",
  },
  {
    slug: "secure-message-vs-contact-communications",
    title: "Secure Messaging versus Contact Communications",
    surface: HELP_PANEL_SURFACE,
    priority: 122,
    sourceType: "workflow",
    coverageDomain: "Secure Messaging / Contact",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/cases/:caseId", "/application-case/:id", "/messages", "/contact-communications"],
    helpTitles: [
      "Case Workspace",
      "Application Workspace",
      "Secure Messaging Help",
      "Contact Communications",
      "Staff Messages",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "secure messaging",
      "contact communications",
      "public contact",
      "privacy",
      "applicant communication",
    ],
    keywords: [
      "secure message",
      "secure messaging",
      "contact communications",
      "contact message",
      "public contact",
      "contact form",
      "which message",
      "send a secure message",
      "case-specific",
      "applicant-specific",
      "sensitive details",
      "public inquiry",
    ],
    stateHints: ["communication", "privacy"],
    workflowStates: ["communication", "missing_information", "follow_up"],
    sourceRefs: [
      "src/helpPanelContents/secureMessagesHelpPanelContent.js",
      "src/helpPanelContents/contactCommunicationsHelp.js",
      "docs/widgets/admin/secure-messaging-widget.md",
      "isetadminserver.js",
    ],
    expectedAnchors: [
      "Secure Messaging",
      "case-specific",
      "applicant-specific",
      "Contact Communications",
      "public portal contact",
      "avoid sensitive details",
      "Supporting Documents",
      "Case Notes",
    ],
    doNotSay: [
      "use either interchangeably",
      "send applicant details through public contact",
      "generic message endpoint",
      "public contact is the case inbox",
      "email-only record",
    ],
    applicabilityText:
      "Use when staff ask whether to use secure messaging, staff messages, contact communications, or public contact channels.",
    stepsText:
      "Use Secure Messaging inside the Application Workspace or Case Workspace for applicant-specific or case-specific communication, especially missing-document requests, application acknowledgements, follow-up, and attachments. Use Contact Communications for public portal contact-message triage: general questions/support requests submitted through the public contact endpoint. If a contact message turns into casework, move the substantive follow-up into the appropriate application/case workflow and keep sensitive details out of public contact channels.",
    sideEffectsText:
      "Secure-message attachments opened/adopted by staff are copied to Supporting Documents and can be relabelled there. Important messaging outcomes should also be summarized in Case Notes/Notes and Tasks when they affect decisions, deadlines, or audit history. Contact Communications status updates are triage/audit records for public contact messages, not a replacement for the case thread.",
    restrictionsText:
      "Do not treat public contact messages and secure case/application messaging as interchangeable. Do not send case details, applicant identifiers, documents, or sensitive casework through public contact channels when a secure case/application thread is available.",
    answerStyleText:
      "Answer as a privacy-safe channel-selection rule: Secure Messaging for file-specific casework, Contact Communications for public inquiries.",
    guidanceText:
      "Use `Secure Messaging` for case-specific or applicant-specific communication inside the file: acknowledgements, missing-document requests, follow-up, and attachment exchange. Secure-message attachments are adopted into `Supporting Documents`, and important outcomes should be captured in `Case Notes` / `Notes and Tasks` when they matter to the audit trail. Use `Contact Communications` for public portal contact-message triage and response status, not as the secure case thread. If a public inquiry becomes casework, continue the substantive discussion in the appropriate Application Workspace or Case Workspace and avoid putting sensitive applicant or case details into public contact channels.",
  },
  {
    slug: "case-notes-followup-recordkeeping",
    title: "Case Notes follow-up recordkeeping",
    surface: HELP_PANEL_SURFACE,
    priority: 121,
    sourceType: "workflow",
    coverageDomain: "Case Notes / Recordkeeping",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/cases/:caseId", "/application-case/:id"],
    helpTitles: [
      "Case Workspace",
      "Application Workspace",
      "Case Notes",
      "Notes and Tasks",
      "Supporting Documents",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "case notes",
      "follow-up attempts",
      "missing documents",
      "audit trail",
      "reminders",
    ],
    keywords: [
      "case notes",
      "notes and tasks",
      "missing document follow-up",
      "follow-up attempts",
      "record attempts",
      "document follow-up",
      "where record",
      "audit trail",
      "deadline",
      "reminder",
      "contact attempts",
    ],
    stateHints: ["case-notes", "missing-documents"],
    workflowStates: ["docs_requested", "follow_up", "awaiting_applicant", "assessment"],
    sourceRefs: [
      "src/helpPanelContents/caseNotesHelp.js",
      "src/helpPanelContents/supportingDocumentsHelp.js",
      "src/helpPanelContents/applicationCaseDashboardHelp.js",
      "docs/training/TRAINING_MODULES_September_2025_extracted.md",
    ],
    expectedAnchors: [
      "Case Notes",
      "Notes and Tasks",
      "Supporting Documents",
      "Secure Messaging",
      "date",
      "deadline",
      "follow-up attempts",
      "Case Calendar",
    ],
    doNotSay: [
      "only in email",
      "no need to record",
      "browser note",
      "delete the audit trail",
      "documents go in notes",
    ],
    applicabilityText:
      "Use when staff ask where to record applicant contact, missing-document follow-up attempts, deadlines, or internal casework outcomes.",
    stepsText:
      "Record follow-up attempts in Case Notes or Notes and Tasks on the file. Include the date, channel, what was requested or discussed, the deadline/next action, and who owns the follow-up. Use a follow-up date when a reminder is needed; the reminder appears on the Case Calendar. Keep the documents themselves in Supporting Documents, and use Secure Messaging for the applicant request when available.",
    sideEffectsText:
      "Adding a follow-up date to a case note creates a reminder on the Case Calendar. Notes are staff-visible and become part of the internal audit trail; they should summarize contact/outcome rather than store document contents.",
    restrictionsText:
      "Do not rely only on outside email or memory for important follow-up. Do not paste sensitive document contents into notes; upload the document to Supporting Documents and use notes to record what changed and what happens next.",
    answerStyleText:
      "Keep the guidance concise and audit-focused: what to record in notes, what belongs in documents, and when to use reminders.",
    guidanceText:
      "Record missing-document follow-up attempts in `Case Notes` or `Notes and Tasks`, not only in external email. A useful note should include the date, communication channel, what was requested, the response or lack of response, the deadline or next action, and who owns it. Use `Secure Messaging` for the applicant request when available, keep files in `Supporting Documents`, and set a follow-up date in the note when a reminder is needed; that date creates a `Case Calendar` reminder. Notes are the internal audit trail, so they should summarize contact and decisions without replacing the document record.",
  },
  {
    slug: "finance-intervention-approval-payment-packet",
    title: "Intervention approval versus payment packets",
    surface: HELP_PANEL_SURFACE,
    priority: 120,
    sourceType: "workflow",
    coverageDomain: "Finance / Payments",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/finance/payments", "/cases/:caseId"],
    helpTitles: [
      "Finance Payments",
      "Case Workspace",
      "Interventions",
      "Help and Tutorials",
    ],
    roles: [
      "ISET Coordinator",
      "Finance Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: [
      "payment packets",
      "intervention approval",
      "finance workflow",
      "evidence",
      "claim period",
    ],
    keywords: [
      "payment packet",
      "payment packets",
      "approving an intervention",
      "approved intervention",
      "create payment packet",
      "auto-create payment",
      "approval equals paid",
      "finance workflow",
      "claim period",
      "receipt",
      "payment line",
      "authorization ceiling",
    ],
    stateHints: ["finance-payments", "intervention-approval"],
    workflowStates: ["approved", "payment", "draft", "ready_to_send"],
    sourceRefs: [
      "docs/features/payments-module.md",
      "src/helpPanelContents/financePaymentsHelp.js",
      "src/pages/finance/widgets/PaymentsDataContext.jsx",
      "src/pages/finance/widgets/PaymentDetailWidget.jsx",
      "isetadminserver.js",
    ],
    expectedAnchors: [
      "No",
      "approval authorizes funding",
      "authorization ceiling",
      "payment packet",
      "payment lines",
      "claim period",
      "receipt",
      "required evidence",
    ],
    doNotSay: [
      "auto-create payment packet",
      "payment is submitted automatically",
      "approval equals paid",
      "full approved intervention by default",
      "no evidence required",
    ],
    applicabilityText:
      "Use when staff ask whether application/intervention approval automatically creates payments, packets, finance submissions, or paid status.",
    stepsText:
      "Treat intervention approval as the authorization ceiling. When money is ready to be claimed or paid, staff create or update a payment packet in Finance Payments for the specific payment lines, payable period, receipt, invoice, or claim cycle. Attach required evidence, validate the packet, then send it to Finance when it is ready.",
    sideEffectsText:
      "Payment packets have their own draft-to-finance lifecycle. Sending a packet emails finance and locks edits. Multiple packets can exist for one intervention over time, especially for recurring supports or separate receipts/claim periods.",
    restrictionsText:
      "Do not say approval automatically creates a packet, submits payment, or means the client/provider has been paid. Approved intervention funding is not the same as a payment packet amount.",
    answerStyleText:
      "Lead with No. Then distinguish approval/authorization from the packet-first finance workflow.",
    guidanceText:
      "No. Approving an intervention authorizes funding; it does not automatically create or submit a live `payment packet`, and approval does not mean paid. In Finance Payments, a payment packet groups the specific payment lines and evidence being sent now. Approved intervention funding is the authorization ceiling; create separate packets for separate months, receipts, invoices, or claim periods as needed. Required evidence must be attached and the packet validated before it is sent to Finance, and sending the packet starts the finance handoff/lock behavior.",
  },
  {
    slug: "notifications-applicant-secure-message-owner-scope",
    title: "Applicant secure-message notification owner scoping",
    surface: HELP_PANEL_SURFACE,
    priority: 119,
    sourceType: "workflow",
    coverageDomain: "Notifications / Secure Messaging",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/manage-notifications", "/messages", "/cases/:caseId"],
    helpTitles: [
      "Manage Notifications",
      "Notification Settings",
      "Staff Messages",
      "Case Workspace",
      "Help and Tutorials",
    ],
    roles: [
      "NWAC Administrator",
      "System Administrator",
      "ISET Coordinator",
      "Regional Manager",
    ],
    topicTags: [
      "notifications",
      "secure messaging",
      "owner scoped",
      "watchers",
      "applicant secure message",
    ],
    keywords: [
      "applicant secure message received",
      "applicant_secure_message_received",
      "only the owner",
      "owner received",
      "owner-scoped",
      "owner scoped",
      "case watchers",
      "watchers",
      "secure-message alert",
      "notification",
      "not every user",
      "broadcast",
    ],
    stateHints: ["notifications", "secure-message"],
    workflowStates: ["notification", "secure_message"],
    sourceRefs: [
      "../shared/events/notificationDispatcher.js",
      "../shared/events/catalog.js",
      "src/helpPanelContents/manageNotificationsHelp.js",
      "src/helpPanelContents/notificationSettingsWidgetHelp.js",
      "docs/dashboards/manage-notifications-dashboard.md",
    ],
    expectedAnchors: [
      "applicant_secure_message_received",
      "owner-scoped",
      "assigned owner",
      "case watchers",
      "ISET Coordinator",
      "not every user in the role",
    ],
    doNotSay: [
      "all NWAC Administrators",
      "generic message_received",
      "broadcast",
      "everyone with the role",
      "staff_secure_message_sent",
    ],
    applicabilityText:
      "Use when staff ask why a secure-message notification went only to an owner/watcher or did not broadcast to everyone in a configured role.",
    stepsText:
      "Check the Manage Notifications row for the `applicant_secure_message_received` event and the assigned role/template settings. For this event, PATH resolves the assigned case owner first and then case watchers. Watchers can use their actual role setting or the ISET Coordinator fallback. It does not broadcast the event to every user in a role merely because a role row exists.",
    sideEffectsText:
      "This owner-scoped behavior limits applicant secure-message alerts to staff tied to the case file. Bell/email settings still need enabled rows/templates, but enabled role rows act as delivery rules for the resolved owner/watcher targets rather than broad broadcast lists.",
    restrictionsText:
      "Do not describe applicant-to-staff secure-message alerts as `message_received` or as a broadcast to all NWAC Administrators/System Administrators/Regional Managers. `staff_secure_message_sent` is the opposite direction: staff-to-applicant messaging.",
    answerStyleText:
      "Explain the routing model first, then point to Manage Notifications for settings review.",
    guidanceText:
      "`applicant_secure_message_received` is intentionally owner-scoped. PATH first resolves the assigned case owner and then case watchers; watcher delivery can use the watcher's role setting or the `ISET Coordinator` fallback. The Manage Notifications rows still control whether email/bell alerts and templates are enabled, but they do not turn this event into a broadcast to every user in a role. Use this event for applicant-to-staff secure messages; do not confuse it with the legacy/generic `message_received` label or the `staff_secure_message_sent` event for staff-to-applicant messages.",
  },
  {
    slug: "manual-intake-skips-portal-only-steps",
    title: "Manual Intake skips portal-only uploads and signatures",
    surface: HELP_PANEL_SURFACE,
    priority: 118,
    sourceType: "workflow",
    coverageDomain: "Workflow Studio / Manual Intake",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/iset/applications/intake", "/manage-workflows", "/modify-workflow"],
    helpTitles: [
      "Manual Application Intake",
      "Workflow Preview",
      "Manage Workflows",
      "Help and Tutorials",
    ],
    roles: [
      "System Administrator",
      "NWAC Administrator",
      "ISET Coordinator",
    ],
    topicTags: [
      "manual intake",
      "portal-only",
      "file upload",
      "signature",
      "conditional visibility",
    ],
    keywords: [
      "manual intake",
      "skip upload",
      "skips upload",
      "skip signature",
      "skips signature",
      "portal-only",
      "portal only",
      "file-upload",
      "signature-ack",
      "upload step",
      "signature step",
      "same as public portal",
    ],
    stateHints: ["manual-intake", "portal-only"],
    workflowStates: ["manual_intake", "intake"],
    sourceRefs: [
      "src/helpPanelContents/manualApplicationIntakeHelp.js",
      "src/utils/manualIntakeRuntime.js",
      "docs/planning/step19-checkbox-conditionality-followup.md",
      "src/widgets/WorkflowPreviewWidget.js",
    ],
    expectedAnchors: [
      "Manual Intake",
      "portal-only",
      "file-upload",
      "signature-ack",
      "upload",
      "signature",
      "Application Workspace",
      "Supporting Documents",
    ],
    doNotSay: [
      "bug",
      "same as public portal for every step",
      "must upload through Manual Intake",
      "Manual Intake completes signatures",
      "ignore the documents",
    ],
    applicabilityText:
      "Use when staff ask why Manual Intake skips upload-only or portal-signature steps, or whether that behavior is expected.",
    stepsText:
      "Use Manual Intake to enter the application data from a paper, PDF, phone, or in-person source. Manual Intake follows conditional visibility for renderable staff-entry content, but file-upload and signature-ack steps are non-renderable in the manual path and may be skipped. After Create Application opens the Application Workspace, upload separately received documents in Supporting Documents and record applicant follow-up in Notes/Secure Messaging as needed.",
    sideEffectsText:
      "Skipping portal-only upload/signature steps in Manual Intake does not mean the file is complete. The created application still needs documents, notes, and follow-up handled in the Application Workspace.",
    restrictionsText:
      "Do not call this a bug or claim Manual Intake is an exact end-to-end public portal simulation. If Manual Intake ever adds upload or signature capture, that behavior must be verified separately before treating it as parity.",
    answerStyleText:
      "Be reassuring and precise: expected behavior for portal-only controls, followed by where staff complete the document/follow-up work.",
    guidanceText:
      "`Manual Intake` is for staff data entry from non-portal application sources. It follows the published schema's conditional visibility for renderable manual-intake content, but portal-only `file-upload` and `signature-ack` steps are intentionally non-renderable in the manual path and may be skipped. After `Create Application`, PATH opens the Application Workspace, where staff upload separately received documents in `Supporting Documents` and record follow-up in Notes or Secure Messaging. This is expected behavior, not proof that the public portal and Manual Intake are identical for every step type.",
  },
  {
    slug: "workflow-preview-portal-parity-boundary",
    title: "Admin Workflow Preview and public portal parity boundary",
    surface: HELP_PANEL_SURFACE,
    priority: 117,
    sourceType: "workflow",
    coverageDomain: "Workflow Studio / Public Portal Relationship",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/manage-workflows", "/modify-workflow", "/manage-components", "/modify-component/:id"],
    helpTitles: [
      "Workflow Preview",
      "Manage Workflows",
      "Modify Workflow",
      "Intake Step Library",
      "Help and Tutorials",
    ],
    roles: [
      "System Administrator",
      "NWAC Administrator",
    ],
    topicTags: [
      "workflow preview",
      "public portal",
      "runtime config",
      "portal renderer",
      "parity",
    ],
    keywords: [
      "admin preview",
      "workflow preview",
      "public portal",
      "portal behavior",
      "exactly match",
      "parity",
      "runtime config",
      "portal renderer",
      "preview source of truth",
      "same as portal",
    ],
    stateHints: ["workflow-studio", "portal-parity"],
    workflowStates: ["preview", "authoring", "publish"],
    sourceRefs: [
      "docs/AGENTS.md",
      "src/widgets/WorkflowPreviewWidget.js",
      "../ISET-intake/src/renderer/renderers.js",
      "docs/planning/step19-checkbox-conditionality-followup.md",
    ],
    expectedAnchors: [
      "Admin Workflow Preview",
      "public portal renderer",
      "runtime config",
      "verify",
      "not assume parity",
      "portal-only",
    ],
    doNotSay: [
      "always exactly matches",
      "admin preview is the source of truth",
      "no need to check portal",
      "preview proves production behavior",
    ],
    applicabilityText:
      "Use when staff/admins ask whether the admin workflow preview exactly matches applicant portal behavior.",
    stepsText:
      "Use Admin Workflow Preview to inspect the authored workflow and many portal-rendered components, but verify public-portal behavior when changing conditionality, uploads, signatures, navigation, published runtime schema, or portal-only controls. Check the published runtime config and the deployed portal renderer before making parity claims.",
    sideEffectsText:
      "The preview imports the portal component registry for faithful component rendering where possible, but it is still an admin authoring/inspection tool. Publishing and deployed portal runtime behavior are the final checks for applicant-facing workflow claims.",
    restrictionsText:
      "Do not treat admin preview as the sole source of truth for public portal behavior. Manual Intake has its own staff-entry omissions for portal-only upload/signature steps.",
    answerStyleText:
      "Give a balanced answer: useful preview, but verify runtime and portal renderer for applicant-facing behavior.",
    guidanceText:
      "`Admin Workflow Preview` is useful for authoring review and uses the portal component registry where possible, but it should not be described as a guarantee that public portal behavior is identical in every detail. For applicant-facing claims, verify the published runtime config and the deployed public portal renderer, especially for conditional visibility, upload controls, signature controls, navigation, and portal-only behavior. The admin preview is an inspection aid; the public portal runtime remains the behavior to smoke-test before saying applicants will see exactly the same thing.",
  },
  {
    slug: "esdc-ilmp-intervention-outcome-status-rule",
    title: "ILMP intervention outcome status rule",
    surface: HELP_PANEL_SURFACE,
    priority: 116,
    sourceType: "workflow",
    coverageDomain: "ESDC / ILMP",
    coverageStatus: "verified",
    lastReviewedAt: "2026-05-07",
    routePatterns: ["/esdc/participants/:clientId", "/esdc/participants", "/esdc/reporting", "/cases/:caseId"],
    helpTitles: [
      "ESDC Participant Submission",
      "ESDC Participants",
      "ESDC Reporting",
      "Case Workspace",
      "Help and Tutorials",
    ],
    roles: [
      "System Administrator",
      "NWAC Administrator",
      "Regional Manager",
    ],
    topicTags: [
      "ILMP",
      "ESDC",
      "intervention outcome",
      "planned end date",
      "completed",
      "cancelled",
    ],
    keywords: [
      "planned end date",
      "end date not require outcome",
      "outcome yet",
      "intervention outcome",
      "ILMP",
      "ESDC",
      "completed or cancelled",
      "status-driven",
      "closeout",
      "planned intervention",
      "non-terminal",
    ],
    stateHints: ["esdc-ilmp", "intervention-outcome"],
    workflowStates: ["planned", "in_progress", "suspended", "completed", "cancelled", "ready"],
    sourceRefs: [
      "docs/workflows/admin/ilmp-reporting.md",
      "isetadminserver.js",
      "src/server/esdcIlmpParticipantRules.js",
      "src/helpPanelContents/esdcSubmissionDashboardHelp.js",
    ],
    expectedAnchors: [
      "status-driven",
      "planned end date",
      "completed or cancelled",
      "outcome",
      "ILMP close-out XML",
      "end date",
    ],
    doNotSay: [
      "any end date requires an outcome",
      "remove the planned date",
      "schema change",
      "planned status must be closed",
    ],
    applicabilityText:
      "Use when staff ask why an ILMP readiness or payload check does not require an intervention outcome for a non-terminal intervention that has a planned end date.",
    stepsText:
      "Check the intervention lifecycle/delivery status. For ILMP close-out, completed or cancelled interventions require an end date and outcome. Planned, in-progress, or suspended interventions may have planning dates, but they are not treated as terminal close-out records and their outcome stays out of the ILMP close-out payload until they are completed or cancelled.",
    sideEffectsText:
      "In payload generation, InterventionEndDate and InterventionOutcome are emitted for terminal interventions. Validation blocks missing outcome only when the intervention is completed or cancelled. Planned/non-terminal dates can support planning without forcing close-out.",
    restrictionsText:
      "Do not tell staff to remove valid planned dates to satisfy ILMP, and do not say any intervention with an end date automatically needs an outcome. Outcome is a close-out requirement tied to terminal intervention status.",
    answerStyleText:
      "Explain status-driven closeout in plain language, then mention what to fix if the intervention really is complete.",
    guidanceText:
      "ILMP intervention outcome requirements are status-driven. A planned end date by itself does not make the intervention a closed/terminal ILMP record. PATH requires `Intervention outcome` when the intervention is `completed` or `cancelled`; those terminal statuses also require an end date and are the cases where close-out data is emitted in ILMP payloads. For planned, in-progress, or suspended interventions, planning dates can exist without an outcome. If the service is actually finished, update the intervention through the close/complete path and record the real end date and outcome.",
  },
];

const SEEDED_GUIDANCE_EXAMPLES = [
  {
    guidanceSlug: "case-intervention-approval-letter-followup",
    sortOrder: 5,
    coverageStatus: "verified",
    evalFixtureId: "case-intervention-approval-letters",
    routeContext: ["/cases/:caseId"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "Case Workspace",
      "Interventions",
      "Prepare approval letters",
      "Approval letters",
      "Generate drafts",
      "Send client approval letter",
    ],
    mustNotMention: [
      "Approvals area",
      "record toolbar",
      "select the correct approval letter template",
    ],
    sourceRefs: [
      "src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx",
      "src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx",
      "docs/widgets/admin/interventions-widget.md",
      "docs/widgets/admin/intervention-assessment-widget.md",
    ],
    questionText: "How do I prepare approval letters for approved new interventions?",
    answerText:
      "Open the client in Case Workspace and use the Interventions widget. For the approved new intervention proposal with letter follow-up pending, choose `Actions > Prepare approval letters`; PATH opens the approval follow-up on `Approval letters`. Click `Generate drafts`, review or edit the `Client letter` and any supporting institution, loan-provider, or other-funder letter tabs, then use `Send client approval letter` for the client-facing send. Supporting funder letters are reviewed or downloaded for manual handling; PATH does not send them automatically.",
  },
  {
    guidanceSlug: "home-pending-completion-purpose",
    sortOrder: 8,
    coverageStatus: "verified",
    evalFixtureId: "home-pending-completion-purpose",
    routeContext: ["/"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "post-decision",
      "approval letters",
      "funding forms and signatures",
      "approved intervention proposal",
      "completed or closed",
    ],
    mustNotMention: [
      "completed applications only",
      "closed cases",
      "archive queue",
    ],
    sourceRefs: [
      "src/pages/home/HomeDashboardPage.jsx",
      "src/pages/home/widgets/WorkQueueItemsTableWidget.js",
      "docs/dashboards/admin-home-my-work-widget.md",
      "src/helpPanelContents/homeWorkQueueHelp.js",
    ],
    questionText: "What is Pending Completion for?",
    answerText:
      "`Pending Completion` is for post-decision follow-through, not for already archived work. It includes application files after an approval or denial decision while approval letters, funding forms and signatures, checklist work, or final closeout still need to be finished. It also includes approved new intervention proposals and approved intervention revisions until the intervention-scoped client approval or funding revision letter is sent. Open the item name to continue the work in the correct Application Workspace or Case Workspace; the row remains until the application is completed/closed or the intervention letter follow-up is sent.",
  },
  {
    guidanceSlug: "application-missing-documents-followup",
    sortOrder: 9,
    coverageStatus: "verified",
    evalFixtureId: "application-missing-documents-next-step",
    routeContext: ["/application-case/:id"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "Supporting Documents",
      "Checklist",
      "Secure Messaging",
      "Case Notes",
      "document follow-up attempts",
    ],
    mustNotMention: [
      "email only",
      "approve while waiting",
      "ignore the checklist",
    ],
    sourceRefs: [
      "src/helpPanelContents/applicationAssessmentHelp.js",
      "src/helpPanelContents/supportingDocumentsHelp.js",
      "src/helpPanelContents/secureMessagesHelpPanelContent.js",
      "src/helpPanelContents/caseNotesHelp.js",
      "docs/training/TRAINING_MODULES_September_2025_extracted.md",
    ],
    questionText: "What do I do when required documents are missing?",
    answerText:
      "Stay in the Application Workspace and use `Supporting Documents > Checklist` to identify exactly what is missing or not counting. If a document is present but not clearing the checklist, correct its document type or attachment scope in Supporting Documents. If the applicant needs to provide something, send a `Secure Messaging > New Message` request and save the assessment as a draft until the evidence or rationale is ready. Record the request, deadline, and follow-up attempts in `Notes and Tasks` / `Case Notes` so the file has a clear audit trail.",
  },
  {
    guidanceSlug: "application-request-changes-review",
    sortOrder: 11,
    coverageStatus: "verified",
    evalFixtureId: "application-request-changes",
    routeContext: ["/application-case/:id"],
    roleContext: ["NWAC Administrator", "Regional Manager", "System Administrator"],
    mustMention: [
      "Approval and decision",
      "Request Changes",
      "Request Changes note",
      "Commit",
      "Case Notes",
      "case manager",
    ],
    mustNotMention: [
      "deny the application",
      "edit the applicant submission directly",
      "delete the assessment",
    ],
    sourceRefs: [
      "src/widgets/CoordinatorAssessmentWidget.js",
      "src/helpPanelContents/applicationAssessmentHelp.js",
      "docs/widgets/admin/application-assessment-widget.md",
      "isetadminserver.js",
    ],
    questionText: "How do I request changes instead of approving an application?",
    answerText:
      "Open the application in Application Workspace and go to the Application Approval review, then use `Approval and decision`. Select `Request Changes` under `Funding Decision`, enter the required `Request Changes note` with what the coordinator or case manager needs to fix or clarify, and click `Commit`. PATH sends the assessment back for updates and records the note in Case Notes/Notes and Reminders; it is not a denial and it does not start approval or denial letter communication.",
  },
  {
    guidanceSlug: "case-backload-overview",
    sortOrder: 10,
    coverageStatus: "verified",
    routeContext: ["/cases/:caseId", "/application-case/:id"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: ["Case Workspace", "Case header", "Add existing intervention"],
    mustNotMention: ["CSV import", "bulk upload", "fake application"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    questionText:
      "I'm in the ISET Application Assessment workspace. Do you know much about how I can backload historic and active interventions?",
    answerText:
      "Yes, but that workflow belongs in Case Workspace rather than inside the Application Assessment widget. For imported or application-less files, open the case and use `Case header > Add existing intervention`. Use that backload action only for pre-PATH or already-existing services, because it records history silently instead of starting normal approval or payment workflow.",
  },
  {
    guidanceSlug: "case-backload-intervention-lifecycle",
    sortOrder: 20,
    coverageStatus: "verified",
    evalFixtureId: "case-backload-active-intervention",
    routeContext: ["/cases/:caseId"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: ["active plan", "Archived plans are blocked", "closed plans only accept completed or cancelled interventions"],
    mustNotMention: ["payment packet", "approval routing"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceInterventionsHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    questionText: "Can I backload an active intervention or only a completed one?",
    answerText:
      "You can backload an ongoing intervention, but it has to match the parent plan lifecycle. Archived plans are blocked, closed plans only accept completed or cancelled interventions, and in-progress or suspended interventions need an active plan. Completed or cancelled historical interventions also need the real end date and outcome recorded.",
  },
  {
    guidanceSlug: "case-backload-finance-history",
    sortOrder: 30,
    coverageStatus: "verified",
    routeContext: ["/cases/:caseId"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: ["No", "historical finance", "do not create live payment packets"],
    mustNotMention: ["creates a payment request", "finance submission workflow"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceInterventionsHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    questionText: "If I enter actual amount on a backloaded intervention, does that create a payment request?",
    answerText:
      "No. Backloaded `actual amount` and payment lines are treated as historical finance only. They can support reporting and budget burn, but they do not create live payment packets or finance submission workflow. If new unpaid work still needs to be managed in PATH, create a new live intervention for that remaining amount.",
  },
  {
    guidanceSlug: "application-living-allowance-documentation",
    sortOrder: 40,
    coverageStatus: "verified",
    evalFixtureId: "living-allowance-documentation",
    routeContext: ["/application-case/:id", "/cases/:caseId"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "Financial Overview",
      "income verification",
      "monthly expenses",
      "Supporting Documents",
      "rationale",
    ],
    mustNotMention: [
      "approve first and collect later",
      "no proof needed",
      "flat rate",
    ],
    sourceRefs: [
      "docs/training/TRAINING_MODULES_September_2025_extracted.md",
      "src/documentation/runtime/trainingModules2025.json",
      "src/helpPanelContents/applicationCaseDashboardHelp.js",
      "src/server/config/checklists/iset-compliance.json",
    ],
    questionText: "What documentation is needed before recommending a living allowance?",
    answerText:
      "Before recommending a living allowance, review the `Financial Overview` and confirm the file has income and monthly-expense evidence in `Supporting Documents`. Income verification can include paystubs, social-assistance/caseworker letters, child tax benefit or support records, T4/income-tax assessments, bank statements, ROE, or employer letters as applicable. Expense evidence can include rent/residence or mortgage documents, recent basic utility bills, childcare proof, and transportation evidence. Record the rationale in Application Assessment; living allowance is needs-based, not a flat rate, and should not be approved first with evidence collected later.",
  },
  {
    guidanceSlug: "supporting-documents-band-funding-decision-letter",
    sortOrder: 50,
    coverageStatus: "verified",
    evalFixtureId: "supporting-documents-band-decision-letter",
    routeContext: ["/application-case/:id", "/cases/:caseId"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "Supporting Documents",
      "Band or Nation funding Decision letter",
      "band_funding_decision",
      "per application",
      "Checklist",
    ],
    mustNotMention: [
      "email it instead",
      "upload anywhere",
      "use Other by default",
    ],
    sourceRefs: [
      "src/helpPanelContents/supportingDocumentsHelp.js",
      "src/server/config/checklists/iset-compliance.json",
      "src/server/config/checklists/iset-intervention.json",
      "docs/training/TRAINING_MODULES_September_2025_extracted.md",
    ],
    questionText: "Where should I upload a Band or Nation funding decision letter?",
    answerText:
      "Upload it in `Supporting Documents` for the relevant application and choose the specific Band/Nation funding document type so the `Checklist` can count it. The checklist item is `Band or Nation funding Decision letter`, scoped per application, and accepts `band_funding_decision`, `band_funding_confirmation`, or `band_funding_denial`. If the item does not clear, check both the document type and attachment scope. Do not default to `Other` when the specific type exists, and do not rely on email, screenshots, notes, or the client's word in place of the official letter.",
  },
  {
    guidanceSlug: "secure-message-vs-contact-communications",
    sortOrder: 60,
    coverageStatus: "verified",
    evalFixtureId: "secure-message-vs-contact-communications",
    routeContext: ["/cases/:caseId", "/application-case/:id", "/messages", "/contact-communications"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "Secure Messaging",
      "case-specific",
      "applicant-specific",
      "Contact Communications",
      "public portal contact",
      "avoid sensitive details",
    ],
    mustNotMention: [
      "interchangeably",
      "send applicant details through public contact",
      "generic message endpoint",
    ],
    sourceRefs: [
      "src/helpPanelContents/secureMessagesHelpPanelContent.js",
      "src/helpPanelContents/contactCommunicationsHelp.js",
      "docs/widgets/admin/secure-messaging-widget.md",
    ],
    questionText: "Should I send a secure message or use Contact Communications?",
    answerText:
      "Use `Secure Messaging` when the communication is case-specific or applicant-specific, such as missing-document requests, acknowledgements, follow-up, or attachments inside an Application Workspace or Case Workspace. Use `Contact Communications` for public portal contact-message triage and general support inquiries. If a public contact message turns into casework, continue the substantive discussion in the appropriate file and avoid putting sensitive applicant or case details in public contact channels.",
  },
  {
    guidanceSlug: "case-notes-followup-recordkeeping",
    sortOrder: 70,
    coverageStatus: "verified",
    evalFixtureId: "case-notes-missing-document-followup",
    routeContext: ["/cases/:caseId", "/application-case/:id"],
    roleContext: ["ISET Coordinator", "Regional Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "Case Notes",
      "Notes and Tasks",
      "Supporting Documents",
      "Secure Messaging",
      "follow-up attempts",
      "Case Calendar",
    ],
    mustNotMention: [
      "only in email",
      "no need to record",
      "browser note",
    ],
    sourceRefs: [
      "src/helpPanelContents/caseNotesHelp.js",
      "src/helpPanelContents/supportingDocumentsHelp.js",
      "src/helpPanelContents/applicationCaseDashboardHelp.js",
    ],
    questionText: "Where do I record missing-document follow-up attempts?",
    answerText:
      "Record the attempt in `Case Notes` or `Notes and Tasks` on the file. Include the date, channel, what was requested, the deadline or next action, and who owns the follow-up. Use `Secure Messaging` for the applicant request when available and keep files themselves in `Supporting Documents`. If a reminder is needed, add a follow-up date to the note; that creates a `Case Calendar` reminder.",
  },
  {
    guidanceSlug: "finance-intervention-approval-payment-packet",
    sortOrder: 80,
    coverageStatus: "verified",
    evalFixtureId: "finance-intervention-approval-payment-packet",
    routeContext: ["/finance/payments", "/cases/:caseId"],
    roleContext: ["ISET Coordinator", "Finance Manager", "NWAC Administrator", "System Administrator"],
    mustMention: [
      "No",
      "approval authorizes funding",
      "authorization ceiling",
      "payment packet",
      "claim period",
      "required evidence",
    ],
    mustNotMention: [
      "auto-create payment packet",
      "payment is submitted automatically",
      "approval equals paid",
    ],
    sourceRefs: [
      "docs/features/payments-module.md",
      "src/helpPanelContents/financePaymentsHelp.js",
      "src/pages/finance/widgets/PaymentsDataContext.jsx",
    ],
    questionText: "Does approving an intervention create a payment packet?",
    answerText:
      "No. Approval authorizes funding; it does not auto-create a `payment packet` and it does not mean payment has been submitted or paid. Approved intervention funding is the authorization ceiling. In Finance Payments, create packets for the specific payment lines, receipts, invoices, months, or claim periods being sent now, attach the required evidence, validate the packet, and then send it to Finance.",
  },
  {
    guidanceSlug: "notifications-applicant-secure-message-owner-scope",
    sortOrder: 90,
    coverageStatus: "verified",
    evalFixtureId: "notifications-applicant-secure-message-owner",
    routeContext: ["/manage-notifications", "/messages", "/cases/:caseId"],
    roleContext: ["NWAC Administrator", "System Administrator", "ISET Coordinator", "Regional Manager"],
    mustMention: [
      "applicant_secure_message_received",
      "owner-scoped",
      "assigned owner",
      "case watchers",
      "not every user in the role",
    ],
    mustNotMention: [
      "all NWAC Administrators",
      "generic message_received",
      "broadcast",
    ],
    sourceRefs: [
      "../shared/events/notificationDispatcher.js",
      "../shared/events/catalog.js",
      "src/helpPanelContents/manageNotificationsHelp.js",
      "src/helpPanelContents/notificationSettingsWidgetHelp.js",
    ],
    questionText: "Why did only the owner receive an applicant secure-message alert?",
    answerText:
      "`applicant_secure_message_received` is owner-scoped. PATH resolves the assigned owner and case watchers, then applies enabled Manage Notifications rows/templates to those resolved recipients. It does not broadcast applicant secure-message alerts to every user in a configured role. Watchers can use their actual role setting or the ISET Coordinator fallback; `staff_secure_message_sent` is the separate staff-to-applicant event.",
  },
  {
    guidanceSlug: "manual-intake-skips-portal-only-steps",
    sortOrder: 100,
    coverageStatus: "verified",
    evalFixtureId: "workflow-studio-manual-intake-skips-portal-steps",
    routeContext: ["/iset/applications/intake", "/manage-workflows", "/modify-workflow"],
    roleContext: ["System Administrator", "NWAC Administrator", "ISET Coordinator"],
    mustMention: [
      "Manual Intake",
      "portal-only",
      "file-upload",
      "signature-ack",
      "Application Workspace",
      "Supporting Documents",
    ],
    mustNotMention: [
      "bug",
      "same as public portal for every step",
      "must upload through Manual Intake",
    ],
    sourceRefs: [
      "src/helpPanelContents/manualApplicationIntakeHelp.js",
      "src/utils/manualIntakeRuntime.js",
      "docs/planning/step19-checkbox-conditionality-followup.md",
    ],
    questionText: "Why does Manual Intake skip upload and signature steps?",
    answerText:
      "That is expected for `Manual Intake`. The manual path is for staff data entry from paper, PDF, phone, or in-person sources. It follows conditional visibility for renderable manual-intake content, but portal-only `file-upload` and `signature-ack` steps are intentionally non-renderable and may be skipped. After `Create Application`, upload separately received documents in the Application Workspace's `Supporting Documents` area and record follow-up in Notes or Secure Messaging.",
  },
  {
    guidanceSlug: "workflow-preview-portal-parity-boundary",
    sortOrder: 110,
    coverageStatus: "verified",
    evalFixtureId: "admin-preview-public-portal-parity",
    routeContext: ["/manage-workflows", "/modify-workflow", "/manage-components", "/modify-component/:id"],
    roleContext: ["System Administrator", "NWAC Administrator"],
    mustMention: [
      "Admin Workflow Preview",
      "public portal renderer",
      "runtime config",
      "verify",
      "not assume parity",
    ],
    mustNotMention: [
      "always exactly matches",
      "admin preview is the source of truth",
      "no need to check portal",
    ],
    sourceRefs: [
      "docs/AGENTS.md",
      "src/widgets/WorkflowPreviewWidget.js",
      "../ISET-intake/src/renderer/renderers.js",
    ],
    questionText: "Does the admin preview exactly match public portal behavior?",
    answerText:
      "`Admin Workflow Preview` is useful and uses the public portal component registry where possible, but do not assume it proves exact applicant-facing behavior. For portal-facing changes, verify the published runtime config and the deployed public portal renderer, especially for conditional visibility, upload controls, signature controls, navigation, and portal-only behavior. The preview is an inspection aid; the public portal runtime is what applicants actually use.",
  },
  {
    guidanceSlug: "esdc-ilmp-intervention-outcome-status-rule",
    sortOrder: 120,
    coverageStatus: "verified",
    evalFixtureId: "ilmp-planned-end-date-no-outcome",
    routeContext: ["/esdc/participants/:clientId", "/esdc/participants", "/esdc/reporting", "/cases/:caseId"],
    roleContext: ["System Administrator", "NWAC Administrator", "Regional Manager"],
    mustMention: [
      "status-driven",
      "planned end date",
      "completed or cancelled",
      "outcome",
      "ILMP close-out XML",
    ],
    mustNotMention: [
      "any end date requires an outcome",
      "remove the planned date",
      "schema change",
    ],
    sourceRefs: [
      "docs/workflows/admin/ilmp-reporting.md",
      "isetadminserver.js",
      "src/server/esdcIlmpParticipantRules.js",
    ],
    questionText: "Why does an intervention with a planned end date not require an outcome yet?",
    answerText:
      "Because ILMP close-out is status-driven. A planned end date does not by itself make an intervention terminal. PATH requires an outcome when the intervention is `completed` or `cancelled`; those terminal statuses also require an end date and are the cases where close-out data appears in ILMP payloads. Planned, in-progress, or suspended interventions can have planning dates without an outcome. If the service is actually finished, close or complete the intervention and record the real end date and outcome.",
  },
];

let guidanceSchemaPromise = null;
let guidanceCache = { fetchedAt: 0, entries: [], examples: [] };
const GUIDANCE_CACHE_TTL_MS = 60 * 1000;

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean);
  }
  if (!value && value !== 0) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return normalizeList(JSON.parse(trimmed));
      } catch (_) {
        return trimmed
          .split(",")
          .map(item => normalizeString(item))
          .filter(Boolean);
      }
    }
    return trimmed
      .split(",")
      .map(item => normalizeString(item))
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value)
      .map(item => normalizeString(item))
      .filter(Boolean);
  }
  return [];
}

function tokenizeText(input) {
  return normalizeLower(input)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(token => token && token.length >= 2);
}

function buildKeywordSet(input) {
  return new Set(tokenizeText(input));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathPatternMatches(pathname, pattern) {
  const normalizedPath = normalizeString(pathname);
  const normalizedPattern = normalizeString(pattern);
  if (!normalizedPath || !normalizedPattern) return false;
  const regexSource = normalizedPattern
    .split("/")
    .map(segment => {
      if (!segment) return "";
      if (segment === "*") return ".*";
      if (segment.startsWith(":")) return "[^/]+";
      return escapeRegex(segment);
    })
    .join("/");
  try {
    return new RegExp(`^${regexSource}$`, "i").test(normalizedPath);
  } catch (_) {
    return false;
  }
}

function countKeywordMatches(text, keywords) {
  const haystack = normalizeLower(text);
  if (!haystack) return 0;
  return normalizeList(keywords).reduce((total, keyword) => {
    const needle = normalizeLower(keyword);
    if (!needle) return total;
    return haystack.includes(needle) ? total + 1 : total;
  }, 0);
}

function countTagOverlaps(keywordSet, tags) {
  return normalizeList(tags).reduce((total, tag) => {
    const normalized = normalizeLower(tag).replace(/[^a-z0-9]+/g, " ").trim();
    if (!normalized) return total;
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.every(part => keywordSet.has(part)) ? total + 1 : total;
  }, 0);
}

function extractLatestUserQuestion(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (normalizeLower(message?.role) !== "user") continue;
    const content = normalizeString(message?.content);
    if (content) return content;
  }
  return "";
}

function normalizeChatContext(rawContext = {}) {
  const workflowState = normalizeString(
    rawContext.workflowState ||
    rawContext.workflow_state ||
    rawContext.currentStep ||
    rawContext.current_step ||
    rawContext.status,
  );
  return {
    surface: normalizeString(rawContext.surface) || HELP_PANEL_SURFACE,
    pathname: normalizeString(rawContext.pathname),
    helpTitle: normalizeString(rawContext.helpTitle),
    aiContext: normalizeString(rawContext.aiContext),
    role: normalizeString(rawContext.role),
    workflowState,
  };
}

function hydrateEntry(row = {}) {
  return {
    slug: normalizeString(row.slug),
    title: normalizeString(row.title),
    surface: normalizeString(row.surface) || HELP_PANEL_SURFACE,
    priority: Number(row.priority ?? 0),
    sourceType: normalizeString(row.source_type) || "workflow",
    coverageDomain: normalizeString(row.coverage_domain),
    coverageStatus: normalizeString(row.coverage_status) || "drafted",
    routePatterns: normalizeList(row.route_patterns_json),
    helpTitles: normalizeList(row.help_titles_json),
    roles: normalizeList(row.roles_json),
    workflowStates: normalizeList(row.workflow_states_json),
    topicTags: normalizeList(row.topic_tags_json),
    keywords: normalizeList(row.keywords_json),
    stateHints: normalizeList(row.state_hints_json),
    sourceRefs: normalizeList(row.source_refs_json),
    expectedAnchors: normalizeList(row.expected_anchors_json),
    doNotSay: normalizeList(row.do_not_say_json),
    applicabilityText: normalizeString(row.applicability_text),
    answerStyleText: normalizeString(row.answer_style_text),
    stepsText: normalizeString(row.steps_text),
    sideEffectsText: normalizeString(row.side_effects_text),
    restrictionsText: normalizeString(row.restrictions_text),
    guidanceText: normalizeString(row.guidance_text),
    lastReviewedAt: normalizeString(row.last_reviewed_at),
  };
}

function hydrateExample(row = {}) {
  return {
    guidanceSlug: normalizeString(row.guidance_slug),
    questionText: normalizeString(row.question_text),
    answerText: normalizeString(row.answer_text),
    sortOrder: Number(row.sort_order ?? 0),
    routeContext: normalizeList(row.route_context_json),
    roleContext: normalizeList(row.role_context_json),
    mustMention: normalizeList(row.must_mention_json),
    mustNotMention: normalizeList(row.must_not_mention_json),
    sourceRefs: normalizeList(row.source_refs_json),
    evalFixtureId: normalizeString(row.eval_fixture_id),
    coverageStatus: normalizeString(row.coverage_status) || "drafted",
  };
}

function scoreEntry(entry, context, latestQuestion) {
  if (entry.surface !== context.surface) return 0;
  const latestQuestionText = normalizeString(latestQuestion);
  const combinedText = [
    latestQuestionText,
    context.helpTitle,
    context.aiContext,
    context.pathname,
  ]
    .filter(Boolean)
    .join(" ");
  const questionKeywords = buildKeywordSet(latestQuestionText);
  let contextScore = 0;
  let contentScore = 0;

  if (
    context.role &&
    entry.roles.length &&
    entry.roles.some(role => normalizeLower(role) === normalizeLower(context.role))
  ) {
    contextScore += 12;
  }
  if (
    context.pathname &&
    entry.routePatterns.some(pattern => pathPatternMatches(context.pathname, pattern))
  ) {
    contextScore += 18;
  }
  if (
    context.helpTitle &&
    entry.helpTitles.some(title => normalizeLower(context.helpTitle).includes(normalizeLower(title)))
  ) {
    contextScore += 12;
  }
  if (
    context.workflowState &&
    entry.workflowStates.length &&
    entry.workflowStates.some(state => normalizeLower(state) === normalizeLower(context.workflowState))
  ) {
    contextScore += 10;
  }

  const keywordMatches = countKeywordMatches(latestQuestionText, entry.keywords);
  contentScore += keywordMatches * 16;
  const combinedMatches = countKeywordMatches(combinedText, entry.keywords);
  contentScore += Math.max(0, combinedMatches - keywordMatches) * 6;
  contentScore += countTagOverlaps(questionKeywords, entry.topicTags) * 8;

  if (
    entry.stateHints.includes("applicationless") &&
    /(application-less|application less|imported client|imported file|pre-path)/i.test(combinedText)
  ) {
    contentScore += 10;
  }
  if (
    entry.stateHints.includes("cross-workspace") &&
    /application assessment|iset application assessment/i.test(combinedText) &&
    /(backload|existing intervention|historic intervention|active intervention)/i.test(combinedText)
  ) {
    contentScore += 10;
  }

  if (contentScore === 0) return 0;
  return contentScore + contextScore + Math.max(0, Math.min(entry.priority, 10));
}

const ENTRY_COLUMN_DEFINITIONS = [
  ["source_type", "VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'workflow'"],
  ["coverage_domain", "VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
  ["coverage_status", "VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted'"],
  ["workflow_states_json", "JSON NULL"],
  ["expected_anchors_json", "JSON NULL"],
  ["do_not_say_json", "JSON NULL"],
  ["applicability_text", "TEXT COLLATE utf8mb4_unicode_ci NULL"],
  ["steps_text", "MEDIUMTEXT COLLATE utf8mb4_unicode_ci NULL"],
  ["side_effects_text", "TEXT COLLATE utf8mb4_unicode_ci NULL"],
  ["restrictions_text", "TEXT COLLATE utf8mb4_unicode_ci NULL"],
  ["last_reviewed_at", "DATE NULL"],
];

const ENTRY_INDEX_DEFINITIONS = [
  ["idx_guidance_source_type", "source_type"],
  ["idx_guidance_coverage_domain", "coverage_domain"],
  ["idx_guidance_coverage_status", "coverage_status"],
];

const EXAMPLE_COLUMN_DEFINITIONS = [
  ["route_context_json", "JSON NULL"],
  ["role_context_json", "JSON NULL"],
  ["must_mention_json", "JSON NULL"],
  ["must_not_mention_json", "JSON NULL"],
  ["source_refs_json", "JSON NULL"],
  ["eval_fixture_id", "VARCHAR(128) COLLATE utf8mb4_unicode_ci NULL"],
  ["coverage_status", "VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted'"],
];

const EXAMPLE_INDEX_DEFINITIONS = [
  ["idx_guidance_example_fixture", "eval_fixture_id"],
  ["idx_guidance_example_coverage_status", "coverage_status"],
];

async function tableColumnExists(pool, tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND column_name = ?
       LIMIT 1
    `,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function tableIndexExists(pool, tableName, indexName) {
  const [rows] = await pool.query(
    `
      SELECT 1
        FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND index_name = ?
       LIMIT 1
    `,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function ensureColumns(pool, tableName, definitions) {
  for (const [columnName, definition] of definitions) {
    if (await tableColumnExists(pool, tableName, columnName)) continue;
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function ensureIndexes(pool, tableName, definitions) {
  for (const [indexName, columnName] of definitions) {
    if (await tableIndexExists(pool, tableName, indexName)) continue;
    await pool.query(`CREATE INDEX ${indexName} ON ${tableName} (${columnName})`);
  }
}

async function ensureGuidanceSchema(pool) {
  if (guidanceSchemaPromise) return guidanceSchemaPromise;
  guidanceSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${ENTRY_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(128) NOT NULL,
        title VARCHAR(255) NOT NULL,
        surface VARCHAR(64) NOT NULL DEFAULT '${HELP_PANEL_SURFACE}',
        priority INT NOT NULL DEFAULT 100,
        active TINYINT(1) NOT NULL DEFAULT 1,
        source_type VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'workflow',
        coverage_domain VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        coverage_status VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted',
        route_patterns_json JSON NULL,
        help_titles_json JSON NULL,
        roles_json JSON NULL,
        workflow_states_json JSON NULL,
        topic_tags_json JSON NULL,
        keywords_json JSON NULL,
        state_hints_json JSON NULL,
        source_refs_json JSON NULL,
        expected_anchors_json JSON NULL,
        do_not_say_json JSON NULL,
        applicability_text TEXT NULL,
        answer_style_text TEXT NULL,
        steps_text MEDIUMTEXT NULL,
        side_effects_text TEXT NULL,
        restrictions_text TEXT NULL,
        guidance_text MEDIUMTEXT NOT NULL,
        last_reviewed_at DATE NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_slug (slug),
        KEY idx_surface_active (surface, active),
        KEY idx_guidance_source_type (source_type),
        KEY idx_guidance_coverage_domain (coverage_domain),
        KEY idx_guidance_coverage_status (coverage_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${EXAMPLE_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guidance_slug VARCHAR(128) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        route_context_json JSON NULL,
        role_context_json JSON NULL,
        must_mention_json JSON NULL,
        must_not_mention_json JSON NULL,
        source_refs_json JSON NULL,
        eval_fixture_id VARCHAR(128) COLLATE utf8mb4_unicode_ci NULL,
        coverage_status VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted',
        question_text TEXT NOT NULL,
        answer_text MEDIUMTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_guidance_slug_sort (guidance_slug, sort_order),
        KEY idx_guidance_slug_active (guidance_slug, active),
        KEY idx_guidance_example_fixture (eval_fixture_id),
        KEY idx_guidance_example_coverage_status (coverage_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumns(pool, ENTRY_TABLE, ENTRY_COLUMN_DEFINITIONS);
    await ensureIndexes(pool, ENTRY_TABLE, ENTRY_INDEX_DEFINITIONS);
    await ensureColumns(pool, EXAMPLE_TABLE, EXAMPLE_COLUMN_DEFINITIONS);
    await ensureIndexes(pool, EXAMPLE_TABLE, EXAMPLE_INDEX_DEFINITIONS);

    for (const entry of SEEDED_GUIDANCE_ENTRIES) {
      await pool.query(
        `
          INSERT INTO ${ENTRY_TABLE} (
            slug,
            title,
            surface,
            priority,
            active,
            source_type,
            coverage_domain,
            coverage_status,
            route_patterns_json,
            help_titles_json,
            roles_json,
            workflow_states_json,
            topic_tags_json,
            keywords_json,
            state_hints_json,
            source_refs_json,
            expected_anchors_json,
            do_not_say_json,
            applicability_text,
            answer_style_text,
            steps_text,
            side_effects_text,
            restrictions_text,
            last_reviewed_at,
            guidance_text
          ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            surface = VALUES(surface),
            priority = VALUES(priority),
            active = VALUES(active),
            source_type = VALUES(source_type),
            coverage_domain = VALUES(coverage_domain),
            coverage_status = VALUES(coverage_status),
            route_patterns_json = VALUES(route_patterns_json),
            help_titles_json = VALUES(help_titles_json),
            roles_json = VALUES(roles_json),
            workflow_states_json = VALUES(workflow_states_json),
            topic_tags_json = VALUES(topic_tags_json),
            keywords_json = VALUES(keywords_json),
            state_hints_json = VALUES(state_hints_json),
            source_refs_json = VALUES(source_refs_json),
            expected_anchors_json = VALUES(expected_anchors_json),
            do_not_say_json = VALUES(do_not_say_json),
            applicability_text = VALUES(applicability_text),
            answer_style_text = VALUES(answer_style_text),
            steps_text = VALUES(steps_text),
            side_effects_text = VALUES(side_effects_text),
            restrictions_text = VALUES(restrictions_text),
            last_reviewed_at = VALUES(last_reviewed_at),
            guidance_text = VALUES(guidance_text),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          entry.slug,
          entry.title,
          entry.surface,
          entry.priority,
          entry.sourceType || "workflow",
          entry.coverageDomain || null,
          entry.coverageStatus || "drafted",
          JSON.stringify(entry.routePatterns || []),
          JSON.stringify(entry.helpTitles || []),
          JSON.stringify(entry.roles || []),
          JSON.stringify(entry.workflowStates || []),
          JSON.stringify(entry.topicTags || []),
          JSON.stringify(entry.keywords || []),
          JSON.stringify(entry.stateHints || []),
          JSON.stringify(entry.sourceRefs || []),
          JSON.stringify(entry.expectedAnchors || []),
          JSON.stringify(entry.doNotSay || []),
          entry.applicabilityText || null,
          entry.answerStyleText || null,
          entry.stepsText || null,
          entry.sideEffectsText || null,
          entry.restrictionsText || null,
          entry.lastReviewedAt || null,
          entry.guidanceText,
        ],
      );
    }

    for (const example of SEEDED_GUIDANCE_EXAMPLES) {
      await pool.query(
        `
          INSERT INTO ${EXAMPLE_TABLE} (
            guidance_slug,
            sort_order,
            active,
            route_context_json,
            role_context_json,
            must_mention_json,
            must_not_mention_json,
            source_refs_json,
            eval_fixture_id,
            coverage_status,
            question_text,
            answer_text
          ) VALUES (?, ?, 1, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            active = VALUES(active),
            route_context_json = VALUES(route_context_json),
            role_context_json = VALUES(role_context_json),
            must_mention_json = VALUES(must_mention_json),
            must_not_mention_json = VALUES(must_not_mention_json),
            source_refs_json = VALUES(source_refs_json),
            eval_fixture_id = VALUES(eval_fixture_id),
            coverage_status = VALUES(coverage_status),
            question_text = VALUES(question_text),
            answer_text = VALUES(answer_text),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          example.guidanceSlug,
          example.sortOrder,
          JSON.stringify(example.routeContext || []),
          JSON.stringify(example.roleContext || []),
          JSON.stringify(example.mustMention || []),
          JSON.stringify(example.mustNotMention || []),
          JSON.stringify(example.sourceRefs || []),
          example.evalFixtureId || null,
          example.coverageStatus || "drafted",
          example.questionText,
          example.answerText,
        ],
      );
    }
  })().catch(error => {
    guidanceSchemaPromise = null;
    throw error;
  });
  return guidanceSchemaPromise;
}

async function loadGuidanceData(pool) {
  const now = Date.now();
  if (guidanceCache.entries.length && (now - guidanceCache.fetchedAt) < GUIDANCE_CACHE_TTL_MS) {
    return guidanceCache;
  }
  await ensureGuidanceSchema(pool);
  const [entryRows] = await pool.query(
    `SELECT * FROM ${ENTRY_TABLE} WHERE active = 1 ORDER BY priority DESC, updated_at DESC, id ASC`,
  );
  const [exampleRows] = await pool.query(
    `SELECT * FROM ${EXAMPLE_TABLE} WHERE active = 1 ORDER BY guidance_slug ASC, sort_order ASC, id ASC`,
  );
  guidanceCache = {
    fetchedAt: now,
    entries: entryRows.map(hydrateEntry),
    examples: exampleRows.map(hydrateExample),
  };
  return guidanceCache;
}

function appendPromptText(lines, label, value) {
  const normalized = normalizeString(value);
  if (normalized) lines.push(`${label}: ${normalized}`);
}

function appendPromptList(lines, label, values) {
  const normalized = normalizeList(values);
  if (normalized.length) lines.push(`${label}: ${normalized.join("; ")}`);
}

function buildNoGuidancePrompt(context, latestQuestion) {
  const lines = [
    "No curated PATH guidance card matched this help-panel question.",
    "Use the current page help context only if it contains explicit PATH facts needed for the answer.",
    "For workflow-specific questions about approvals, letters, payments, forms, eligibility, supporting documents, secure messaging, case notes, routing, permissions, policy, or required records, do not infer missing steps from general software patterns.",
    "If explicit PATH guidance is not present, say: \"I do not have verified PATH guidance for that workflow yet.\" Then name the current page/help panel and suggest checking the relevant PATH workspace or the Guidance Library.",
    "Do not invent buttons, queues, menus, templates, record toolbars, automated side effects, or permission rules.",
  ];

  if (context.pathname) lines.push(`Current route: ${context.pathname}`);
  if (context.helpTitle) lines.push(`Current help panel: ${context.helpTitle}`);
  if (context.role) lines.push(`Current role: ${context.role}`);
  if (latestQuestion) lines.push(`Current user question: ${latestQuestion}`);

  return lines.join("\n");
}

function buildGuidancePrompt(context, matchedEntries, matchedExamples, latestQuestion) {
  const lines = [
    "Retrieved PATH guidance is available for this help-panel question.",
    "Treat the retrieved guidance below as the authoritative workflow layer for this answer.",
    "For workflow facts, use the retrieved guidance and approved examples below instead of general software expectations.",
    "Use exact PATH controls and workflow rules when they are named.",
    "If the retrieved guidance shows that the question belongs in another workspace, say that directly and name the correct workspace or quick action.",
    "If the user asks beyond the retrieved guidance, separate the verified answer from the part that still needs verification.",
    "Do not invent buttons, queues, menus, templates, record toolbars, automated side effects, or permission rules unless the retrieved guidance explicitly says they exist.",
    "Do not pad the answer with generic uncertainty language when the retrieved guidance already answers the workflow question.",
  ];

  if (context.pathname) lines.push(`Current route: ${context.pathname}`);
  if (context.helpTitle) lines.push(`Current help panel: ${context.helpTitle}`);
  if (context.role) lines.push(`Current role: ${context.role}`);
  if (latestQuestion) lines.push(`Current user question: ${latestQuestion}`);

  lines.push("", "Retrieved guidance:");
  matchedEntries.forEach((entry, index) => {
    const headingParts = [entry.title];
    if (entry.coverageDomain) headingParts.push(entry.coverageDomain);
    if (entry.coverageStatus) headingParts.push(`coverage ${entry.coverageStatus}`);
    if (entry.lastReviewedAt) headingParts.push(`reviewed ${entry.lastReviewedAt}`);
    lines.push(`${index + 1}. ${headingParts.join(" | ")}`);
    appendPromptText(lines, "Applicability", entry.applicabilityText);
    appendPromptList(lines, "Required answer anchors", entry.expectedAnchors);
    appendPromptList(lines, "Forbidden claims or phrases", entry.doNotSay);
    appendPromptText(lines, "Verified guidance", entry.guidanceText);
    appendPromptText(lines, "Steps", entry.stepsText);
    appendPromptText(lines, "Side effects", entry.sideEffectsText);
    appendPromptText(lines, "Restrictions", entry.restrictionsText);
    appendPromptText(lines, "Answer shaping", entry.answerStyleText);
    appendPromptList(lines, "Source anchors", entry.sourceRefs);
    lines.push("");
  });

  if (matchedExamples.length) {
    lines.push("Approved answer examples:");
    matchedExamples.forEach((example, index) => {
      const label = [`Example ${index + 1}`];
      if (example.coverageStatus) label.push(`coverage ${example.coverageStatus}`);
      if (example.evalFixtureId) label.push(`eval ${example.evalFixtureId}`);
      lines.push(label.join(" | "));
      appendPromptList(lines, "Route context", example.routeContext);
      appendPromptList(lines, "Role context", example.roleContext);
      appendPromptList(lines, "Must mention", example.mustMention);
      appendPromptList(lines, "Must not mention", example.mustNotMention);
      appendPromptList(lines, "Source anchors", example.sourceRefs);
      lines.push(`Question: ${example.questionText}`);
      lines.push(`Answer: ${example.answerText}`);
    });
  }

  return lines.join("\n");
}

function summarizeEntryMatch(entry, score) {
  return {
    slug: entry.slug,
    title: entry.title,
    score,
    sourceType: entry.sourceType,
    coverageDomain: entry.coverageDomain,
    coverageStatus: entry.coverageStatus,
    lastReviewedAt: entry.lastReviewedAt,
    sourceRefs: entry.sourceRefs,
    expectedAnchors: entry.expectedAnchors,
    doNotSay: entry.doNotSay,
  };
}

function summarizeExampleMatch(example) {
  return {
    guidanceSlug: example.guidanceSlug,
    sortOrder: example.sortOrder,
    coverageStatus: example.coverageStatus,
    evalFixtureId: example.evalFixtureId || null,
    sourceRefs: example.sourceRefs,
  };
}

function selectExamplesForEntries(examples, rankedEntries) {
  const slugRank = new Map(rankedEntries.map((entry, index) => [entry.slug, index]));
  return examples
    .filter(example => slugRank.has(example.guidanceSlug))
    .sort((left, right) => {
      const leftRank = slugRank.get(left.guidanceSlug);
      const rightRank = slugRank.get(right.guidanceSlug);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.sortOrder - right.sortOrder;
    })
    .slice(0, 3);
}

async function buildHelpPanelGuidanceResult({ pool, chatContext, messages = [] }) {
  const context = normalizeChatContext(chatContext);
  if (context.surface !== HELP_PANEL_SURFACE) {
    return {
      context,
      latestQuestion: extractLatestUserQuestion(messages),
      prompt: null,
      matches: [],
      examples: [],
      noMatchReason: "unsupported_surface",
    };
  }

  const latestQuestion = extractLatestUserQuestion(messages);
  const { entries, examples } = await loadGuidanceData(pool);
  const rankedEntryMatches = entries
    .map(entry => ({
      entry,
      score: scoreEntry(entry, context, latestQuestion),
    }))
    .filter(item => item.score >= 35)
    .sort((left, right) => right.score - left.score || right.entry.priority - left.entry.priority)
    .slice(0, 3);

  if (!rankedEntryMatches.length) {
    return {
      context,
      latestQuestion,
      prompt: buildNoGuidancePrompt(context, latestQuestion),
      matches: [],
      examples: [],
      noMatchReason: "no_guidance_match",
    };
  }

  const rankedEntries = rankedEntryMatches.map(item => item.entry);
  const matchedExamples = selectExamplesForEntries(examples, rankedEntries);

  return {
    context,
    latestQuestion,
    prompt: buildGuidancePrompt(context, rankedEntries, matchedExamples, latestQuestion),
    matches: rankedEntryMatches.map(item => summarizeEntryMatch(item.entry, item.score)),
    examples: matchedExamples.map(summarizeExampleMatch),
    noMatchReason: null,
  };
}

async function buildHelpPanelGuidanceSystemPrompt({ pool, chatContext, messages = [] }) {
  const result = await buildHelpPanelGuidanceResult({ pool, chatContext, messages });
  return result.prompt || null;
}

module.exports = {
  HELP_PANEL_SURFACE,
  buildHelpPanelGuidanceResult,
  buildHelpPanelGuidanceSystemPrompt,
};
