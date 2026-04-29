# Planning, Change-Request, And Archive Triage - 2026-04-29

Status: first-pass triage index, not implementation truth.
Last reviewed: 2026-04-29 during documentation cleanup.
Scope: `docs/planning/**`, `docs/change-requests/**`, and `../ISET-intake/docs/archive/**`.

Purpose: classify the mixed historical planning/change-request/archive layer so future Codex threads can find useful intent without treating old notes as current behavior.

## How To Use

- Treat current code, migrations, package scripts, tests, and live environment checks as higher authority than this index.
- Use this file to decide whether an old doc is worth opening.
- If a file here is marked historical or source artifact, do not copy its claims into new work without verification.
- If a future thread proves a classification wrong, update this index and the relevant directory README.

## Classification Key

- `current source`: active planning or target-model document that future work may legitimately use after code/schema verification.
- `current reference`: implemented or mostly implemented reference that remains useful, but still requires source verification.
- `historical source`: old requirement, CR, handoff, implementation log, or provenance note; useful for intent only.
- `superseded`: a newer canonical doc should be used instead.
- `archive/source artifact`: retained original material, usually not edited except for safety redactions or index links.
- `delete/archive candidate`: possible later pruning target; do not delete until another pass confirms no unique useful context remains.

## Planning Docs

| Path | Classification | Notes / safer entry point |
| --- | --- | --- |
| `docs/planning/README.md` | current gate | Directory instructions for mixed planning material. |
| `docs/planning/admin-console-take-a-tour.md` | current reference | Tutorial-platform requirements; verify against `docs/features/tutorial-platform.md` and source. |
| `docs/planning/admin-manual-new-application-design.md` | current source | Manual/new-application design work; verify current backend semantics before implementation. |
| `docs/planning/application-workspace-quick-actions.md` | current reference | In-progress/implemented quick-action notes; verify workspace code. |
| `docs/planning/assessment-application-pdf-tracker.md` | historical source | PDF tracker; verify against current document/PDF code before use. |
| `docs/planning/case-closure-plan.md` | historical source | Draft closure plan; not proof of implemented closure behavior. |
| `docs/planning/case-context-canonicalization-plan.md` | historical source | Use only as migration intent; verify current client/case/application target docs. |
| `docs/planning/case-workspace-quick-actions.md` | current reference | Marked complete; verify role/status gates in source. |
| `docs/planning/cfa-versioning-spec.md` | current source | CFA versioning reference if that feature is touched; verify current code. |
| `docs/planning/client-case-application-cutover-dependency-inventory.md` | current source | Active dependency inventory for entity-model cutover. |
| `docs/planning/client-case-application-migration-plan.md` | current source | Active migration plan for client/case/application model. |
| `docs/planning/client-case-application-target-model.md` | current source | Canonical target model for client/case/application. |
| `docs/planning/coordinator-assessment-costing-line-items-tracker.md` | historical source | Costing-line tracker; verify current coordinator assessment code. |
| `docs/planning/db-legacy-table-cleanup.md` | current reference | Legacy cleanup record; verify current migrations and live DB before any drop. |
| `docs/planning/denial-letter-ai-refactor.md` | current reference | Implemented/pending-review note; verify letter generation and AI prompt code. |
| `docs/planning/dev-tasks-migration.md` | historical source | Development-tracker persistence idea; tracker itself is legacy until separately curated. |
| `docs/planning/document-checklist-config-widget.md` | historical source | Verify against current document checklist/runtime config before use. |
| `docs/planning/document-model-erm-adjustment.md` | superseded | Replaced with a redirect stub; prefer `docs/data/documents-model.md` and privacy ERM docs. |
| `docs/planning/document-request-decoupling-tracker.md` | historical source | Verify current document-request/reminder behavior before use. |
| `docs/planning/finance-enable-tracker.md` | current reference | Finance enablement decisions; says no current MUST items remain as of 2026-01-30. |
| `docs/planning/finance-workflow-map.md` | current reference | Finance workflow map; verify against payments and finance dashboard docs. |
| `docs/planning/homepage-metrics-widget.md` | current reference | Homepage metrics design/tracker; verify current homepage widgets. |
| `docs/planning/ilmp-export-hardening-plan.md` | current source | ILMP export hardening plan if export work resumes. |
| `docs/planning/intacct-mock-dashboard-design.md` | historical source | Mock/prototype design; not current production behavior. |
| `docs/planning/internal-messages-email-actions-control.md` | current source | Design for email-like message actions; verify current message routes/widgets. |
| `docs/planning/internal-notifications-proposal.md` | current reference | Internal notification overview aligned with recent schema work. |
| `docs/planning/intervention-assessment-approvals.md` | current source | Draft target workflow; verify before implementation. |
| `docs/planning/intervention-assessment-lite-widget-rebuild.md` | historical source | Rebuild tracker; verify current widget before use. |
| `docs/planning/intervention-funding-line-editing-refactor.md` | current source | Active design/refactor tracker for funding revisions. |
| `docs/planning/iset-coordinator-homepage.md` | historical source | Old homepage wiring plan; verify current homepage docs/source. |
| `docs/planning/maintenance-announcement-design.md` | current reference | Implemented maintenance-announcement design; ops docs own commands. |
| `docs/planning/nform-extraction-plan.md` | historical source | Marked historical; planned deliverables may not exist. |
| `docs/planning/nform-scope.md` | historical source | Marked historical draft; future nForm work must re-verify. |
| `docs/planning/notification-applicant-integration.md` | historical source | Verify current notification/email pipeline before use. |
| `docs/planning/path-document-type-canonical-review.md` | current source | Canonical document-type review. |
| `docs/planning/payment-packet-scheduling-design.md` | current source | Locked v1 payment scheduling decisions. |
| `docs/planning/privacy-erm-cleanup-grand-release-plan.md` | current source | Active privacy ERM cleanup baseline. |
| `docs/planning/privacy-erm-cleanup-progress.md` | current reference | Running privacy ERM progress log; search by date/keyword. |
| `docs/planning/privacy-erm-legacy-field-retirement-inventory.md` | current source | Active compatibility-shadow retirement inventory. |
| `docs/planning/privacy-security-systematic-review-2026-04-25.md` | current source | Post-incident privacy/security review work plan. |
| `docs/planning/proposed-interventions-wizard-alignment.md` | historical source | Verify current proposed-intervention wizard before use. |
| `docs/planning/public-intake-renderer-plan.md` | superseded | Replaced with a redirect stub after invalid encoding was found; prefer current portal docs/source. |
| `docs/planning/public-portal-legacy-fallback-security-review-2026-04-25.md` | current source | Current public-portal legacy-fallback security review. |
| `docs/planning/public-portal-prelaunch-review-2026-03-28.md` | historical source | Launch review/regression handoff; verify current portal docs/source. |
| `docs/planning/query-editor-dashboard.md` | superseded | Replaced with a redirect stub; prefer `docs/dashboards/query-editor-dashboard.md`. |
| `docs/planning/status-architecture-overhaul.md` | current source | Canonical target status model/rollout plan. |
| `docs/planning/step19-checkbox-conditionality-followup.md` | current reference | Implemented Step 19 conditionality note. |
| `docs/planning/thread-handoff-2026-03-02.md` | historical source | Old handoff; credential redacted. |
| `docs/planning/vendor-payee-early-capture-refactor.md` | current source | Active design/refactor tracker for early vendor/payee capture. |

## Change-Request Docs

Directory rule: treat CR docs as historical/source material unless a current planning/domain doc explicitly keeps them active.

| Path | Classification | Notes / safer entry point |
| --- | --- | --- |
| `docs/change-requests/README.md` | current gate | Directory instructions for old CR material. |
| `docs/change-requests/CR-0001-watchlist.md` | historical source | Prefer `docs/dashboards/applicant-watchlist-dashboard.md`. |
| `docs/change-requests/CR-0003-Addendum-Finance-Payments-and-Reporting.md` | historical source | Finance/payment intent; verify against current finance docs/source. |
| `docs/change-requests/CR-0003-Addendum-Plan.md` | historical source | Finance addendum planning notes. |
| `docs/change-requests/CR-0003-Financial Module.md` | archive/source artifact | Original finance module CR text; preserve as provenance. |
| `docs/change-requests/CR-0003-Financial-Management-User-Guide.md` | historical source | Prefer current payments/finance dashboard docs. |
| `docs/change-requests/CR-0003-Implementation-Log.md` | historical source | Finance implementation log; verify current behavior. |
| `docs/change-requests/CR-0005-Contact-Handling.md` | historical source | Contact/support workflow intent only. |
| `docs/change-requests/CR-0006-ESDC-Submission-Dashboard.md` | historical source | ESDC submission intent; verify current ESDC/reporting docs. |
| `docs/change-requests/CR-0007-ESDC-Intervention-Data.md` | historical source | ESDC intervention data intent. |
| `docs/change-requests/CR-0008-Cases-Dashboard-Live-Data.md` | historical source | Cases dashboard source material; prefer current client/case/application docs. |
| `docs/change-requests/CR-0009-Intervention-Reference-Data.md` | historical source | Reference data change record; verify current code tables. |
| `docs/change-requests/CR-0010-Recurring-Intervention-Costs.md` | historical source | Prefer current intervention/payment planning docs. |
| `docs/change-requests/CR-0011-Intervention-Recurrence-Persistence.md` | historical source | Prefer current recurrence/payment packet docs. |
| `docs/change-requests/CR-0012-Case-Status-Realignment.md` | historical source | Prefer `docs/planning/status-architecture-overhaul.md`. |
| `docs/change-requests/CR-0013-Reminders-And-Task-Orchestration.md` | historical source | Draft; verify reminder implementation before use. |
| `docs/change-requests/CR-0014-Configurable-Notification-Email-Pipeline.md` | historical source | Notification/email pipeline source material; verify current notification docs/code. |
| `docs/change-requests/CR-0015-Intake-Input-JSON-Persistence.md` | historical source | Input JSON persistence source material; verify portal intake state and current docs. |
| `docs/change-requests/CR-0016-Multi-Region-Manager-Scoping.md` | current source | Marked in progress; verify region-scoping code and current user-management docs. |
| `docs/change-requests/CR-0017-Denied-Ineligible-ILMP-Seeding.md` | current reference | Marked implementation complete / verification pending. |
| `docs/change-requests/CR0001- Finance Module.docx` | archive/source artifact | Original DOCX; do not edit except to move/archive after retention decision. |
| `docs/change-requests/CR0002- Finance Reporting.docx` | archive/source artifact | Original DOCX; do not edit except to move/archive after retention decision. |
| `docs/change-requests/CR0003- Case Management.docx` | archive/source artifact | Original DOCX; do not edit except to move/archive after retention decision. |
| `docs/change-requests/CR0004 - Notifications Templates.docx` | archive/source artifact | Original DOCX; do not edit except to move/archive after retention decision. |

## Portal Archive Docs

Directory rule: everything under `../ISET-intake/docs/archive/**` is historical unless explicitly promoted into `portal/` or `system/`.

| Path | Classification | Notes / safer entry point |
| --- | --- | --- |
| `../ISET-intake/docs/archive/README.md` | current gate | Archive instructions. |
| `../ISET-intake/docs/archive/auth/README.md` | current gate | Auth archive instructions. |
| `../ISET-intake/docs/archive/auth/cognito-clarifications-2025-11.md` | historical source | Old clarification Q&A; verify against current Cognito code/docs. |
| `../ISET-intake/docs/archive/legacy/README.md` | current gate | Legacy archive instructions. |
| `../ISET-intake/docs/archive/legacy/static-intake-legacy.md` | historical source | Static intake snapshot before dynamic runtime. |
| `../ISET-intake/docs/archive/plans/README.md` | current gate | Plan archive instructions. |
| `../ISET-intake/docs/archive/plans/cognito-implementation-plan-2025-11.md` | historical source | Old Cognito plan; verify against current auth implementation. |
| `../ISET-intake/docs/archive/plans/runtime-config-expansion-plan.md` | historical source | Runtime-config proposal; verify current runtime config docs. |
| `../ISET-intake/docs/archive/plans/save-finish-later-plan-2025-09.md` | historical source | Old draft plan; current autosave/draft behavior must be checked in source/docs. |

## Delete / Archive Candidate Queue

These files were either pruned in this pass or remain candidates for a later evidence-backed prune:

| Path | Candidate action | Reason |
| --- | --- | --- |
| `docs/planning/query-editor-dashboard.md` | done: replaced with redirect stub | Superseded by `docs/dashboards/query-editor-dashboard.md`. |
| `docs/planning/document-model-erm-adjustment.md` | done: replaced with redirect stub | Safer current entry points are `docs/data/documents-model.md` and privacy ERM docs. |
| `docs/planning/public-intake-renderer-plan.md` | done: replaced with redirect stub | Current portal runtime docs/source should be authoritative; old file had invalid text encoding. |
| `docs/change-requests/CR-0003-*` finance cluster | merge/archive | Multiple overlapping finance CR/user-guide/log docs; current finance docs should own behavior. |
| `docs/change-requests/*.docx` | move to source-artifact/archive area | Original binary source artifacts are not agent guidance. |
