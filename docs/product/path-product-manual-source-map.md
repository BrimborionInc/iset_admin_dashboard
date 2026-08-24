# PATH Product Manual Source Map

Status: current chapter map for producing a role- and task-based PATH product manual.
Audience: ChatGPT Pro content projects, Bill, manual reviewers, and Codex support threads.
Last Updated: 2026-08-21

## Purpose

Use this map to plan the manual and select the smallest set of current source documents for each chapter. It is not a finished manual and does not make older dashboard/widget docs authoritative. `path-capability-source-pack.md` controls status and availability.

## Recommended Manual Shape

Create one common orientation section, then separate applicant, staff casework, review/decision, reporting, and administration paths. Do not write one long click-by-click tour that mixes roles.

| Part | Chapters | Primary audience |
| --- | --- | --- |
| 1. Orientation | Product boundaries, environments, roles, records, navigation, privacy, getting help | Everyone |
| 2. Applicant Portal | Account access, dashboard, intake, uploads, submission, messages, documents/signing | Applicants and support staff |
| 3. Application Operations | Work queues, staff-assisted intake, assignment, Application Workspace, evidence follow-up | ISET Coordinators and Regional Managers |
| 4. Review And Decision | Assessment, Regional Manager review, Decision Maker action, returned changes, recall | Submitters, Regional Managers, Decision Makers |
| 5. Case And Service Delivery | Case Workspace, participant details, notes/reminders, Action Plans, interventions, closeout | Casework staff and managers |
| 6. Documents And Communication | Supporting documents, secure messages, signing requests, official/versioned records | Staff and applicants, in separate subsections |
| 7. Reporting And External Handoffs | Data and Results, Regional Snapshot, Financial Reports, ILMP/ESDC export | Managers, reporting staff, administrators |
| 8. Configuration And Support | Workflow Studio, notifications/templates, user/accounts, dashboards, feedback/tutorials, limited AI guidance | Authorized administrators and support |

Keep the partial Payments operating model out of the live staff procedure set until the real PROD rollout is approved and verified. A future Payments part should be generated from a separately revalidated version of `docs/guides/payments-module-user-manual.md`.

## Chapter Source Matrix

| Chapter area | Strongest current sources | Readiness | Required Codex verification before final |
| --- | --- | --- | --- |
| Product roles and record model | `docs/product/path-capability-source-pack.md`; `docs/planning/client-case-application-target-model.md` | Good conceptual source | Confirm any role-specific access table against target runtime matrix. |
| Portal registration/sign-in/recovery | `../ISET-intake/docs/portal/accounts/` | Manual/UAT source exists | Current labels, bilingual text, errors, and synthetic screenshots. |
| Applicant dashboard/start/resume | `../ISET-intake/docs/portal/applications/dashboard-start-resume.md` | Recently reconciled | Current PROD labels/states; August repeat-application states must not leak into live steps. |
| Dynamic intake | `../ISET-intake/docs/portal/intake/core-workflow.md`; `../ISET-intake/docs/portal/intake/intake-form.md` | Strong behavior source | Current published workflow, autosave flag, exact buttons, validation examples, screenshots. |
| Applicant uploads | `../ISET-intake/docs/portal/intake/document-uploads.md` | Strong behavior/UAT source | Current configuration limits/types and phone chooser on supported devices. |
| Submission confirmation/detail | Portal source pages; `../ISET-intake/docs/portal/intake/submission-flow.md` | Feature source exists; standalone manual page missing | Exact confirmation/detail labels and privacy-safe screenshot state. |
| Portal secure messaging | `../ISET-intake/docs/portal/messaging/secure-messaging.md` | Reconciled technical flow; manual detail incomplete | Compose eligibility, current PROD reply/application lineage, attachments, statuses, empty/error states. |
| My Documents and signing | `../ISET-intake/docs/portal/messaging/signing-requests.md`; `docs/features/document-signing.md` | Strong for current signing contracts | Verify per form; do not generalize attendance/CFA behavior to every task. |
| Home and work queues | `docs/dashboards/admin-home-my-work-widget.md`; `docs/dashboards/admin-home-approvals-items-widget.md`; help panels | Good capability source | Exact role cards, links, non-selectable counters, and current labels. |
| Staff-assisted Manual Intake | Current source plus `docs/testing/browser-workflow-smoke-automation.md` | Browser coverage exists; no complete manual | Account decision path, selected-client matching, skipped portal-only steps, successful result. |
| Manage ISET Applications/assignment | Application queue/help docs plus case-assignment browser smoke | Good screen evidence source | Role scope, filters, reassignment targets, status/bucket behavior. |
| Application Workspace | `docs/dashboards/application-assessment-dashboard.md`; application workspace browser smoke | Good composition/workflow source | Default vs saved layouts, exact actions per role, current error/lock states. |
| Application Assessment | Dashboard/widget docs; workflow browser smoke | Good source with complex edge paths | Prerequisites, EI controls, submitter ownership, exact request/return/recall actions. |
| Two-step review | `docs/guides/rm-two-step-review-user-guide.md` | Strong live guide | Target-release labels and restricted high-value authority wording. |
| Recall and broader corrections | r2 release evidence; `docs/planning/workflow-policy-uncertainty-register.md` | Recall narrow path live; broad matrix partial | Write recall as its own procedure; request separate proof for every other correction/reversal path. |
| Case Workspace | `docs/guides/case-workspace-guidance.md`; widget docs | Good capability source | Role/layout-specific procedures and action visibility. |
| Historical import/backload | `docs/guides/client-file-imports.md`; Case Workspace guidance | Current source; sensitive internal examples exist | Extract only generic rules; verify account behavior, warnings, roles, and reporting effects. |
| Action Plans/interventions | Case Workspace docs; two-step guide; intervention browser smoke | Good source, complex lifecycle | Draft/delivery/review status distinctions; proposal vs historical entry; closeout requirements. |
| Supporting Documents | `docs/widgets/admin/supporting-documents-widget.md` | r2 title/type edit deployed; reversible Delete/Restore remains local and unreleased | Publish current PROD title/type behavior only until the lifecycle schema and app release are deployed; then add the all-role reversible Delete and System Administrator Deleted/Restore steps. PATH has no permanent-delete action. |
| Staff secure messaging | Admin messaging docs/help; portal messaging for participant side | Core live; latest direction-status fix not deployed | Current PROD status labels, reply targets, compose state, withdrawal, and attachments. |
| Data and Results | `docs/dashboards/data-and-results-dashboard.md` | Good dashboard source | Exact filters, drilldowns, exports, and decision-date proxy explanation. |
| Regional Snapshot | `docs/data/regional-snapshot-reporting.md` | Deployed; application-less history limitation | Current UI/export steps and visible data-quality issues. |
| Financial Reports | `docs/dashboards/financial-reports-dashboard.md` | Strong current source | Current filters/export labels; carry-over and PATH-vs-Sage wording. |
| ILMP/ESDC | `docs/workflows/admin/ilmp-reporting.md`; ESDC widget docs | Core flow live; guidance partial | Blocker remediation, roles, current route labels, XML download and manual external upload. |
| Workflow Studio | `docs/guides/workflow-studio.md`; deterministic browser smokes | Privileged source-visible capability | PROD publishing parity, governance, roles, preview vs publish consequences. |
| Notifications/templates | Notification and Template Editor dashboard docs | Core infrastructure; event delivery conditional | Exact event/role rows, enabled channels/templates, recipient scope, no-send preview behavior. |
| Staff/participant accounts | `docs/features/user-management.md` | Good current source | Runtime role matrix, invitation sender behavior, activation states, region scope. |
| Feedback/tutorials/help | Admin feedback docs, tutorial platform docs, help panels | Mixed but usable | Which content is published, current routes, screenshots, and staff-safe examples. |
| Admin AI guidance | AI feature/coverage/eval docs | Intentionally partial | Do not write general “ask anything” instructions; verify each supported question/task. |
| Payments | Payments feature/automation/target docs | Partial; real Finance send not PROD-enabled | Exclude from live procedure set until separate rollout and end-to-end verification. |

## Per-Chapter Writing Template

Use this structure consistently:

1. **Purpose** — the result the user is trying to achieve.
2. **Who can do this** — exact business role, not just a technical group.
3. **Before you start** — record state, evidence, assignment, and prerequisites.
4. **Starting point** — exact surface and verified navigation label.
5. **Steps** — one user action per numbered step.
6. **Expected result** — visible state and next owner/queue.
7. **What PATH records or sends** — durable record, notification, generated artifact, or external boundary.
8. **Exceptions and restrictions** — read-only state, role limit, dependency, or evidence guard.
9. **Troubleshooting** — exact safe recovery; never recommend bypassing a guard.
10. **Screenshot(s)** — approved synthetic-data image, caption, alt text, and source manifest.
11. **Verification note** — target release/role and evidence date.

## Manual-Wide Rules

- Separate applicant instructions from staff instructions even when both touch one workflow.
- Separate application status, review stage, case lifecycle, document-request state, and participant task state.
- Explain what happens after each submission: who owns it, whether it becomes read-only, what notification/artifact is produced, and what must happen next.
- Use `Decision Maker`, not `NWAC`, for the final decision actor.
- Do not publish named internal approval authorities.
- Do not include database/API/route details in the end-user manual unless a technical appendix explicitly needs them.
- Do not describe DEV-only correction, portal repeat-application, payment send, or AI coverage as live.
- Treat exact permissions as target-release facts, not timeless role assumptions.
- Use screenshots only from `docs/product/assets/screenshots/` after approval.

## First Verification Request Batch

Before full drafting, have ChatGPT emit separate `CODEX_REQUEST` blocks for:

1. the current PROD role/navigation map;
2. portal account/dashboard/intake labels and screenshot shot list;
3. Application Workspace and Case Workspace default role views;
4. two-step review/recall exact buttons and queues;
5. supporting-document edit/preview rules after r2;
6. staff/applicant secure-message labels and status semantics;
7. reporting dashboard filters/export labels;
8. Workflow Studio publish boundary;
9. a list of chapters that must remain marked partial or unavailable.
