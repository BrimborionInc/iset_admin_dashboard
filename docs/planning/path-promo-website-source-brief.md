# PATH Promo Website Source Brief

Status: current detailed marketing raw material. `docs/product/path-capability-source-pack.md` controls release status and publishing boundaries.
Audience: Bill, product/content collaborators, and AI tools drafting the PATH promotional website.
Last Updated: 2026-08-21

## Purpose

This file is source material for drafting a promotional website for PATH. It is intentionally broader and more detailed than final website copy should be.

Use it to help ChatGPT Pro or another writing tool understand what PATH does, what value it creates, and which features should be considered when shaping website content. The drafting tool should decide how to organize and simplify the material for public-facing copy.

Do not upload or use this file by itself. Start with `docs/product/README.md`, upload the curated capability source pack and ChatGPT project instructions, and treat any conflict there as an override of this broader inventory.

The recommended marketing approach is layered:

- Lead with a clear promise.
- Present 5-6 main product pillars.
- Include a deeper capabilities section to show PATH is fully featured.
- Use a "follow the file" story to show integration across intake, casework, documents, approvals, funding, and reporting.
- Give migration/onboarding, audit, official artifacts, and reporting explicit visibility because they are trust-builders.

## Current Publishing Boundary

As of 2026-08-21:

- The submitter → Regional Manager → Decision Maker two-step review capability is deployed for application assessments, new intervention proposals, and intervention revisions.
- Admin-only release `20260818-admin-workflow-fixes-r2` deployed recalled-assessment edit/resubmit and expanded supporting-document title/type editing. It did not deploy portal/shared/schema/data changes and retained no smoke targets, so exact manual steps still require targeted screen verification.
- Core portal account, intake, upload, dashboard, messaging, and signing capabilities have PROD evidence. Newer August portal repeat-application/case-reopen changes remain current-source/DEV, not current PROD evidence.
- The Payments dashboard/model is partial. Real Finance email routing/sends are not enabled in PROD, and PATH is not the Finance/Sage system of record.
- Admin AI guidance is intentionally narrow and must not be described as complete product coverage.
- No marketing/manual screenshot has completed the curated synthetic-data approval workflow yet.

Use `docs/product/codex-support-handoff.md` whenever a claim, UI label, role, procedure, or screenshot needs current evidence.

## Ready-To-Use Prompt For ChatGPT Pro

Paste the prompt below, then provide the rest of this file as source material.

```text
You are helping draft content for a promotional website for PATH, an operational system for ISET program delivery.

Use the source brief I provide as raw material. Do not turn every feature into equal-weight homepage copy. Create a layered website content draft:

1. A sharp homepage promise.
2. 5-6 main value pillars.
3. A "follow the file" journey showing how PATH connects intake, casework, documents, approvals, approved-funding visibility, official artifacts, and reporting.
4. A migration/onboarding section showing how existing and historical files move into PATH.
5. A deeper capabilities section grouped by product area, showing the breadth of verified PATH capability without implying that every source feature is enabled in PROD.
6. Suggested section headings, subheadings, short body copy, and callout text.
7. Optional alternative taglines and hero copy.

Important constraints:

- Write for program leaders, administrators, casework managers, funders, compliance reviewers, and staff who need confidence that PATH is operationally mature.
- Do not make PATH sound like a generic CRM.
- Do not describe PATH as replacing Sage or the finance/accounting system of record. Approved-funding reporting is live; payment-packet/evidence/follow-up surfaces are partial, and real Finance email/Sage handoff is not PROD-enabled.
- Do not describe real Finance email sending or Sage Intacct integration as a current live capability; those functions remain outside the enabled PROD operating boundary.
- Do not imply AI makes eligibility or funding decisions.
- Do not over-focus on "PDF generation" as a technical utility. Instead, describe official, versioned, auditable artifacts generated from workflow data.
- Keep the copy plain, concrete, and credible.
```

## Executive Positioning

PATH is the connected operating system for ISET delivery. It brings intake, casework, documents, secure participant communication, approvals, approved-funding visibility, official artifacts, and reporting into one auditable workflow.

PATH is not just a staff dashboard. It is a program delivery backbone:

- Applicants use the public portal to register, apply, upload documents, receive secure messages, and sign forms.
- Staff use PATH to receive and assign applications, assess eligibility, request missing information, manage documents, review cases, record approvals, and manage action plans and interventions. Payment-packet and Finance-handoff functions are a separate partial rollout and must not be folded into the live core claim.
- Managers use PATH to see role-based queues, bottlenecks, overdue work, regional workload, review stages, and exception items.
- Administrators configure workflows, templates, notifications, document requirements, staff access, dashboards, and assignment rules.
- Reporting users use PATH data to produce operational reports, financial views, regional summaries, drilldowns, ILMP/ESDC-aligned outputs, and exports.

Short core promise:

```text
PATH brings ISET intake, casework, documents, approvals, approved-funding visibility, and reporting into one auditable workflow.
```

Slightly fuller version:

```text
PATH gives ISET teams one place to manage participant files, generate official records, track decisions and evidence, move existing history into the system, and report from the work already being done.
```

## Primary Website Story

The website should not start with a long feature list. Start with the problem PATH solves:

- Program work is often scattered across portals, spreadsheets, email, Word documents, local folders, payment trackers, and manually assembled reports.
- Staff may retype the same participant and funding information into multiple forms.
- It can be difficult to know which documents are missing, which approval stage a file is in, whether follow-up has happened, and what evidence supports a decision.
- Historical records create an adoption challenge because organizations do not start from an empty system.
- Reporting becomes slower and less reliable when the source data lives in many places.

PATH's answer:

- One client/case file.
- One connected workflow from intake to decision and service delivery.
- Official versioned artifacts generated from workflow data.
- Migration tools for existing and historical files.
- Compliance, audit, signatures, and evidence built into the work.
- Reporting that comes from the operational record instead of spreadsheet reconstruction.

## Recommended Top-Level Pillars

Use these as homepage pillars, not as the full feature list.

### 1. Everything In One Client File

Applications, documents, signed forms, secure messages, notes, reminders, case history, action plans, interventions, approved-funding context, and generated artifacts are organized around the participant and case.

Why it matters:

- Staff can see the whole file in context.
- Documents and messages are not scattered across email and folders.
- Casework can continue even when staff change.
- Reviewers can inspect the source material behind a decision.

### 2. Workflow From Intake To Decision

PATH tracks the file through assignment, EI verification, assessment, Regional Manager review, Decision Maker approval, returned changes, post-decision follow-up, intervention proposals, amendments, and funding agreement steps. Describe payment readiness only as a partial/controlled capability until the real Finance workflow is enabled.

Why it matters:

- Staff know what is next.
- Managers see where work is waiting.
- Submitted items become read-only while under review.
- Returned changes carry notes and context back to the right role.

### 3. Official Records Without Retyping

PATH reuses intake and staff-entered data to create assessments, signed forms, funding documents, financial overviews, decision records, review packets, letters, reports, and exports.

Why it matters:

- Less duplicate entry.
- Fewer inconsistencies between forms and reports.
- Official artifacts are tied back to the source record.
- Generated PDFs capture the version of the workflow at the moment they are created or signed.

### 4. Move Existing Files Into PATH

PATH supports transition from spreadsheets, paper, and pre-existing systems through batch import, manual entry, application-less client files, historical documents, backloaded action plans, past interventions, and historical funding records.

Why it matters:

- Organizations do not have to start from zero.
- Historical cases do not need fake portal applications.
- Existing file history can be preserved while current work continues in PATH.
- Adoption is more realistic for live programs.

### 5. Audit, Compliance, And Evidence Built In

PATH ties documents, signatures, notes, decisions, review stages, generated PDFs, status changes, and workflow events to actors, timestamps, and case context.

Why it matters:

- Reviewers can see what evidence supported a decision.
- Compliance checklists show what is missing.
- Important transitions leave a durable trail.
- Sensitive records are handled through role-scoped access and secure document flows.

### 6. Reporting That Comes From The Work

PATH turns operational activity into Data and Results reports, financial reports, regional summaries, drilldowns, ILMP/ESDC-aligned outputs, approved-funding visibility, and exports.

Why it matters:

- Reporting is less dependent on manual spreadsheet reconstruction.
- Numbers can drill back to the source records.
- Program, regional, and funding views stay connected to casework.
- Staff can review approved funding and follow-up status from the same operational data.

## Full Feature Inventory

This section is intentionally detailed. A website should group and select from it rather than presenting every point at once.

### Public Portal And Applicant Experience

PATH includes a public-facing participant portal connected to the admin system.

Capabilities:

- Applicant account registration and sign-in through Cognito.
- Email confirmation and password reset/set-password flows.
- Secure token handling through HttpOnly cookies.
- Applicant dashboard for starting, resuming, and managing applications.
- Dynamic step-by-step intake workflow.
- Save and finish later for the main intake.
- Optional server-side autosave for recoverable drafts.
- Branching and conditional step/field visibility based on applicant answers.
- Required field validation, format checks, error summaries, warnings, and accessibility-aligned GOV.UK-style forms.
- Conditional document upload requirements tied to applicant answers.
- Submission confirmation with reference/tracking ID and timestamp.
- Public secure messaging for applicant/staff communication after the case context exists.
- Applicant replies with attachments that can become supporting documents in the admin file.
- Portal document-signing tasks for workflows sent by staff.
- Signed form completion through the same renderer pattern used for intake.

Value story:

- Applicants have a guided, accessible application path.
- Staff receive structured submissions instead of reconstructing data from email and paper.
- Uploaded documents and signed forms become part of the operational record.
- Secure messages keep sensitive communication inside PATH.

Careful language:

- Registration alone does not create a case. A case is created when an application is submitted or when staff migrate/import a client file.
- Do not imply all portal features are self-service for every historical case. Some messaging/signing depends on account and case context.

### Intake Authoring And Workflow Configuration

PATH includes tooling for administrators to configure intake and consent-style workflows.

Capabilities:

- Manage Intake Steps page with step library, filtering, create/modify/delete, usage visibility, preview, and JSON inspection.
- Modify Intake Step editor with component library, working preview area, component ordering, labels, properties, translations, validation, and conditional visibility.
- Manage Workflows page with workflow library, workflow properties, preview graph, runtime schema inspection, and workflow preview.
- Workflow canvas for drag/drop steps and routing.
- Conditional routing and branching rules.
- Runtime schema publishing so the public portal uses the configured workflow.
- Component templates and schemas for authoring supported input types.
- Whole-step skip behavior when authored conditions hide all renderable content.
- Workflow types that distinguish main intake from standalone consent/signing forms.
- Workflow preview graph with pan/zoom, minimap, and layout options.

Value story:

- PATH is configurable as program forms evolve.
- Intake, consent forms, and signing workflows can reuse the same authoring and rendering model.
- Admins can preview workflows before publishing them to applicants.

Careful language:

- Do not say non-technical staff can safely change every workflow without governance. Position this as administrator/configuration tooling.

### Migration And Historical File Onboarding

This should be a major website section. PATH does not assume a program starts with a blank database.

Capabilities:

- Batch client-file import from `.xlsx`, `.xlsm`, or `.csv`.
- Dry-run preview before import writes occur.
- Header row detection and field mapping support for spreadsheet variations.
- Import recognition for identity, contact, address, Indigenous identity, SIN, and related profile fields.
- Duplicate detection inside the upload and against existing client records.
- Matching by SIN, prior case/submission SIN, normalized email, name plus date of birth, and stricter name-only fallback when DOB is missing.
- Commit modes that create a new client and application-less case, create a case for an existing client, or update an existing case.
- When an import row has exactly one clean valid email, the current commit path can silently create/link the applicant account without sending an activation email. Missing, invalid, ambiguous, or multiple emails leave account creation for later staff review.
- Import does not fabricate historical applications, submissions, assessments, plans, interventions, or placeholder workflow records. Authorized staff can later send/resend the separate PATH activation email where appropriate.
- Manual application/intake paths for staff-entered or paper-origin files.
- Application-less client files for historical records where no portal submission exists.
- Explicit backload quick actions for existing/historical action plans, interventions, and documents.
- Historical action plans and interventions added without pretending they are new workflow events.
- Historical finance/funding amounts recorded for reporting/budget burn without turning them into live payment packets.
- Existing documents uploaded directly into client/case/action-plan context.

Value story:

- PATH supports real-world adoption where existing client records already exist.
- Historical work can be preserved without fabricating fake applications or corrupting the workflow model.
- Staff can move from spreadsheets and paper into live casework gradually and defensibly.
- Imported records can later be connected to applicant accounts when appropriate.

Potential website heading:

```text
Move into PATH without losing your history.
```

Potential body copy:

```text
PATH includes migration tools for existing caseloads, paper files, and historical records. Teams can batch-import client files, manually enter applications, upload existing documents, backload past action plans and interventions, and preserve funding history without creating false portal submissions.
```

### One Client File And Case Workspace

The Case Workspace is the staff operating surface around the long-lived client/case record.

Capabilities:

- Case header with client name, case number, status, owner, and updated timestamp.
- Participant details stored as case-level source of truth for identity and contact information.
- Editable participant details aligned to intake/reporting fields.
- Masked SIN display with validation and controlled storage.
- Action plans sorted by recency and linked to review dates/reminders.
- Interventions tied to action plans, funding streams, NOC/intervention reference data, recurrence/cost metadata, statuses, and outcomes.
- Case notes and reminders.
- Case calendar/list view of reminders and deadlines.
- Secure Messaging widget for staff/applicant conversations.
- Supporting Documents widget shared with Application Workspace.
- Quick actions for adding historical action plans, interventions, and documents.
- Reopen/recovery workflow for closed plans when circumstances change.
- Backloaded intervention guardrails that preserve lifecycle integrity.
- Imported/application-less case support.

Value story:

- The case file is not just a folder. It contains the participant profile, plans, interventions, communications, reminders, documents, and history needed for service delivery.
- Staff can work from the case context instead of jumping between disconnected tools.
- Historical and active work are clearly distinguished.

### Application Workspace And Assessment

PATH includes an operational dashboard for reviewing and adjudicating individual applications.

Capabilities:

- Application Overview with status badge, timeline/status progression, quick layouts, quick actions, and view audit trail entry.
- ISET Application Form view of the submitted application.
- Lock-protected edit mode for submitted application data where allowed.
- Version history and restore for application form data.
- Edit disabled when a final decision or withdrawn status makes the record read-only.
- Application Assessment workflow with declaration, recommendations, eligibility, intervention details, and review submission.
- EI verification tracking.
- Conflict-of-interest declaration and locking patterns.
- Supporting Documents view scoped to application/case context.
- Secure Messaging inside application review.
- Notes and Reminders.
- Case Calendar.
- Application Events timeline.
- Document request flags that can overlap application status.
- Docs requested and closure notice workflow states.
- Application on-hold/parking workflow with reason, note, and review reminder.
- Withdrawal flow that preserves reporting structures.

Value story:

- The application review surface brings together the form, documents, messages, notes, deadlines, assessment, and audit history.
- Staff can request changes or missing information while keeping the file state visible.
- Reviewers see the record and supporting material in one workspace.

### Review, Approval, And Decision Workflow

PATH has structured review and approval flow rather than informal email approval.

Capabilities:

- Role-based queues for submitted assessments and intervention proposals.
- Two-step Regional Manager review workflow for application assessments, new intervention proposals, and intervention amendments/revisions.
- Regional Manager review/sign-off before final Decision Maker action.
- RM can return to submitter with notes or submit for final decision.
- Decision Maker can approve, deny/reject, or request changes.
- Decision Maker request-changes returns to RM first, then RM forwards to the submitter with notes.
- Submitted packet body is read-only while with RM or Decision Maker.
- Submitter edits are allowed only when the workflow is returned to them.
- Review workflow events record actor, role, timestamp, action, stage transition, notes, and subject context.
- Review/decision notes are mirrored into case notes for easy discovery.
- Final generated PDFs can include submitter evidence, RM sign-off, and Decision Maker final decision evidence.
- High-value funding approvals use a restricted designated authority; other Decision Makers may still deny or request changes. Do not put the designated person's name or email in external copy or an external AI upload.
- Queue deep links open the relevant workspace in a review-focused layout and step.

Value story:

- PATH makes approval routing visible and auditable.
- Review notes do not get lost in email.
- Each role sees the work waiting for them.
- Final records show who reviewed and who decided.

Careful language:

- Say "Decision Maker" for the final-decision actor in user-facing copy.
- Do not use "NWAC" as shorthand for the approver because coordinators and Regional Managers are also NWAC staff.

### Role-Based Queues And Oversight

PATH home dashboards present role-aware operational queues.

Capabilities:

- NWAC Administrator queues for application pipeline, all cases, conflicts, escalations, payment issues, watchlist hits, overdue items, and pending decisions.
- Regional Manager queues for regional applications, personal applications, pending review, regional cases, and exceptions.
- ISET Coordinator queues for assigned applications, assigned clients, missing documents, EI verification, ready-to-assess work, awaiting approval, funding agreements/follow-up, active clients, check-ins, milestones, and on-hold work.
- Shared Work Queue Items table that changes column set based on selected queue.
- Assignment/reassignment actions where appropriate.
- Queue deep links into the right workspace and context.
- SLA/due/overdue badges and timeline target display.
- On Hold queue for parked applications with future review date.
- Pending Completion queue for approved/denied post-decision follow-through.
- Exceptions and escalations surfaces.
- Watchlist hits and unresolved conflict queues.

Value story:

- Staff start from the work that belongs to them.
- Managers can see bottlenecks and exception queues.
- Work progresses through visible stages rather than disappearing into personal tracking sheets.

### Documents, Checklists, And Evidence

PATH has a unified document model and supporting-document workspace.

Capabilities:

- Documents from portal submissions, secure message attachments, manual uploads, and generated forms appear in one document library.
- Document search over label, filename, type, source, reference, and scope.
- Sortable/resizable document table with stored preferences.
- Application Workspace document filtering by application.
- Case Workspace document filtering by intervention/action-plan context.
- Checklist tab for applicant/application-backed contexts.
- Document type catalogue and scope rules.
- Upload flow that enforces client/application/case/action-plan/payment-packet scope.
- Case-backed document mode for imported or application-less cases.
- Word document preview handling through internal cached PDF/HTML preview rather than handing sensitive Office files to browser/Microsoft 365 rendering.
- Privileged original-file download action for System Administrator and NWAC Administrator roles only, with privacy warning confirmation.
- Inline document label editing.
- Duplicate document handling.
- Secure message attachment adoption into supporting documents.
- Manual upload support for PDF, common images, and Word documents.
- Required evidence/checklist relationship for payments and program file completeness.

Value story:

- Staff can see what has arrived, what was generated, what was signed, and what is still missing.
- Documents are attached to the right case/application/action-plan/payment context.
- Sensitive original downloads are restricted.
- Historical files can manage documents without fake applications.

### Official Documents, PDFs, And Versioned Artifacts

This deserves explicit marketing visibility. Do not reduce it to "PDF generation." The stronger concept is official, versioned, auditable artifacts generated from workflow data.

Capabilities:

- PATH generates official PDFs and artifacts from current workflow data.
- Generated artifacts can represent a snapshot of the record at a specific moment.
- Signed portal workflows produce signed PDF artifacts and store them in the supporting document library.
- Application assessment approval records can include submitter evidence, RM sign-off, and Decision Maker final decision.
- Denial/approval letter flows create durable follow-up records.
- Client Funding Agreement workflows can prefill from case/intervention/funding data.
- Financial Overview signing requests can be prefilled with PATH data or sent blank, then signed by the participant.
- Submitted participant values can update case context while preserving the original application payload.
- Generated documents are tied to case/client/application/workflow context.
- Word/PDF preview and original-download controls protect artifact access.
- Review packets, signed forms, funding agreements, financial overviews, decision records, approval evidence, and generated letters can be represented as artifacts in the file.

Value story:

- Staff do not have to rebuild official forms manually from scattered data.
- Official documents are created from the same source data staff already use.
- Signed and decision-linked artifacts preserve evidence for later review.
- Versioned artifacts help explain what was known, signed, and approved at a specific point in time.

Potential website heading:

```text
Official records generated from the workflow.
```

Potential body copy:

```text
PATH turns application, case, review, funding, and signature data into official, versioned artifacts. Assessments, signed forms, funding agreements, financial overviews, decision evidence, and letters can be generated from the record and stored back on the client file.
```

### Secure Participant Communication And Signing

PATH keeps applicant/staff communication connected to the case.

Capabilities:

- Secure Messaging in the admin workspace.
- Public portal Inbox/Sent/Deleted message views.
- Staff-to-applicant messages.
- Applicant-to-staff messages.
- Attachments on messages.
- Attachment adoption into supporting documents.
- Direction-specific notifications for applicant-origin and staff-origin messages.
- Document requests through secure messages.
- Signing requests attached to secure messages.
- Participant task list for documents to sign.
- Signed forms stored as official artifacts.
- Outstanding signing status visible in the workflow.
- Earlier unsigned versions can be withdrawn when a new Financial Overview request is sent.

Value story:

- Sensitive participant communication stays in PATH instead of ordinary email.
- Staff can request missing documents and signatures from the case context.
- Signed documents become part of the client file automatically.

### Action Plans, Interventions, And Service Delivery

PATH supports work beyond application intake and approval.

Capabilities:

- One client -> one long-lived case -> many applications and service episodes.
- Action plans represent episodes of support inside the case.
- Interventions are linked to action plans.
- Intervention codes and outcomes use ESDC/ILMP reference data.
- Interventions include schedule, cost/funding, NOC information where relevant, childcare and training context where relevant.
- Recurring cost metadata can be preserved while reporting a single total.
- Intervention statuses separate proposal/review state from delivery state in the target model.
- Open intervention saves clear stale outcome values; final outcome is captured at closeout.
- Future-dated, draft, planned, active, suspended, completed, cancelled, and archived lifecycle rules are handled carefully.
- Completed/cancelled interventions carry final outcome and actual cost.
- Proposed new interventions and amendments/revisions go through review and approval.
- Approved revisions reset follow-up for revision-specific letters/funding documents.
- Historical/backloaded interventions are silent historical records and do not create live payment side effects.

Value story:

- PATH covers the service delivery record, not only the initial application.
- Action plans and interventions connect program work to funding, documents, reporting, and closeout evidence.

### Funding, Payment Packets, And Finance Follow-Up (Partial / Controlled Rollout)

PATH has program-side funding visibility plus implemented payment-packet, evidence, and follow-up surfaces. The real Finance email workflow is not rolled out or enabled in PROD, so this section is target/partial capability material rather than a present-tense live marketing claim.

Capabilities:

- Approved funding tied to interventions and budget pots.
- Payment Packet as canonical workflow record for payment requests.
- Payment lines for payable units such as living allowance, tuition, reimbursements, equipment, or TWS supports.
- Evidence checklist per packet/line.
- Payment-type gates for required evidence.
- Living allowance, tuition, reimbursement, specialized equipment, and TWS evidence rules.
- Packet statuses such as Draft, Ready to send, Sent to finance, Payment confirmed, Cancelled.
- Line statuses derived from evidence/readiness/payment state.
- Create packet from case context or program payments dashboard.
- Payment packet creation can derive reporting unit, pot, and amount from selected intervention.
- Partial payments and service period fields where relevant.
- In the target enabled workflow, send-to-finance locks edits once sent.
- Follow-up status such as draft, ready to send, sent to finance, needs follow-up, reported paid, confirmed by evidence, stale/no response, and cancelled.
- Posted PATH-side finance transactions when payment is confirmed.
- Historical finance entries for backloaded interventions.
- Cross-client Program Payments dashboard and case-scoped payment widgets share the same data model.
- Finance Reports show approved funding and PATH payment follow-up state.

Value story:

- Once deliberately rolled out, program staff can prepare, validate, evidence, and track payment requests.
- The implemented surfaces are intended to show what is ready, what is missing evidence, and what needs follow-up.
- PATH improves operational visibility without pretending to be the accounting ledger.

Required caution:

- PATH is not the Finance/Sage system of record.
- Do not say PATH currently sends real Finance emails or posts to Sage Intacct. Until rollout, describe only the partial packet/evidence/follow-up design with an explicit availability qualification.

### Reporting, Data, Results, And Exports

PATH turns operational data into reporting surfaces and exports.

Capabilities:

- Data and Results dashboard.
- Intake and Assessment reporting by province/territory and month.
- Application counts for new, approved, and denied applications.
- Interventions reporting by type, count/cost, status, and date basis.
- Overall Results and Client Results sections.
- Quarterly Data Uploads section.
- ILMP Data Uploads section.
- Status of Action Plans section.
- Shared report controls for province/territory, case manager, fiscal year, cumulative/monthly view, and demo mode.
- Drilldowns from non-zero cells to source application/intervention/payment allocation records.
- Applicant/case links from drilldown rows into workspaces.
- CSV export of visible filtered views.
- Financial Reports dashboard for the annual ISET Advances and Active Clients report.
- Financial report controls for fiscal year, region, carry-over inclusion, funded-only/all-reportable row scope, and local filtering.
- Financial summaries by total advances, CRF, EI, funded clients, and interventions.
- Region summary table.
- Intervention detail table and Excel export with Summary, CRF Detail, and EI Detail tabs.
- Optional carry-over estimates.
- ILMP/ESDC-aligned participant exports and XML generation flows.
- Recent ILMP exports history and requeue behavior.
- Query Editor and other administrative reporting tools for controlled internal analysis.

Value story:

- Reports are built from the operational data PATH already collects.
- Drilldowns help explain where numbers come from.
- Financial and operational views are connected but not falsely collapsed into one accounting ledger.

Careful language:

- Some approval/denial month buckets currently use application updated timestamps as the best available proxy until dedicated decision-event timestamps exist. Public copy can avoid this nuance by saying reports and drilldowns are generated from PATH operational records.

### Notifications, Templates, And Communication Configuration

PATH includes configurable notification infrastructure.

Capabilities:

- Notification Settings dashboard for event/role/language rows.
- Bell alert and email alert toggles.
- Template assignment by event and role.
- Shared PATH sender settings for generated email.
- Direction-specific secure-message notification routing.
- Owner-scoped applicant message alerts.
- Assignment and reassignment event notifications.
- Regional Manager review handoff notifications.
- Staff notification rail in the admin shell.
- Template Editor dashboard for bilingual subject/body drafting.
- Formatting toolbar for bold, italic, underline, lists, and links.
- Placeholder/token picker for case, applicant, staff, event, intervention, decision, and link fields.
- Preview scenario selector.
- AI translation helper with guardrails.
- Localized English/French template bodies.
- Runtime sender configuration used by admin and portal mailers.

Value story:

- PATH can notify the right people at the right workflow moment.
- Template content can evolve without code changes for routine communication patterns.
- Bilingual communication support is part of the configuration model.

### User, Access, And Participant Account Management

PATH includes administrative account-management surfaces.

Capabilities:

- Staff access management for Cognito-backed staff/admin accounts.
- Create users, disable/enable, force reset, resend invite, change role, remove role, and edit profile names.
- Role guard matrix for who can manage which staff roles.
- DB-backed staff profiles and region access.
- Regional Managers can manage ISET Coordinators within allowed boundaries.
- Participant PATH Accounts tab for imported/linked applicant accounts.
- Applicant account status filters such as No account, Ready to invite, Invitation sent, Activated.
- Silent applicant account creation/linking for imported clients.
- PATH-branded activation email.
- Portal activation through set/reset-password style flow.
- Search, filters, pagination, sorting, column preferences.

Value story:

- PATH supports staff onboarding, access control, regional visibility, and participant activation from the same operational admin environment.

### Security, Privacy, And Compliance Controls

PATH has multiple layers of privacy and access protection.

Capabilities:

- Cognito-backed authentication.
- Role-based access control across routes and APIs.
- Backend authorization, not only frontend hiding.
- Scoped case/application/document access.
- Portal tokens stored in HttpOnly cookies.
- RS256 JWT validation.
- Session auditing with hashed IP/user-agent details where available.
- Server-side intake state; ephemeral intake answers are not stored in browser storage.
- Drafts and intake history handled through server-side APIs.
- File upload policy enforcement.
- MIME/magic-number sniffing for uploads.
- Controlled object storage/presigned URL paths.
- Event/audit logging for significant actions.
- Role-restricted original document download.
- Masked SIN display and watchlist payload masking.
- Applicant watchlist dashboard restricted to authorized roles.
- Admin AI filters obvious raw identifiers before sending content to external model provider.
- Public AI support filters obvious sensitive prompts/history.
- Debug/dummy-data routes gated behind explicit unsafe-dev flags and admin roles.

Value story:

- PATH is designed around sensitive program data.
- Access, audit, document scope, and session controls are part of the operating model.
- Staff can work with sensitive records without moving them into informal channels.

Careful language:

- Do not imply PATH is certified to a particular external security standard unless that certification exists.
- Phrase as "designed with role-based access, secure document handling, audit events, and privacy controls."

### Configurable Dashboards And Admin Operations

PATH has configurable dashboard and administrative surfaces.

Capabilities:

- Cloudscape-style configurable boards on many operational pages.
- Add widget/reset layout patterns where applicable.
- Table search/filter/sort/pagination/column preferences across many dashboards.
- Work queue preference controls.
- Dashboard help panels and AI context.
- Document checklist configuration.
- Runtime config values for workflow, notification, and feature flags.
- Auto-assignment rules by province, Indigenous group, or always-match conditions.
- Applicant Watchlist dashboard for SIN-based watchlist entries.
- Admin feedback/bugs/change requests dashboard and triage workflow.
- Tutorial platform for staff training videos.
- Access-control matrix for protected admin routes.

Value story:

- PATH can adapt to program operations.
- Staff surfaces can be tailored without losing shared workflow discipline.
- Administrators have tools to manage system behavior, communication, and oversight.

### Staff Guidance, Training, Tutorials, And AI Support

PATH includes support resources inside the product.

Capabilities:

- Help panel content by page/widget.
- Staff-facing guidance written as job aids, not technical notes.
- Training content/library from NWAC training modules.
- Tutorial/short-video platform.
- Embedded admin Ask the AI assistant for grounded workflow guidance and template-style copy help.
- Guidance retrieval from curated PATH knowledge cards where available.
- No-match guardrails that avoid inventing controls when guidance is not available.
- Debug metadata available only to System Administrator when configured.
- Denial-letter drafting uses local template path instead of sending applicant denial context to external AI.

Value story:

- Staff receive guidance at the point of work.
- PATH can support training, onboarding, and consistent process language.

Careful language:

- AI should be presented as staff guidance/support, not as an automated decision-maker.
- Do not claim full AI coverage across every workflow. The current guidance seed and verified eval subset are intentionally narrow.

## Suggested Website Architecture

### Homepage

Recommended sections:

1. Hero: one-line promise plus supporting sentence.
2. Six main pillars.
3. Follow the File journey.
4. Migration confidence section.
5. Official artifacts and audit section.
6. Reporting section.
7. Capabilities overview linking to deeper feature area.
8. Call to action.

### Capabilities Page Or Section

Group the detailed feature list under headings:

- Intake and File Onboarding
- Client File and Document Management
- Workflow and Approvals
- Official Artifacts and Signatures
- Funding Visibility and Controlled Payment Follow-Up
- Reporting and Oversight
- Configuration and Administration
- Security, Compliance, and Staff Support

### Follow The File Journey

A strong visual section would show:

1. Applicant registers and starts intake.
2. Applicant completes dynamic form and uploads required documents.
3. PATH creates/links the client, case, application, and source submission.
4. Application appears in role-based queues.
5. Coordinator/assessor reviews the file, checks EI status, and requests missing documents if needed.
6. Assessment is submitted to Regional Manager review.
7. Regional Manager signs off or returns it with notes.
8. Decision Maker approves, denies, or requests changes.
9. PATH generates official records, letters, and signed/funding artifacts.
10. Case moves into action plans, interventions, funding agreements, and approved-funding reporting. Payment follow-up is included only for an explicitly qualified partial/controlled-rollout story.
11. Documents, messages, notes, decisions, and artifacts remain on the client file.
12. Reporting dashboards and exports draw from the same operational record.

### Migration Journey

Show a second path for existing files:

1. Staff batch-import a spreadsheet or manually enter a file.
2. PATH creates real clients and application-less cases where appropriate.
3. Staff upload existing documents.
4. Staff backload historical action plans and interventions.
5. Historical funding activity is recorded as history.
6. Participant accounts can be activated later.
7. Ongoing work continues from the same client/case workspace.

## Feature-To-Message Mapping

Use this table to choose copy emphasis.

| Feature area | Plain-language benefit | Good marketing phrase |
| --- | --- | --- |
| Public intake | Applicants submit structured information and documents | Guided intake from the start |
| One client file | Staff see the whole record in context | Everything in one client file |
| Data reuse | Less retyping across forms/reports | Enter once, use everywhere |
| Versioned PDFs/artifacts | Official records generated from workflow data | Official records without manual assembly |
| Batch import/manual entry/backload | Existing history can move into PATH | Move into PATH without losing your history |
| RM/Decision Maker workflow | Review stages are visible and auditable | Approval routing with evidence |
| Supporting documents/checklists | Missing evidence is visible | Know what is received and what is missing |
| Secure messaging/signing | Sensitive communication stays in the system | Secure participant follow-up |
| Payment packets | Partial/controlled rollout; exclude from present-tense live copy until enabled | Funding follow-up with evidence (availability qualification required) |
| Reporting/drilldowns | Reports trace back to source work | Reporting that comes from the work |
| Notifications/templates | Staff and applicants get workflow-aware communication | Configurable communication |
| Security/RBAC/audit | Sensitive records are protected and traceable | Built for sensitive program work |
| Staff guidance/AI | Staff get help in context | Guidance at the point of work |

## Possible Hero And Tagline Options

Use these as starting points only.

### Option A

```text
One auditable workflow for ISET delivery.

PATH brings intake, casework, documents, approvals, approved-funding visibility, and reporting into one connected system.
```

### Option B

```text
From application to evidence to report.

PATH helps ISET teams manage every client file, decision, document, funding step, and reporting output from one operational record.
```

### Option C

```text
The client file, the workflow, and the report - connected.

PATH reduces retyping, organizes evidence, generates official records, and keeps ISET work moving from intake through service delivery.
```

### Option D

```text
Move ISET work out of scattered files and into one auditable path.

PATH connects applications, documents, approvals, signatures, service delivery, and reports around the participant record.
```

## Claims To Avoid Or Treat Carefully

Avoid:

- "PATH replaces Sage."
- "PATH is the accounting system of record."
- "AI decides eligibility."
- "Fully automated approvals."
- "No staff review required."
- "All reports are exact historical decision-event records" unless the timestamp model is verified for the specific report.
- "Every workflow is configurable by any staff member."
- "PDF generator" as the main value claim.
- "Paperless" if the system still supports historical uploads and manual entry.
- "Real-time finance ledger" for PATH-side payment follow-up.

Use instead:

- "PATH reports on approved program funding while Finance/Sage remains the accounting system of record." Mention packet/evidence/follow-up functions only with the controlled-rollout qualification.
- "PATH supports staff review with role-based queues, evidence, and audit history."
- "PATH generates official, versioned artifacts from workflow data."
- "PATH helps reduce retyping and manual spreadsheet reconstruction."
- "PATH supports migration from spreadsheets, paper files, and historical caseloads."

## Recommended Feature Depth For Final Website

Homepage:

- 6 pillars.
- 1 journey.
- 1 migration section.
- 1 artifacts/audit section.
- 1 reporting section.

Capabilities section/page:

- 7-8 grouped capability areas.
- 5-8 bullets per group.
- Optional expanded accordion for detailed features.

Do not put 14-20 standalone feature cards at the top of the homepage. It will make PATH feel complicated before the visitor understands the promise.

## Internal Source References

The source brief was prepared from current project memory and subsystem docs, including:

- `docs/AGENTS.md`
- `docs/guides/case-workspace-guidance.md`
- `docs/dashboards/application-assessment-dashboard.md`
- `docs/widgets/admin/supporting-documents-widget.md`
- `docs/features/document-signing.md`
- `docs/features/payments-module.md`
- `docs/dashboards/data-and-results-dashboard.md`
- `docs/dashboards/financial-reports-dashboard.md`
- `docs/dashboards/client-file-import-dashboard.md`
- `docs/guides/workflow-studio.md`
- `docs/dashboards/admin-home-my-work-widget.md`
- `docs/dashboards/admin-home-approvals-items-widget.md`
- `docs/planning/rm-two-step-review-workflow.md`
- `docs/guides/status-lifecycle-implementation.md`
- `docs/features/public-portal-security-features.md`
- `docs/features/admin-ai-guidance.md`
- `docs/features/auto-assignment.md`
- `docs/dashboards/template-editor-dashboard.md`
- `docs/dashboards/manage-notifications-dashboard.md`
- `docs/features/user-management.md`
- `../ISET-intake/docs/portal/intake/core-workflow.md`
- `../ISET-intake/docs/portal/intake/submission-flow.md`
- `../ISET-intake/docs/portal/messaging/secure-messaging.md`
- `../ISET-intake/docs/portal/accounts/registration.md`

Before publishing public copy, apply `docs/product/path-capability-source-pack.md`, then verify the exact release/environment status of any unresolved claim—especially around portal changes after the last deployed portal commit, payments/Finance/Sage, AI coverage, notification/email behavior, correction/reversal paths, accessibility/bilingual coverage, and reporting timestamp semantics.
