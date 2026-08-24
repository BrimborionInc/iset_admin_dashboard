# PATH Capability And Publishing Source Pack

Status: current curated product-truth layer for content production.
Audience: ChatGPT Pro content projects, Bill, marketing/manual reviewers, and Codex support threads.
Last Updated: 2026-08-21

## What This File Proves

This file reconciles current PATH repository knowledge into a conservative publishing baseline. It identifies which capability-level statements are supportable, which procedures still require target-release verification, and which attractive claims must not be made.

It does **not** certify the live environment. No PROD data or session was accessed for this refresh. Recent deployment records, current source, focused tests, maintained guides, and the portal documentation were compared instead.

The current checkout also contains uncommitted admin work. Therefore:

- a current source observation is not automatically a PROD observation;
- a recent changelog entry can describe DEV/TBD work rather than a release;
- exact UI procedures and screenshots must be verified against the intended release before publication.

## Evidence Status Values

| Status | Meaning | Marketing use | Manual use |
| --- | --- | --- | --- |
| `PROD-EVIDENCED` | Recent project release/deployment evidence supports the capability in PROD. This is not a fresh independent live audit. | Qualified present-tense capability wording is permitted. | Use current guide, then confirm exact labels/screens for the target release. |
| `IMPLEMENTED` | Current source and focused tests support the behavior, but current PROD rollout is not established by this pack. | Do not call it live; use only as roadmap/preview with approval. | Mark as DEV/current-source and request verification. |
| `PARTIAL` | The capability exists, but coverage, content, role reach, or operating scope is incomplete. | Describe the narrow supported scope, not the broad category. | State limits and request verification for uncovered tasks. |
| `DEV-ONLY/TBD` | Project guidance explicitly says the workflow is not enabled or rolled out for real use in PROD. | Exclude from current-capability copy unless clearly presented as planned/preview. | Do not provide as a live procedure. |
| `HISTORICAL` | Retained for provenance and not current behavior. | Do not use. | Do not use except in a labelled history/transition note. |
| `UNKNOWN` | Evidence is conflicting, stale, or insufficient. | Request Codex verification before use. | Request Codex verification before writing steps. |

## Product Definition

PATH is an operational system for ISET program delivery. It connects participant-facing intake with staff casework, documents, secure communication, review and decision routing, action plans and interventions, official workflow artifacts, and operational reporting.

Good core wording:

```text
PATH brings intake, casework, documents, review, service delivery, and reporting into one connected operational record.
```

Qualified fuller wording:

```text
PATH helps ISET teams manage participant applications and files, organize evidence and communication, route work through defined roles, generate workflow records, and report from the operational data captured during program delivery.
```

Do not call PATH a generic CRM, an accounting ledger, an autonomous decision system, or a certified compliance platform.

## Product Surfaces And Roles

### Main Surfaces

- **Applicant portal** — public registration/sign-in, applicant dashboard, dynamic intake, uploads, secure messages, documents, and signing tasks.
- **Staff admin console** — work queues, application and case workspaces, assessment/review, documents, messages, action plans, interventions, reporting, configuration, and staff administration.
- **External systems/providers** — authentication, object storage, email/notifications, model providers, Finance/Sage, and ESDC processes. Integration depth and environment enablement vary; never imply every provider action is automatic.

### Business Roles

| Term | Content meaning |
| --- | --- |
| Applicant or participant | Person using the public portal or receiving program services. Use the term that fits the exact screen/process. |
| ISET Coordinator | Common submitter/casework role. |
| Regional Manager | First review level and regional oversight role. |
| Decision Maker | Final business decision role. In the current system this maps to the NWAC Administrator role. Use `Decision Maker` in user-facing copy. |
| System Administrator | Technical support and configuration superuser. Do not present this role as a normal business reviewer or bypass route. |

### Record Vocabulary

| Record | Meaning |
| --- | --- |
| Client/participant | Long-lived person record. |
| Case | Long-lived program file around the participant. |
| Application | A specific intake/submission and its assessment/decision lifecycle. One case can have multiple applications over time. |
| Action Plan | A service/support episode within the case. |
| Intervention | A specific program support linked to an Action Plan. |
| Review workflow | Separate ownership/stage record for submitter, Regional Manager, and Decision Maker actions. It is not interchangeable with application status. |
| Waiting on Applicant | An application-scoped condition derived from unresolved applicant work. It is not the main review stage. |
| Official artifact | A generated or signed document tied to the exact workflow/record/version. Avoid reducing this to “PDF generation.” |

## Current Capability Matrix

### Applicant Experience

| Capability | Status | Publishing boundary | Main evidence |
| --- | --- | --- | --- |
| Public landing, registration, activation, sign-in, recovery | `PROD-EVIDENCED` | Present as applicant account access. Registration alone does not create a case. | `../ISET-intake/src/App.js`; `../ISET-intake/docs/portal/accounts/` |
| Applicant dashboard and start/resume | `PROD-EVIDENCED` | Present as a dashboard for starting/resuming and viewing relevant application/activity states. Exact card labels need current-screen verification. | `../ISET-intake/docs/portal/applications/dashboard-start-resume.md` |
| Dynamic intake, validation, branching, save/resume | `PROD-EVIDENCED` | Present as guided, configurable intake. Do not claim every authored workflow is self-configurable or that autosave is enabled identically in every environment. | `../ISET-intake/docs/portal/intake/core-workflow.md`; `../ISET-intake/docs/portal/intake/submission-flow.md` |
| Conditional/multiple document uploads | `PROD-EVIDENCED` | Present as controlled applicant uploads driven by applicable requirements. Avoid blanket file-type/size claims without current configuration. | `../ISET-intake/docs/portal/intake/document-uploads.md` |
| Submission confirmation and details | `PROD-EVIDENCED` | Present as confirmation/reference and later application history. Submission-detail screenshots are high sensitivity. | `../ISET-intake/src/pages/SubmissionConfirmation.js`; `../ISET-intake/src/pages/SubmissionDetails.js` |
| Repeat-application case reuse and exact lineage hardening | `IMPLEMENTED` | The long-lived case/multiple-application model is established. Do not claim every August containment/correction is deployed without a fresh status check. | `docs/meta/changelog.md`; `../ISET-intake/docs/portal/intake/submission-flow.md` |
| Public AI Help | `PARTIAL` | It provides general help and rejects obvious sensitive/account-specific prompts. Do not claim access to personal files/status or guaranteed answers. | `../ISET-intake/docs/portal/support/help-chat-ai.md` |

### Staff File And Workflow Operations

| Capability | Status | Publishing boundary | Main evidence |
| --- | --- | --- | --- |
| Manage/assign application queues | `PROD-EVIDENCED` | Present as role- and stage-aware work management. Exact queue contents depend on role and current workflow state. | `docs/dashboards/admin-home-my-work-widget.md`; `docs/dashboards/admin-home-approvals-items-widget.md` |
| Application Workspace | `PROD-EVIDENCED` | Present as a connected view of application, form, assessment, documents, messages, notes/reminders, and events. Do not imply every widget appears for every role/layout. | `docs/dashboards/application-assessment-dashboard.md`; `docs/testing/browser-workflow-smoke-automation.md` |
| Case Workspace | `PROD-EVIDENCED` | Present as the long-lived participant/case surface for details, plans, interventions, documents, messages, notes, reminders, and history. | `docs/guides/case-workspace-guidance.md` |
| Batch import, manual/staff-assisted intake, and historical backload | `PARTIAL` | Safe marketing theme: PATH supports transition from existing files and historical records. Exact import matching, account activation, and staff-intake procedures require chapter-level verification. | `docs/guides/client-file-imports.md`; `docs/testing/browser-workflow-smoke-automation.md` |
| Application assessment | `PROD-EVIDENCED` | Present as structured staff assessment with evidence and role-based review. Do not say the system makes the eligibility decision. | `docs/dashboards/application-assessment-dashboard.md` |
| Two-step Regional Manager and Decision Maker review | `PROD-EVIDENCED` | Present as submitter → Regional Manager → Decision Maker, with changes returning one level at a time. Submitted work is read-only except for explicit reviewer-owned controls. | `docs/guides/rm-two-step-review-user-guide.md`; `docs/AGENTS.md` |
| Recalled assessment edit/resubmit | `PROD-EVIDENCED` | The narrow pre-decision recall path is deployed in the admin console: the recorded submitter can edit and resubmit through Regional Manager review. The retained deployment did not include a comprehensive post-deploy workflow journey, so confirm exact screen steps before manual publication. | `docs/meta/changelog.md`; `docs/meta/codex-thread-index.md` |
| Broader correction/reversal/retraction paths | `PARTIAL` | Narrow controls exist, but the general role/action/state/dependency matrix remains incomplete. Do not turn the recalled-assessment fix into one universal correction procedure. | `docs/planning/workflow-policy-uncertainty-register.md`; `docs/AGENTS.md` |
| Action Plans and interventions | `PROD-EVIDENCED` | Present as service-delivery records linked to the case, with proposal/revision review where applicable. Distinguish operational delivery state from proposal/review state. | `docs/guides/case-workspace-guidance.md`; `docs/guides/rm-two-step-review-user-guide.md` |
| Client Monthly Attendance Report | `PROD-EVIDENCED` | Present as a specific secure-message/signing workflow and generated signed record. Do not generalize its exact controls to every signing form. | `../ISET-intake/docs/portal/messaging/signing-requests.md`; `docs/testing/browser-workflow-smoke-automation.md` |

### Documents, Communication, And Records

| Capability | Status | Publishing boundary | Main evidence |
| --- | --- | --- | --- |
| Supporting documents and checklists | `PROD-EVIDENCED` | Present as scoped document collection and evidence visibility. The expanded title/type edit controls are deployed in the admin console, but exact role/dependency behavior still needs screen-level verification before manual publication. | `docs/widgets/admin/supporting-documents-widget.md`; `docs/meta/changelog.md` |
| Secure staff/applicant messaging | `PROD-EVIDENCED` | Present as case-context communication with attachments. Do not expose message contents or imply ordinary email is the secure record. Recent reply-status fixes are not yet deployed. | `docs/data/integrations/secure-messaging.md`; `../ISET-intake/docs/portal/messaging/secure-messaging.md`; `docs/meta/changelog.md` |
| Signing requests and participant tasks | `PROD-EVIDENCED` | Present as portal signing tasks linked to messages and workflow records. Exact form behavior must be verified per workflow. | `docs/features/document-signing.md`; `../ISET-intake/docs/portal/messaging/signing-requests.md` |
| Versioned generated artifacts | `PROD-EVIDENCED` | Present as official workflow records tied to source context/version. Do not claim every document type has identical immutability or signature behavior. | `docs/features/document-signing.md`; `docs/guides/rm-two-step-review-user-guide.md` |
| Bilingual communication/content | `PARTIAL` | Templates and translated content exist, but do not claim the complete product is fully bilingual without a current language QA pass. | `docs/dashboards/template-editor-dashboard.md`; portal source review |

### Funding, Reporting, And External Handoffs

| Capability | Status | Publishing boundary | Main evidence |
| --- | --- | --- | --- |
| Approved funding visibility and financial reporting | `PROD-EVIDENCED` | Present as PATH operational reporting. Finance/Sage remains the accounting system of record. | `docs/dashboards/financial-reports-dashboard.md` |
| Program payment packet dashboard/model | `PARTIAL` | Base admin payment surfaces and packet model have deployment history, but the operating workflow is not fully rolled out for live Finance use. Present only as a controlled/partial capability with product-owner approval. | `docs/features/payments-module.md`; `docs/meta/changelog.md` |
| Real Finance email handoff, follow-up rollout, and Sage Intacct integration | `DEV-ONLY/TBD` | Project guidance says real Finance email sends are not enabled in PROD, and mock/preview behavior is not proof of Sage fidelity. Do not market this as live or write live send instructions. | `docs/AGENTS.md`; `docs/testing/payments-workflow-automation.md`; `docs/planning/intacct-interface-fidelity-audit.md` |
| Data and Results reporting | `PROD-EVIDENCED` | Present as operational dashboards, filters, drilldowns, and exports. Do not promise that every historical decision metric uses a dedicated decision timestamp. | `docs/dashboards/data-and-results-dashboard.md` |
| Financial Reports | `PROD-EVIDENCED` | Present as annual advances/active-client operational reporting with filters and export. Keep PATH-vs-accounting caveat. | `docs/dashboards/financial-reports-dashboard.md` |
| ILMP/ESDC participant queues and XML/export history | `PARTIAL` | The PATH preparation/export flow exists; external ESDC upload remains a manual boundary. Detailed blocker remediation and broader policy guidance are incomplete. | `docs/workflows/admin/ilmp-reporting.md`; `docs/planning/admin-ai-chatbot-coverage-register.md` |

### Configuration, Access, And Support

| Capability | Status | Publishing boundary | Main evidence |
| --- | --- | --- | --- |
| Workflow/intake authoring | `PROD-EVIDENCED` at capability level | Present as administrator tooling for steps, components, workflow structure, preview, and publishing. Do not say any staff member can safely change any workflow without governance. | `docs/guides/workflow-studio.md`; `docs/testing/browser-workflow-smoke-automation.md` |
| Configurable dashboards and table controls | `PROD-EVIDENCED` | Present as customizable operational views on supported pages. Do not imply every page has the same widget/layout behavior. | `docs/guides/configurable-dashboard-notes.md` |
| Notifications and templates | `PARTIAL` | Configurable event/role/template infrastructure exists. Exact recipient and email behavior varies by event and enabled configuration; verify before procedural claims. | `docs/dashboards/manage-notifications-dashboard.md`; `docs/dashboards/template-editor-dashboard.md` |
| Staff/user and participant-account management | `PROD-EVIDENCED` at capability level | Present as role-scoped administration. Avoid public role-matrix detail, private staff data, or claims that Cognito alone defines business scope. | `docs/features/user-management.md`; `docs/AGENTS.md` |
| Contextual help, training, tutorials | `PARTIAL` | Help panels and training/tutorial infrastructure exist; content coverage varies by surface. | `src/helpPanelContents/`; `docs/training/` |
| Admin Ask the AI guidance | `PARTIAL` | Coverage is intentionally narrow. On 2026-08-21 the route register had 48 rows: 41 inventory-only, 5 partial, 1 source-only, 1 defer, and 0 verified. Eval inventory had 21 fixtures: 11 verified and 10 drafted; the checker validates fixture shape rather than calling the model. Do not market it as comprehensive product support. | `docs/features/admin-ai-guidance.md`; `docs/planning/admin-ai-chatbot-coverage-register.md`; `docs/testing/admin-ai-chatbot-evals.md` |
| Role-based access, scoped records, audit/privacy controls | `PROD-EVIDENCED` at capability level | Safe wording: designed with role-based access, scoped records, secure document handling, audit events, and privacy controls. Do not claim certification, perfect coverage, or zero risk. | `docs/features/public-portal-security-features.md`; `docs/planning/privacy-security-systematic-review-2026-04-25.md` |
| Accessibility | `PARTIAL` | Accessibility-aligned patterns and automated checks exist, but authenticated, keyboard, screen-reader, reflow, and language-context testing remain manual gaps. Do not claim blanket WCAG compliance. | `../ISET-intake/docs/portal/accessibility/wcag-public-audit.md` |

## Important Current Release Boundaries

These are the main facts that override older broad feature descriptions:

- The Regional Manager two-step workflow is enabled for application assessments, new intervention proposals, and intervention revisions in DEV/TEST/PROD. Use `Decision Maker` for the final actor.
- The public intake completion flow has deployed validation/transaction evidence. August repeat-application and correction hardening includes current-source work whose exact PROD state must still be checked before manualizing the new edge paths.
- The Client Monthly Attendance Report has PROD release evidence; later generic signing hardening still has mixed candidate/source status.
- The payment email workflow has DEV automation and historical TEST rehearsal but is not enabled for real PROD Finance sends.
- The 2026-08-19 secure-message follow-up status fix is ready for a future release and explicitly not deployed.
- Admin-only release `20260818-admin-workflow-fixes-r2` deployed the recalled-assessment edit/resubmit path and expanded supporting-document title/type editing to PROD from clean admin commit `97296304c7ea`. It truthfully recorded `UNQUALIFIED`, deployed no portal/shared/schema/data changes, and retained no smoke targets; treat this as exact admin artifact deployment evidence, not comprehensive workflow acceptance.
- Admin AI knowledge coverage remains narrow. Inventory counts are not verification.
- No marketing/manual screenshot has yet completed the curated approval workflow.

## Safe Marketing Claims

These claims are acceptable when written as capabilities rather than absolutes:

- PATH connects participant intake and staff casework around an operational client/case/application record.
- Guided intake, conditional questions, validation, and document collection help structure submissions.
- Role-based queues and a two-step review path make review ownership and handoffs visible.
- Documents, secure messages, notes, reminders, decisions, and signed/generated records stay connected to the file context.
- Action Plans and interventions carry the record from application decision into service delivery.
- Operational dashboards, drilldowns, and exports help teams report from PATH data.
- Migration, manual-entry, and historical backload tools support transition from existing files, subject to verified implementation scope.
- PATH is designed with role-scoped access, audit events, and privacy-conscious document and communication flows.

## Claims That Require New Evidence

Do not publish these without a successful Codex request and appropriate review:

- customer outcome improvements, time saved, error reduction, adoption, satisfaction, or ROI;
- testimonials, customer counts, transaction volumes, uptime, response time, scalability, or performance;
- competitive superiority or “only”/“best” claims;
- complete bilingual coverage;
- blanket WCAG conformance;
- a named security/privacy/compliance certification;
- full product AI coverage or model accuracy;
- live automated Finance/Sage/ESDC submission beyond the explicitly proven boundary;
- “real-time” reporting or accounting truth;
- “fully configurable” or “no technical help required”;
- “paperless,” “fully automated,” or “no staff review required.”

## Manual Readiness

### Strong Starting Material

- Two-step staff review: `docs/guides/rm-two-step-review-user-guide.md`
- Portal accounts/intake/dashboard: `../ISET-intake/docs/portal/`
- Portal signing: `../ISET-intake/docs/portal/messaging/signing-requests.md`
- Financial Reports: `docs/dashboards/financial-reports-dashboard.md`
- Case Workspace context: `docs/guides/case-workspace-guidance.md`
- Workflow Studio: `docs/guides/workflow-studio.md`

### Mandatory Verification Before Final Manual Steps

- current screen labels, buttons, role visibility, defaults, and error messages;
- secure-message compose/reply/status semantics;
- supporting-document title/type/edit restrictions;
- repeat-application and returned/correction edge paths;
- manual/staff-assisted intake matching and account decisions;
- notification/email recipient behavior;
- ILMP validation remediation and external handoff;
- all payment send/follow-up instructions;
- every AI-assisted task;
- every screenshot.

Use `docs/product/codex-support-handoff.md` to turn each unresolved item into a narrow evidence request.

## Internal Information Excluded From Public Drafts

Do not surface:

- named applicants, clients, staff, approvers, email addresses, role assignments, or case histories;
- live case/application/submission/payment/message/document IDs;
- incident repairs, database artifacts, environment account details, hostnames, storage keys, release bypass details, or credentials;
- raw routes/API endpoints unless writing an internal technical manual;
- named approval-authority details. Public copy may say high-value approvals have restricted authority; exact internal assignment belongs only in approved staff guidance.

## Maintenance Sources

This pack was reconciled from:

- `docs/AGENTS.md`
- `docs/meta/changelog.md`
- `docs/meta/next-release-notes-log.md`
- `docs/planning/path-promo-website-source-brief.md`
- `docs/planning/admin-ai-chatbot-coverage-register.md`
- `docs/inventory/admin-functional-scope-register.md`
- current admin routes, help panels, browser smokes, and focused tests
- `../ISET-intake/docs/AGENTS.md`
- `../ISET-intake/docs/portal/`
- current portal routes, pages, and focused tests

For the next refresh, compare exact claims with current source and the intended deployed environment. Do not merely advance the date.
