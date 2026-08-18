# Regional Manager Two-Step Review Workflow

Purpose: plan the new Regional Manager review stage for assessment and intervention approval workflows.
Audience: product, engineering, operations, training, and future AI-assisted development threads.
Last Updated: 2026-08-13

## Status

Design accepted for a low-risk first pass. The implementation covers application assessments, new intervention proposals, and intervention amendments/revisions behind the runtime toggle. Schema, shared transition helper, backend submission/final-decision integration, Regional Manager action endpoints, workspace payloads, stage-aware homepage queues, exact-workflow PDF signatures, `CoordinatorAssessmentWidget`, and the Case Workspace intervention proposal widget are wired. Application-assessment browser coverage and the deployed r19 TEST correction journey are retained. The 2026-08-09 assurance candidate adds a 12-scenario compiled-browser identity matrix for both intervention workflow types, atomic final decisions, exact application lineage, and expanded strict-denial coverage. Its focused and aggregate local tests are green, but exact-source DEV qualification and a separately approved deployed TEST rehearsal remain mandatory before any PROD rollout decision.

2026-08-10 post-decision communication repair: PROD feedback `#182` exposed that the assurance rollout classified application decision-letter drafting and sent markers as Decision Maker outcome mutations. An assigned ISET Coordinator could see the legitimate post-decision letter step, but the first draft-save request was rejected with `application_decision_forbidden`, so no secure-message send began. The local repair separates immutable decision state (`assessment_nwac_review_status`) from post-decision communication state (letter drafts, letter packs, sent markers, and denial-letter reason text). The existing case-access boundary remains authoritative for who may work on the file, and the backend now additionally requires `final_decision_recorded` or a legacy recorded decision outcome before accepting communication changes. Active assessment/review stages remain locked. Regression coverage exercises every legacy/current communication key, legacy root-to-application scoping, the final-stage gate, related signing/message invariants, and the Coordinator UI error surface. A caller-boundary test through the actual case route proves that the assigned Coordinator succeeds, a different Coordinator and a pre-final workflow fail closed, and the save does not mutate the assessment or ESDC participant readiness. The complete local gate passes all 850 tests, changed-file lint with zero errors, syntax/diff checks, and the production build. The repair is ready for the emergency admin-console hotfix path but remains local until a separately authorized deployment completes.

2026-06-26 update: after PROD feedback `#147` and `#148`, the transition helper now permits a Regional Manager who is acting as the submitter to start the two-step workflow for supported application assessment, intervention proposal, and intervention revision/amendment submissions. This matches the RM-owned draft/edit paths that can exist before a workflow row exists. Under the agreed first-pass rule, the same Regional Manager may submit and then perform the RM review/sign-off so the workflow produces the standard audit trail. NWAC Administrator users do not start workflows; they are Decision Maker final-decision actors only. System Administrator behavior is technical/superuser support only and must not define the business workflow, UX, queue design, or release acceptance criteria. Regional Managers still cannot record the final Decision Maker approval/denial/request-changes decision.

The migration/runtime default is off, but DEV, TEST, and PROD now have the flag enabled for `application_assessment`, `intervention_proposal`, and `intervention_revision`.

2026-08-09 assurance update: returned intervention work is editable only by the workflow's recorded submitter staff profile, with System Administrator support as the explicit technical exception. This includes the dual-role case: a Regional Manager who originally submitted the item edits and resubmits in submitter capacity, then completes a separate RM review/sign-off only after the workflow has returned to `rm_review`. The local compiled-browser matrix passed 12/12 proposal/revision scenarios for the original Coordinator, a different Coordinator, a different Regional Manager, the Decision Maker, System Administrator support, and the same-person Regional Manager path. The candidate also proves exactly one returned-work autosave and that intervention-code/NOC reference requests settle instead of looping.

The same assurance pass hardened the server boundary. Proposal and revision final decisions now commit packet changes, workflow stamps, notes, revision application, and all frozen multi-item proposal materialization in one transaction. Retries use an exact source-proposal/item key. An applied revision draft is retained as final audit evidence, but it is not an operational intervention: it must not inflate Action Plan/case counts, enter operational queues or funding calculations, or accept edit/revise/close/delete actions. Reviewed intervention lineage is fail-closed to the exact agreeing proposal/Action Plan application; case-primary fallback is not valid evidence. Zero-funded approvals remain eligible for an approval letter but do not create, supersede, attach, or instruct staff to use a CFA/EFT package.

2026-08-08 PROD correction release update: release `20260807-assessment-correction-hotfix-r19` completed exact-source DEV qualification (16/16), aligned deployed TEST qualification (12/12), and the final live TEST two-step role journey (126/126 assertions, zero residue) before PROD. Admin commit `830875e475b1d278e726b8b7499e32acb0ad633b` and shared commit `0d06680b77e4e42ed71464775982f2012c11385e` are live. The first admin refresh exposed a legacy bootstrap dependency on the separate shared compatibility artifact; fallback protected the broken process, the exact qualified bundled shared tree recovered the replacement, and a separately approved shared-only refresh made the dependency durable. The first all-surface routing handoff observed one transient admin `503` before ALB health admission, so fallback was restored and the admin and portal target groups were admitted and smoked one surface at a time. Both PROD target groups are now healthy, all three public readiness endpoints return `200`, and no schema/data/runtime-config/portal application artifact changed. Feedback `#178` and `#179` remain `in_progress`: the prevention code is live, while their exact existing PROD workflows still have the concrete correction/redecision or authenticated recheck work recorded in the feedback notes.

2026-08-07 correction-journey validation update: the deployed TEST acceptance journey now proves the complete same-person Regional Manager correction path rather than only editability or an intermediate transition. It requests and concurrently signs a Financial Overview on a non-primary repeat application, returns the authoritative workflow to the recorded submitter, edits and saves without Decision Maker fields, resubmits with the UI's exact dispatch-time optimistic token, serializes duplicate resubmits to one commit plus one stale conflict while signing completes, returns through RM review to the Decision Maker queue, and proves exact document/event/object cardinality with zero residue. Passing evidence is `tmp/two-step-review-test-smoke/two-step-1786128748799-61d4d58ce0-journey.json` (96/96 checks). This targeted journey does not replace exact-source DEV qualification, aligned TEST deployment, or the full machine TEST qualification gate.

2026-08-06 correction-recovery update: feedback `#178` proved that restoring a finally decided application assessment to ordinary `rm_review` is unsafe. The deployed workspace legitimately offered both `Return to Coordinator` and `Submit for final decision`; the Regional Manager selected the latter, and the unchanged assessment was approved again. Exceptional post-decision recovery must therefore be fail-closed. The safe immediate state is `returned_to_submitter`. If an operational repair must temporarily use `rm_review`, its workflow metadata must set `requiresSubmitterCorrectionReturn=true`; the application-assessment UI must show a correction warning and hide escalation, while the backend independently rejects `rm_submit_to_nwac` with `409 review_workflow_return_required`. The marker does not change ordinary two-step review or the intervention workflows. Local caller-boundary tests and the compiled browser workflow prove this guard; it remains a release candidate until the normal TEST and PROD gates complete.

2026-08-06 returned-form invariant: application-assessment review ownership and document-request/signing state are independent state machines. An active review stage is authoritative for queue ownership and assessment edit controls; requesting or signing a Financial Overview must not replace `rm_review`, `nwac_review`, or `returned_to_rm` with an applicant-waiting lifecycle. A signing-form message requires an explicit application id, and its message, signing request, link, and application activation are one database transaction. Signing completion reconciles only the exact message-linked application, excludes decision letters from document-request counts, and clears the application plus its exact reminder only after all participant-input forms are durably complete. At `returned_to_submitter`, only the workflow's recorded submitter may edit/resubmit (System Administrator technical support and the established EI-eligibility-only correction remain narrow exceptions).

2026-08-07 qualification findings: r6 deployed TEST acceptance proved the ordinary Coordinator return/edit/resubmit path reaches the Regional Manager again. Its later final-decision 409 came from an over-broad synthetic smoke payload that included `assessment_intervention_cost_total`; the real Decision Maker UI sends only decision fields, budget-pot/posting selection, statuses, and the row-version token. r8 then proved the deployed notification worker was live and the review events reached `delivered`, but bell metadata did not retain the exact application/intervention identifiers, so repeat-application-safe notification assertions correctly failed. Candidate r9 preserved exact notification scope and reached the real returned-to-RM prerequisite, where TEST exposed a product contradiction: the RM must record a per-file conflict declaration before using `Forward changes`, but the correction-stage edit lock classified that separate declaration as assessment content and returned `assessment_submission_locked`. Candidate r10 separates declaration mutation from assessment-body mutation, allows the exact declaration-only request, and keeps mixed declaration-plus-assessment edits locked. Candidate r12 later proved the signed Financial Overview browser/replay path but remained `NO-GO`: its signed document omitted the exact originating message, the explicit dual-role submitter was dropped because the event's only configured workflow-role setting did not match their actual Regional Manager role, and a page-global `Next` selector could leave the assessment wizard. Candidate r13 preserves exact signed-document lineage, delivers the owner-scoped notification to that explicit staff profile without role broadcast, and scopes deployed browser navigation to the assessment wizard. The complete deployed dual-role Financial Overview overlap journey remains mandatory before PROD.

Deployment note: release `20260620-rm-two-step-review-rollout` deployed the feature to TEST and PROD on 2026-06-20 with the one-off notification configuration operation applied in both environments. Do not assume future app/schema deployment alone is enough if these rows drift; explicitly verify and normalize the notification rows listed under **TEST/PROD Notification Configuration** below.

Activation state: PROD has been deployed and runtime-enabled for all three workflow types since 2026-06-20. The earlier Monday, July 13, 2026 target is no longer a PROD activation gate; treat it only as a historical stakeholder UAT/training readiness milestone if that date is still referenced elsewhere.

## Business Trigger

Regional Managers no longer have final approval rights for the affected approval workflows. The expected workflow is now:

1. ISET Coordinator submits the assessment/proposal, or a Regional Manager submits their own draft item.
2. Regional Manager reviews the submitted packet.
3. Regional Manager either returns it to the submitter with notes or submits it to the Decision Maker for final approval.
4. The Decision Maker approves, denies/rejects, or requests changes.
5. If the Decision Maker requests changes, the item returns to the Regional Manager first so the RM can see what was missed before returning it to the submitter.
6. Final PDFs show both RM review/sign-off and final Decision Maker decision/sign-off.

## Scope

First-pass scope applies to all three approval request types:

- application assessments;
- new intervention proposals;
- intervention amendments/revisions.

First pass deliberately excludes a vacation/coverage engine. Coverage can be handled operationally through existing region access or admin assistance during the initial rollout. A dedicated delegation/alternate-review-owner feature is a phase 2 candidate after staff have used the core workflow.

## Current System Evidence

- Application assessments are application-scoped in `iset_application_assessment`, but that table currently has legacy final-decision fields rather than durable RM review/sign-off fields.
- Application final decisions are currently restricted in frontend/backend to Decision Maker users (`NWAC Administrator`), with any System Administrator path treated as technical support/superuser behavior rather than the business role model.
- Intervention proposal/revision final decisions follow the same business rule: the decision role is `NWAC Administrator`; any System Administrator path is technical support/superuser behavior only.
- Regional Managers can view approval-oriented queues/workspaces and have regional scope through `staff_profiles.region_id` / `staff_region`.
- `staff_region` supports multi-region visibility, but direct case access is still based on case assignment/region, not on a review-stage owner.

Relevant current files:

- `isetadminserver.js`
- `src/utils/rbac.js`
- `src/widgets/CoordinatorAssessmentWidget.js`
- `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`
- `src/lib/caseAccess.js`
- `sql/migrations/20260508_0001_create_application_assessment.sql`
- `sql/migrations/20260416_0003_create_intervention_proposals_and_delivery_status.sql`
- `docs/dashboards/admin-home-approvals-items-widget.md`

## Design Rules

- Add an RM review stage; do not restore RM final approval authority.
- Do not overload existing `pending_approval`, `submitted`, or `assessment_nwac_review_status` values with hidden meanings.
- Keep the existing workspaces as the review surface; do not build a separate approval application for the first pass.
- Keep submitted packet bodies read-only during RM and Decision Maker review.
- RM can return the packet to the submitter with required notes.
- RM can submit the packet upward for final decision.
- An exceptionally reopened post-decision application assessment may not be submitted upward until it has first returned to its submitter and been corrected/resubmitted; staff instructions alone are not a control.
- RM-owned submissions still enter RM review; for the first pass, the same RM may complete the RM review/sign-off on their own submitted item so the audit trail is consistent.
- If that same Regional Manager was the recorded submitter, forwarding Decision Maker changes to the submitter returns the assessment to that RM in the submitter capacity; they may then edit, resubmit to RM review, complete RM sign-off, and send it back to the Decision Maker.
- Decision Maker request-changes returns to RM first, not directly to the submitter.
- RM forwards Decision Maker-requested changes to the submitter with notes.
- ISET Coordinator edits are allowed only after the workflow is returned to them.
- Workflow starts are limited to `ISET Coordinator` and `Regional Manager`. `NWAC Administrator` users do not start workflows; they act only at the final-decision stage. System Administrator behavior is outside the business workflow matrix and must not drive UX or release acceptance.
- Only Shelley Stacey (`sstacey@nwac.ca`) can approve funding of `$20,000` or above. This applies to application assessments, new intervention proposals, and intervention amendments/revisions. Other final-decision users can deny or request changes, but the approval path is blocked in the decision UI and enforced by the backend.
- Use professional, role-based workflow labels in staff-facing copy. Say `Decision Maker` for the final-decision role. Do not use `NWAC` as shorthand for an approval actor because coordinators and Regional Managers are also NWAC staff. Reserve `NWAC` for the organization, the program/funding source, or exact system role names. Do not name individual approvers except where the Shelley Stacey high-value funding threshold rule genuinely requires it.
- Submitter-facing copy should say `Submit for review`, `Resubmit for review`, `submitted to Regional Manager review`, or `submitted for review` while the two-step workflow is active. Regional Manager escalation should say `Submit for final decision`. Reserve `approval` wording for the final decision and post-approval letter/funding-document surfaces.
- Every stage transition must have audit evidence: actor, role, timestamp, note where applicable, and workflow subject.
- Review and decision notes must also be easy to find from the case file: when an RM or Decision Maker enters a transition note, PATH mirrors it into `Notes and Tasks` as an internal case note and carries the note plus the case-note reference in event payload data.
- Feature should ship behind a runtime config toggle so PROD can be deployed safely before activation.

## Authoritative Workflow Matrix

This matrix is the target business contract for all three two-step review workflows: `application_assessment`, `intervention_proposal`, and `intervention_revision`. The business roles for this workflow are ISET Coordinator, Regional Manager, and NWAC Administrator/Decision Maker. System Administrator access is technical support/superuser behavior only and must not drive UX, queue, or release-acceptance decisions. Treat current code, PROD data, queue output, generated documents, notifications, and feedback-report answers as defective when they contradict this matrix.

Legacy application/proposal statuses remain compatibility fields. They may support existing screens and reporting, but they are not the authority for two-step review queue ownership once an active `iset_review_workflow` exists. The authoritative review state is `iset_review_workflow.current_stage`.

| Conceptual state | Workflow row state | Who owns next action | Packet editable? | Allowed next actions | Queue placement | Required side effects |
| --- | --- | --- | --- | --- | --- | --- |
| Draft or in progress | no active workflow row yet, or prior workflow returned and restarted as draft | ISET Coordinator or Regional Manager submitter | Yes, by the submitter while they are allowed to work the draft | Submit for review; withdraw/cancel only where the underlying workflow supports it | Normal draft/in-assessment surfaces, not `Pending Review` or `Pending Decision` | No RM/Decision Maker sign-off evidence yet |
| Submitted to Regional Manager review | `rm_review` | Regional Manager | No packet-body edits; reviewer-only controls such as EI verification may remain available where explicitly allowed | Return to submitter with note, or submit for final decision | Regional Manager `Pending Review` | Review workflow event; RM-review notification; submitted packet artifacts for the workflow type; note only when an action requires one |
| Returned to submitter | `returned_to_submitter` | Original submitter role/staff path | Yes, by the submitter | Resubmit for Regional Manager review | Submitter work queue or workspace returned-work state | Return/forward notes visible to the submitter and preserved in Events Timeline/Notes and Tasks |
| Submitted for final decision | `nwac_review` | Decision Maker | No packet-body edits | Approve, deny/reject, or request changes | Decision Maker `Pending Decision` | RM sign-off is preserved; final-decision notification; Decision Maker note/audit evidence when a note is supplied or required |
| Returned to Regional Manager by Decision Maker | `returned_to_rm` | Regional Manager | No packet-body edits | Forward requested changes to submitter with note | Regional Manager `Pending Review` as returned-to-RM work | Decision Maker request-change note remains visible to RM; RM forwarding note is mirrored into Notes and Tasks and shown to submitter |
| Final decision recorded | `final_decision_recorded` | No review owner; follow-up owner depends on outcome | No assessment/proposal packet edits | Post-decision follow-up only, such as approval/denial/funding-revision letters | Completion/follow-up queues only when required artifacts remain | Final PDF/artifact shows submitter evidence, RM sign-off, and Decision Maker decision/sign-off |
| Recalled before decision | review row at `withdrawn` while the application remains `in_review` | Original recorded submitter | Yes, by that submitter | Correct and resubmit for Regional Manager review; System Administrator support may assist without replacing submitter ownership | Submitter's Application Workspace, not an active review queue | Recall and later resubmission remain separate audit events; new review submission clears stale reviewer decisions |
| Underlying application cancelled or withdrawn | terminal application state, distinct from a recalled review submission | No active review owner | No | Reopen only through a separately approved application-recovery path | No active review queue | Audit trail preserves cancellation/withdrawal reason and actor |

Role contract:

| Role | May start review? | May perform RM review? | May final decide? |
| --- | --- | --- | --- |
| ISET Coordinator | Yes, for their submitter-owned draft work | No | No |
| Regional Manager | Yes, when acting as submitter for their own draft work | Yes, including first-pass sign-off on their own submitted item | No |
| NWAC Administrator / Decision Maker | No | No | Yes, at `nwac_review` only |
| System Administrator | Not a business workflow role | No | Technical support/superuser only; outside the business role matrix |

Release and audit rule: every code path that changes an assessment, proposal, revision, queue row, notification, PDF, or feedback status for this feature must be checked against the business role/action/stage matrix above. Do not patch one workflow type in isolation unless the same state/role/action rule has been verified for the other two workflow types or a deliberate difference is documented here.

2026-07-05 release-management finding: the PROD bug cluster after two-step rollout was not only a set of isolated defects. The root release-control failure was that the acceptance gate was not expressed as the simple cross-product of three workflow types, three business statuses, and three business roles before PROD activation and hotfixes. That let partial route fixes land without proving the whole state machine remained coherent. A separate release-safety failure also allowed at least one PROD app artifact to be built from a dirty WSL source tree. Future two-step review fixes must first validate this matrix across application assessments, new intervention proposals, and intervention revisions, and PROD app deploys must use clean packaged source trees unless Bill explicitly approves a recorded dirty-source emergency exception. The broader release-management corrective gate is `docs/ops/deployments/major-workflow-release-management.md`.

2026-07-05 PROD systemic audit and data repair: a workflow-first PROD audit found no broad missing workflow rows, invalid workflow stages, or workflow/status mismatches across the three active two-step workflow types. The concrete record damage found was intervention packet document linkage and one proposal compatibility timestamp. Workflows `12` (`intervention_proposal:proposal:332`, intervention `219`, case `44`, `nwac_review`) and `13` (`intervention_proposal:proposal:339`, intervention `220`, case `50`, `final_decision_recorded`) had generated active packet PDFs whose metadata named the correct intervention but whose `iset_document_intervention` join rows were missing. Proposal `339` also had `iset_intervention_proposal.submitted_at` incorrectly overwritten to the Decision Maker approval time. Bill approved the guarded PROD repairs on 2026-07-05. `sql/ops/prod-two-step-review-document-link-repair-apply-20260705.sql` inserted five missing document links, and `sql/ops/prod-two-step-review-proposal-timestamp-repair-apply-20260705.sql` reset proposal `339` to the authoritative workflow submit timestamp. Post-repair audit returned no mismatch rows. Owner-notification tracking lives in `docs/ops/prod-repair-notification-log.md`.

Root code causes and prevention status: `generateAndStoreInterventionAssessmentPdf` passed intervention metadata into `storeAssessmentPdfDocument`, but the store helper did not create the normalized intervention-document link. `syncInterventionProposalCompatibility` also overwrote `submitted_at` from the intervention row's latest `updated_at` on decision sync. Prevention code now ships generated intervention assessment PDFs with `interventionIds` into `storeAssessmentPdfDocument`, and the compatibility upsert preserves existing submitted timestamps through final decisions. TEST release `20260705-two-step-review-prevention-test` deployed this prevention code on 2026-07-05 as admin-only, with no schema/data/portal/shared changes; normal-routing TEST admin smoke passed, deployed-source SSM command `1eb9b59e-6bc0-485f-b391-555d27cd8990` confirmed both prevention markers, and maintenance state was cleared. PROD release `20260705-two-step-review-prevention` then deployed the same prevention path as admin-only with no DB mutation; normal-routing PROD admin smoke returned `200`, deployed-source SSM command `a1129867-9c9e-42cd-89ef-4635fdf12824` confirmed both prevention markers, and post-deploy audit SSM command `7405d66e-0bf6-4076-808d-114b562715e7` returned no known mismatch rows.

2026-07-05 systematic TEST workflow smoke and PROD deployment: release `20260705-two-step-review-test-notification-fix` fixed two notification contract gaps found by the live TEST smoke. New intervention proposals created through `POST /api/action-plans/:id/interventions` now emit `rm_review_requested` when the workflow enters `rm_review`, and intervention Decision Maker request-changes events use the two-step `nwac_review_changes_requested` event while preserving the underlying submitted proposal status during `returned_to_rm`. The shared bell formatter now renders intervention wording for those two-step change-request events. Full live TEST smoke SSM command `8428df04-2235-46e6-9533-7187a7260ac3` passed across application assessment, new intervention proposal, and intervention revision paths: role hydration for ISET Coordinator/Regional Manager/NWAC Administrator, workflow stage transitions, edit locks, route text, final-decision guards, generated PDFs and intervention document links, notification routing, valid-stage checks, and browser console/API checks. Cleanup evidence from the smoke reported zero synthetic cases, applications, interventions, documents, notifications, staff profiles, and users; follow-up Cognito checks for the latest and previous failed smoke stamps returned no users. TEST target smoke was green on replacement host `i-052566d75e0214d00`, ALB fallback was normal, and SQL-over-SSM command `da868131-5108-46e0-8e79-20855faf821f` reported `service_announcement_rows = 0`. PROD deployed the same release on 2026-07-05 as full shared + admin + portal app artifacts with `--skip-schema --skip-data`; no runtime config, data, schema, intake runtime, Terraform, or cross-environment data promotion was included. ASG refresh `82a399ed-0a01-40a1-bc4d-c31d04674537` completed on replacement instance `i-0b035421748e15738`, final smoke returned `200` for all three public health endpoints, source-marker SSM command `a37dda23-0198-4f27-aba1-c48715d357ed` confirmed the admin/shared notification markers, and maintenance cleanup confirmed the active `runtime/service.announcement` row count was `0`.

2026-07-05 feedback reconciliation: live PROD feedback report `#149` (`Pending Decision - Kitson/Wallace`) was moved from `triaging` to `resolved` after the repaired records were rechecked and prevention was deployed. Kitson remains correctly at `nwac_review` for Decision Maker final review; Wallace is `final_decision_recorded` / approved with the corrected submit timestamp. SQL artifact: `sql/ops/prod-feedback-149-resolved-two-step-prevention-20260705.sql`, SSM command `84b08c90-55c2-499e-8691-a1692fb1e674`. After that update, the live PROD feedback queue had no open two-step review bug report; remaining open reports were secure-message incident/change work, appeals, and older document-policy items.

2026-07-06 PROD application-assessment status discovery audit: read-only SQL found 133 `iset_application_assessment` rows. Twelve have active `application_assessment` review workflows: 4 at `rm_review`, 3 at `nwac_review`, 2 at `returned_to_submitter`, and 3 at `final_decision_recorded`. The active workflow/status pairs were coherent: active review stages use legacy `iset_application.status='pending_approval'` / `lifecycle_status='pending_decision'`, returned-to-submitter rows use `in_review`, and final-decision rows have terminal application outcomes. Consistency checks found zero active workflows without assessment rows, zero duplicate active workflow subjects, and zero pending-decision application assessments without a workflow (`a429ef52-4071-4574-b7a9-40255f471319`). No broad application-status migration is indicated from this discovery pass. Application `11` had a stale scoped `case_context_json.applicationDecisionLetters["11"].assessment_nwac_review_status='approve'` even though the application outcome and assessment agreement resolve to denial (`135e871f-79b4-4094-9ad2-8cfc497552b7`, targeted check `e701fa5e-8cba-4cce-bbb5-6196ce511e52`); Bill approved a targeted data repair on 2026-07-06, and `sql/ops/prod-application-11-assessment-context-repair-apply-20260706.sql` changed only that scoped value to `reject`. Preview SSM command `d2ba4182-36c2-4bd5-80f4-0487049da940` found no blockers, apply command `44075235-a61f-49ed-95f4-a7d3b23a4882` updated one case context row, target verification command `e72e71a0-55ce-413e-9900-a55ea320d0c1` confirmed application `11` remains completed/closed/denied with assessment `no_recommend` / `agree`, and broader mismatch audit command `beba8099-304a-4838-b7f4-3f34da74ea6f` returned zero remaining decision/context mismatches. Active RM-review application `30` remains an owner-routing candidate: it has no RM-review notification row because the case has no portfolio region, the assigned Regional Manager has no region, and the workflow owner staff profile is null (`b2b8bdff-1aae-4774-a378-268548304810`). A separate document-classification oddity was observed on application `27`: active document `4904` is a secure-message attachment labelled `Student Loan Assessment Form` but categorized as `assessment_approval_letter`; Bill parked this for now, and it does not change the application/workflow status (`363ec78d-bd29-4f4b-92ad-f6e056ca1a29`).

2026-07-06 PROD new-intervention-proposal status discovery audit: read-only SQL artifact `sql/ops/prod-intervention-proposal-two-step-discovery-20260706.sql` verified `intervention_proposal` two-step state after the 2026-07-05 prevention releases. Runtime config still enables two-step review for `intervention_proposal`, and notification settings for RM review handoffs remain enabled as bell alerts. PROD has two active `intervention_proposal` workflows: workflow `12` / proposal `332` at `nwac_review`, and workflow `13` / proposal `339` at `final_decision_recorded`. Integrity summary command `30235ba3-6b96-4687-b6e1-44b78e08821b` returned zero active workflow/status issues, zero stranded submitted/in-review proposal candidates, zero duplicate active workflow subjects, zero missing generated packet document links, and zero active RM-review routing gaps. A separate underlying intervention-row check found zero submitted/in-review new-intervention rows without a compatibility proposal/workflow (`03858f8b-f318-4c88-ae38-6bc75d58a760`). Full audit rerun command `bcaf5887-2778-44dc-a519-e34d21bbe559` confirmed the same active workflow details and packet/event traces. No broad status migration or new-intervention-proposal data repair is indicated from this pass. Non-blocking historical observation: workflow `13` has complete authoritative workflow-event history (`submit_for_rm_review` -> `rm_submit_to_nwac` -> `nwac_approve`) and is final-approved, but the case-event trace does not show the initial `rm_review_requested` event that newer code now emits; do not create a retrospective alert for this final record unless a business owner explicitly asks for audit-note enrichment.

2026-07-06 PROD intervention-revision status discovery audit: read-only SQL artifact `sql/ops/prod-intervention-revision-two-step-discovery-20260706.sql` verified `intervention_revision` two-step state. Runtime config still enables two-step review for `intervention_revision`, and notification settings for RM review handoffs remain enabled as bell alerts. PROD has one active `intervention_revision` workflow: workflow `9`, the repaired feedback `#148` Case `16` item, now `final_decision_recorded` / approved. Source intervention `154` carries the applied revision follow-up marker (`approvalLetterFollowUp.kind='revision'`, status `sent`, revision draft marker `198`). Summary command `f60d0f34-e9b5-401b-abfe-02500d9b5b57` returned `active_workflow_count=1`, `active_live_review_workflow_count=0`, `stranded_submitted_revision_proposal_count=0`, `submitted_revision_intervention_without_proposal_or_workflow_count=0`, `duplicate_active_subject_count=0`, `final_approved_revision_followup_gap_count=0`, and `active_revision_draft_count=1`. The one active draft is proposal `136` / draft intervention `67` / source intervention `66` for Case `7` / Tanisha Gardypie, created by Emilie Marion on 2026-05-19; because it is still `draft`, no review workflow is expected. Full audit command `7cd66d2a-935b-470a-a1da-81787734eb77` returned no active workflow integrity issue rows, no submitted/in-review stranded revision rows, no missing generated packet links, no active RM-routing gaps, and no final-approved follow-up gaps. Historical bookkeeping observation: workflow `9` has subject key `intervention_revision:proposal:320` but null typed `proposal_id` / `intervention_id` columns after the repaired proposal/draft rows were no longer present; this is not a live queue blocker and no intervention-revision migration or data repair is indicated from this pass.

## Recommended Data Model

Use additive review routing/state rather than reusing overloaded lifecycle fields.

Preferred first-pass shape:

- `iset_review_workflow`
  - `id`
  - `workflow_type`: `application_assessment`, `intervention_proposal`, `intervention_revision`
  - subject identifiers: `case_id`, `application_id`, `intervention_id`, `proposal_id`, `action_plan_id` as applicable
  - `current_stage`: `rm_review`, `nwac_review`, `returned_to_rm`, `returned_to_submitter`, `final_decision_recorded`, `withdrawn`
  - `current_owner_role`
  - `current_owner_staff_profile_id` nullable
  - `submitted_by_staff_profile_id`
  - `submitted_at`
  - `rm_reviewed_by_staff_profile_id`
  - `rm_reviewed_at`
  - `rm_review_note`
  - `nwac_decided_by_staff_profile_id`
  - `nwac_decided_at`
  - `nwac_decision`
  - `nwac_decision_note`
  - `metadata_json`
  - timestamps

- `iset_review_workflow_event`
  - immutable transition history with actor, role, from/to stage, action, note, and compact subject snapshot.

The exact migration can be adjusted during implementation, but the model must remain additive and auditable.

Current DEV foundation:

- `sql/migrations/20260619_0001_create_rm_review_workflow.sql` creates `iset_review_workflow`, `iset_review_workflow_event`, and the disabled runtime flag `feature_flags/workflow.two_step_rm_review.enabled`.
- `src/lib/reviewWorkflow.js` defines the workflow types, stages, actions, role checks, subject keys, feature-flag interpretation, and allowed stage transitions.
- `src/lib/reviewWorkflow.test.js` covers the first-pass transition rules, including the submit-start role matrix for all supported workflow types, admin no-start behavior, RM no-final-decision authority, admin final-decision-only behavior, Decision Maker request-changes returning to RM, and submitter edit locks during review.
- `isetadminserver.js` wires the workflow behind the per-workflow runtime flag for application assessments, new intervention proposals, and intervention revisions. Submitter submission starts or restarts review at `rm_review`; RM return/forward actions write workflow events and reopen the item to the submitter; RM submit sends the item to the final-decision stage (`nwac_review`); Decision Maker request-changes returns the item to RM before the submitter; approve/deny records final workflow decision.
- `src/lib/reviewWorkflowCaseNotes.js` and the review-action backend routes mirror RM/Decision Maker transition notes into `iset_case_note` and include `note`, `review_note`, `decision_notes`, `case_note_id`, and `case_note_body` in review event payloads. `src/widgets/applicationEvents.js` displays those notes in the Events Timeline event data text.
- `src/widgets/CoordinatorAssessmentWidget.js` reads `reviewWorkflow`/`twoStepReviewEnabled`, allows Regional Managers to edit application-assessment drafts only while the application is still `in_review` and no review workflow row exists, locks submitted assessment body edits for reviewers, shows RM return/submit controls at RM stages, gates Decision Maker final decision controls to `nwac_review`, and blocks coordinator recall after RM sign-off.
- Regional Managers can submit those editable in-review draft application assessments, draft intervention proposals, and intervention revisions/amendments into the two-step review workflow when they are acting as the submitter. The first submit creates the relevant review workflow at `rm_review`; the same RM may then complete the RM review/sign-off under the agreed first-pass rule. Regional Managers still cannot make the final Decision Maker decision.
- `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx` reads `reviewWorkflow`/`twoStepReviewEnabled`, locks submitted proposal/revision body edits, shows RM return/submit/forward controls at RM stages, gates Decision Maker final decision controls to `nwac_review`, and blocks submitter recall after RM sign-off.
- Application assessment, new intervention proposal, and intervention revision final approval paths all enforce the single high-value funding policy: non-Shelley users cannot approve funding of `$20,000` or above. Decision pages show a Shelley-required warning and disable the approve option; backend guards reject the same approval if called directly.
- Approved intervention revisions reset the current client funding revision letter follow-up to `pending` when the revision is applied. Older original approval-letter sent markers are archived in `approvalLetterFollowUpHistory` and must not make a later revision appear complete; the widget and completion queue require revision-specific send evidence before saying the revision letter was sent.
- Intervention proposal compatibility rows must preserve the submit timestamp across later RM/final-decision updates. `iset_review_workflow.submitted_at` is the authoritative review submit time; `iset_intervention_proposal.submitted_at` is compatibility/reporting support and must not be overwritten by final approval timestamps.
- `sql/migrations/20260619_0002_seed_rm_review_notification_settings.sql` seeds default bell-alert rows for RM review handoffs, and `sql/migrations/20260620_0001_seed_rm_review_requested_notification.sql` seeds the initial `rm_review_requested` bell alert for Regional Managers. When an application assessment, new intervention proposal, or intervention amendment enters `rm_review`, PATH emits `rm_review_requested` and resolves Regional Manager recipients from the case portfolio region, falling back to the assigned case owner's region when the portfolio region is empty. Decision Maker request-changes events in the two-step workflow target the RM reviewer first; RM return/forward events target the submitter/case owner and include the RM note in the bell notification. Two-step review notification text should display the applicant's resolved first/last or legal/full name when case/application/client/submission context has it, and fall back to registered email only when no name is available. Email delivery for these new RM handoff events remains off until workflow-specific templates are configured.
- Approved assessment PDFs now resolve RM sign-off from `iset_review_workflow.rm_reviewed_*` and show it in the final agreement section between submitter evidence and Decision Maker approval evidence.
- Generated intervention assessment PDFs are normal supporting documents and must also be linked through `iset_document_intervention` for the relevant intervention. Metadata-only `intervention_id` is not enough for intervention-scoped document lookups.
- The reviewer EI verification control is intentionally separate from submitted-packet body edit permission, so Regional Managers and Decision Makers can set EI status and upload an EI verification report without editing the assessment narrative/recommendation body.
- A legacy assessment returned to its recorded submitter may retain its already accepted EI value without being trapped by a document requirement introduced after the original submission. This is not a general bypass: changing the EI value requires current verification evidence, and Save Progress must not rebaseline an unevidenced changed value as though it were the accepted original.
- `scripts/application-assessment-workflow-browser-smoke.js` covers the application-assessment submitter, RM, and Decision Maker branches with deterministic browser-driven fixtures, including two-step Coordinator submit and RM draft assessment submit before a workflow row exists.
- `scripts/intervention-assessment-workflow-browser-smoke.js` covers the new intervention proposal and intervention revision RM/Decision Maker branches with deterministic browser-driven fixtures, including RM draft new-proposal submit, RM draft revision submit, returned-change notes, and approved letter/funding-revision follow-up deep links. Its API stubs call the shared transition helper so role/workflow regressions fail the smoke instead of bypassing the backend guard.
- Local DEV migration verification on 2026-06-19 confirmed both workflow tables and the runtime flag exist. Local DEV is enabled for all three workflow types. A live DEV role-based UI walkthrough on 2026-06-19 passed through the application-assessment RM EI upload, RM return, RM submit upward, Decision Maker request-changes returning to RM, RM forward to coordinator, coordinator resubmission, and final approval. TEST/PROD deployment and activation happened later on 2026-06-20; keep this DEV walkthrough as early validation evidence, not as the current environment state.

## Queue Behavior

The application-assessment first pass is stage-aware on the homepage:

- Regional Managers see application-assessment and intervention proposal/revision items in `Pending Review` when the review workflow is `rm_review` or `returned_to_rm`.
- Final-decision users see application-assessment and intervention proposal/revision items in `Pending Decision` only when the review workflow is `nwac_review` or when no two-step workflow row exists for legacy/off-toggle pending decisions.
- Do not use `iset_application.status` or `iset_application.lifecycle_status` alone to decide approval queue membership while the two-step feature is enabled. PROD triage on 2026-07-05 found application `30` with the legacy row state `pending_approval` / `pending_decision` while review workflow `10` was correctly at `rm_review`; that split is only safe when queues, guards, reports, and staff-facing answers join `iset_review_workflow` and honor `current_stage`.
- Submitters see items in `returned_to_submitter`.
- Queue rows should show request type, participant, province/region, EI status when relevant, submitter/owner, RM review stage, and due/queued date.
- Queue/deep-link entry should open the relevant reviewer step directly: RM-stage intervention proposal/revision items land on `Review and submit`; Decision Maker-stage items land on the final decision step.

Do not add inline decision controls in the homepage queue. The queue remains a launch point into the workspace.

## Workspace Behavior

Application Assessment workspace:

- Coordinator submit sends the item to RM review instead of final decision.
- During RM review, RM sees the submitted assessment read-only plus a required notes/sign-off control.
- RM actions: `Return for changes` and `Submit for final decision`.
- During final-decision review, the Decision Maker sees final decision controls.
- The decision step shows the Coordinator assessment recommendation/rationale and the Regional Manager review note.
- Decision Maker `Request Changes` sends the item back to RM, not Coordinator.
- RM then forwards changes to Coordinator; the assessment becomes editable for the submitter.
- When the assessment is returned to the Coordinator, the widget shows a top-level `Changes requested` panel with the Decision Maker note and the Regional Manager forwarding note.
- At `returned_to_rm`, RM does not see `Submit for final decision`; the first-release path is to forward the Decision Maker's requested changes to the Coordinator.

Intervention Assessment workspace:

- ISET Coordinator submit sends new proposals/revisions to RM review.
- RM can inspect, return with notes, or submit for final decision.
- Final approval/denial/request-changes remains Decision Maker-only for business workflow purposes.
- The decision step shows the submitter's proposal recommendation/rationale and the Regional Manager review note.
- When a proposal/revision is returned to the submitter, the widget shows a top-level `Changes requested` panel with the Decision Maker note and the Regional Manager forwarding note.
- Approved intervention proposal/revision follow-up letters remain separate post-decision work.

## PDF / Artifact Behavior

Final generated PDFs must show:

- submitter/coordinator signature or submitted-by evidence;
- RM review/sign-off name, role, date, and optional review note summary;
- final Decision Maker name, role, date, and decision.

Submitted-but-not-final packet PDFs may show a submitted packet signature without final decision evidence. Recalled or returned versions must not become false active baselines for later redlines.

## Runtime Config

Add a runtime feature flag, default disabled outside DEV until activation:

- key suggestion: `workflow.two_step_rm_review.enabled`
- scope suggestion: `feature_flags` or existing runtime feature config pattern
- value should allow per-workflow-type enablement if cheap:
  - `application_assessment`
  - `intervention_proposal`
  - `intervention_revision`

If implementation cost is high, use one global toggle for the first pass and keep the schema flexible.

## TEST/PROD Notification Configuration

When Bill explicitly asks for TEST or PROD rollout/activation, apply a one-off notification configuration check after the relevant migrations are deployed and before/with feature activation. The required bell-alert rows are:

| event | role | language | enabled | email_alert | bell_alert | purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `rm_review_requested` | `Regional Manager` | `en` | `1` | `0` | `1` | Alerts Regional Managers when an application assessment, new intervention proposal, or intervention amendment first enters `Pending Review` / `rm_review`. |
| `rm_review_returned_to_submitter` | `ISET Coordinator` | `en` | `1` | `0` | `1` | Alerts the submitter/case owner when RM returns work for changes. |
| `rm_review_changes_forwarded` | `ISET Coordinator` | `en` | `1` | `0` | `1` | Alerts the submitter/case owner when RM forwards Decision Maker-requested changes. |
| `rm_review_submitted_to_nwac` | `NWAC Administrator` | `en` | `1` | `0` | `1` | Alerts Decision Makers when RM submits work for final decision. |
| `rm_review_submitted_to_nwac` | `System Administrator` | `en` | `1` | `0` | `1` | Technical support/superuser notification only; not part of business workflow acceptance. |
| `nwac_review_changes_requested` | `Regional Manager` | `en` | `1` | `0` | `1` | Alerts the RM reviewer when the Decision Maker requests changes. |

Disable the legacy admin submit-for-review rows when the two-step workflow is active:

| event | role | language | enabled | email_alert | bell_alert | reason |
| --- | --- | --- | --- | --- | --- | --- |
| `assessment_submitted` | `NWAC Administrator` | any | `0` | `0` | `0` | Admin users should not receive the initial ISET Coordinator or Regional Manager submission into RM review. |
| `assessment_submitted` | `System Administrator` | any | `0` | `0` | `0` | Technical support/superuser users should not receive the initial ISET Coordinator or Regional Manager submission into RM review. |
| `assessment_submitted` | `Regional Manager` | any | `0` | `0` | `0` | Regional Manager queue-arrival alerts must use the region-scoped `rm_review_requested` event, not the broad legacy submit event. |

Use migrations `sql/migrations/20260619_0002_seed_rm_review_notification_settings.sql`, `sql/migrations/20260620_0001_seed_rm_review_requested_notification.sql`, and `sql/migrations/20260620_0002_normalize_two_step_review_notification_settings.sql` as the source for seeded defaults and normalization, but do not rely only on `INSERT ... WHERE NOT EXISTS` when applying the one-off. If TEST/PROD already has disabled, stale, duplicate, or email-enabled rows for these exact event/role/language keys, normalize those rows to the table above unless Bill explicitly asks to configure workflow emails and templates.

Do not leave a broad `assessment_submitted` / `Regional Manager` row enabled as a substitute for RM queue-arrival alerts. The new two-step feature uses `rm_review_requested` because it is region-scoped to the case review region; broad legacy rows can over-notify or target the wrong staff.

Do not leave broad `assessment_submitted` rows enabled for admin roles as a substitute for final-decision alerts. Admin users should only receive the RM escalation event, `rm_review_submitted_to_nwac`, when the work is actually in the Decision Maker `Pending Decision` stage.

Recommended one-off verification query:

```sql
SELECT event, role, language, enabled, email_alert, bell_alert, template_id
  FROM notification_setting
 WHERE event IN (
   'assessment_submitted',
   'rm_review_requested',
   'rm_review_returned_to_submitter',
   'rm_review_changes_forwarded',
   'rm_review_submitted_to_nwac',
   'nwac_review_changes_requested'
 )
 ORDER BY event, role, language;
```

Activation check after configuration: submit one application assessment or proposal into RM review in the target environment and verify a `Pending Review` `iset_internal_notification` row exists for the expected Regional Manager staff profile(s), with `event_key='rm_review_requested'`; then have the RM submit it for final decision and verify Decision Maker users see a `Ready for final decision` bell notification with `event_key='rm_review_submitted_to_nwac'`, while no admin-role `Assessment submitted` bell is created for the RM-review submission.

## Testing Plan

Backend tests:

- ISET Coordinator submit creates/advances review workflow to `rm_review`.
- Regional Manager submitter starts for application assessments, new intervention proposals, and intervention revisions create/advance review workflow to `rm_review`.
- NWAC Administrator users cannot start any of the three workflows; System Administrator technical support access must not create an ordinary business start path.
- RM cannot final approve/deny.
- RM return requires a note and moves to `returned_to_submitter`.
- RM submit for final decision moves to `nwac_review`.
- Decision Maker approve/deny records final decision and preserves RM sign-off.
- Decision Maker users, and any technical superuser path, cannot approve funding of `$20,000` or above unless the requester is Shelley Stacey.
- Decision Maker request changes moves to `returned_to_rm`.
- RM forwards Decision Maker changes to submitter and unlocks submitter edits.
- RM cannot resubmit directly for final decision from `returned_to_rm`.
- Submitter cannot edit while stage is `rm_review`, `nwac_review`, or `returned_to_rm`.
- Stage transitions are rejected when actor role/stage is invalid.
- RM and Decision Maker transition notes are recorded once in `Notes and Tasks` with actor/context wording and are included in the corresponding Events Timeline payload/message data.
- Notification routing sends a `Pending Review` bell alert to Regional Managers in the case review region when work first enters `rm_review`; sends Decision Maker request-changes alerts to the RM while the workflow is `returned_to_rm`; then sends the later RM-forwarded change alert to the submitter/case owner with the RM forwarding note.

Browser smokes:

- `npm run smoke:application-assessment:workflow:browser` covers the application-assessment first pass, including legacy Coordinator submit, two-step Coordinator submit, RM draft submit, RM return to submitter, RM submit for final decision, Decision Maker request-changes returning to RM, and RM forwarding requested changes to the submitter. Passing local runs: 2026-06-19, 2026-06-26, and 2026-07-05 against the production bundle.
- The 2026-08-06 application-assessment browser run also covers a reopened final-decision recovery marked `requiresSubmitterCorrectionReturn=true`: the RM sees the correction warning and Return action, cannot see Submit for final decision, and the return reaches the original submitter. The real backend caller-boundary regression separately proves a forged RM escalation request is rejected before any write.
- `npm run smoke:intervention-assessment:workflow:browser` covers intervention proposal/revision RM draft submit, RM return, RM submit upward, Decision Maker review with RM notes, high-value Shelley warning, Decision Maker request-changes returning through RM, submitter-visible Decision Maker/RM notes, revision decision review, and approved communication/funding-revision letter follow-up entry points. Passing local runs: 2026-06-19, 2026-06-26, and 2026-07-05 against the production bundle.
- `npm run smoke:two-step-review:prevention` is the focused non-browser guard for the 2026-07-05 prevention fixes. It imports the server in repair-export mode with stubbed DB/S3 I/O and verifies that generated intervention assessment PDFs create `iset_document_intervention` links and that intervention proposal compatibility syncing preserves the original `submitted_at` across final-decision updates. Passing local run: 2026-07-05.
- Production build verification passed locally on 2026-07-05 with the existing source-map parse warning and bundle-size warning. Full Jest passed locally on 2026-07-05: 48 suites, 203 tests.
- Live DEV UI walkthrough evidence on 2026-06-19 used real role logins and left application `1` approved with review workflow `15` at `final_decision_recorded`; screenshots are under `tmp/rm-review-live-ui/2026-06-19T17-22-44-405Z/`.
- Live TEST route evidence on 2026-06-26 for release `20260626-rm-two-step-role-matrix-test` used real TEST Cognito/staff users for ISET Coordinator, Regional Manager, NWAC Administrator, and System Administrator. Deployed-source checks confirmed the role/workflow matrix on the TEST host and stale `Case Manager` denial. Disposable live API fixtures verified: RM application-assessment submit creates `application_assessment/rm_review`; NWAC/System Administrator submit-start attempts for intervention requests return `403 review_workflow_transition_forbidden`; RM new-intervention submit creates `intervention_proposal/rm_review`; RM revision submit creates `intervention_revision/rm_review`; revision submit generates submitted v2 and redline v2 assessment PDFs. All disposable TEST DB rows, locks, documents, and upload objects were cleaned up.
- Live PROD deployment evidence on 2026-06-26 for release `20260626-rm-two-step-role-matrix-prod` confirmed the deployed role matrix on replacement instance `i-047ed87247d2e408e`, including ISET Coordinator/Regional Manager submit-start allow and NWAC/System Administrator submit-start denial. Runtime config remained enabled for all three workflow types. Targeted Case 16 recovery for feedback `#148` created workflow `9` for intervention revision `198` / proposal `320` in `rm_review`, generated submitted assessment v2 document `4913` and redline v2 document `4914`, and verified both S3 objects.
- A local dispatcher smoke on 2026-06-19 verified that `nwac_review_changes_requested` with an RM recipient creates a Regional Manager bell notification, while `rm_review_changes_forwarded` creates an ISET Coordinator bell notification containing the RM note. On 2026-06-20, focused dispatcher tests added coverage for `rm_review_requested` region-scoped Regional Manager bell alerts when work enters the RM `Pending Review` queue.
- `npm run smoke:intervention-assessment:recall:browser` continues to cover the submitted proposal recall branch. Passing local run: 2026-06-19.

PDF checks:

- submitted packet PDF still generates;
- final packet PDF includes RM and Decision Maker sign-off;
- redline baseline ignores recalled/returned inactive submissions.

Queue checks:

- RM queue shows only RM-stage items in scope;
- Pending Decision queue shows only final-decision-stage items;
- submitter queue shows returned work;
- homepage/dashboard steady state has no runaway refetch/render loop.

## Release Plan

1. Create schema and code behind a disabled runtime toggle. DEV implementation now covers application assessment, intervention proposal, and intervention revision workflows.
2. Enable toggle in local DEV for all three workflow types. Done on 2026-06-19; keep TEST/PROD disabled until explicit rollout steps.
3. Run source checks, backend tests, browser smokes, and live DEV role walkthroughs. Application-assessment checks passed locally on 2026-06-19; intervention proposal/revision walkthroughs are next.
4. Create user guide/training material in repo docs. Draft guide exists at `docs/guides/rm-two-step-review-user-guide.md`; revise before TEST UAT.
5. Deploy to TEST with toggle disabled. Done in release `20260620-rm-two-step-review-rollout`; the toggle was enabled after smoke.
6. Enable toggle in TEST for UAT. Done on 2026-06-20.
7. UAT with Regional Managers and Decision Makers on all three request types.
8. Fix UAT findings.
9. Pick final PROD activation window; current target is Monday, July 13, 2026.
10. Deploy app/schema to PROD with toggle disabled. Done in release `20260620-rm-two-step-review-rollout`.
11. Enable the toggle in PROD during the approved launch window. Done on 2026-06-20 after normal-routing smoke.
12. Verify queues, one application assessment flow, one intervention proposal flow, one intervention revision flow, and final PDFs.

Future PROD changes to this workflow still require explicit Bill approval in the launch thread. After the 2026-06-26 feedback pattern, no further PROD hotfix for this workflow should ship unless the role/action/stage/workflow transition matrix, the application-assessment browser workflow smoke, and the intervention-assessment browser workflow smoke have all passed in the current release thread.

## PROD Feedback #148 Recovery

Read-only PROD recheck on 2026-06-26 confirmed Emilie Marion's feedback report `#148` is still a stuck intervention revision, not a permissions-only display issue:

- Case `16` / application `54`; source intervention `154` is approved.
- Revision intervention `198` / proposal `320` is `submitted`, proposal kind `revision`, source intervention `154`, submitted by Emilie Marion (`staff_profiles.id=55`) at `2026-06-23 15:55:32` UTC.
- There is no `iset_review_workflow` row and no review-workflow event for `intervention_revision:proposal:320`.
- Only the original v1 submitted/approved assessment PDFs exist; no v2 submitted assessment PDF or redline v2 exists for revision `198`.

Do not run this recovery before the fixed code is deployed to PROD and Bill explicitly approves a PROD data repair. The guarded recovery sequence should be:

1. Put PROD admin into the normal maintenance/fallback window and deploy the fixed admin app only, with no schema/data/portal/shared changes unless the final diff says otherwise.
2. Re-run the read-only guard for Case `16`, intervention `198`, proposal `320`, source `154`, and report `#148`; abort if any id, status, submitter, or existing-workflow/document condition differs.
3. Create the missing `intervention_revision` workflow and `submit_for_rm_review` event for proposal `320`, preserving Emilie as the submitter/actor and setting the current stage to `rm_review`.
4. Regenerate the missing submitted v2 assessment PDF and redline v2 for revision `198` from the deployed application document-generation code, using source intervention `154` as the redline baseline. Do not insert document rows without real uploaded PDF objects.
5. Verify RM Pending Review contains the repaired revision, the workflow audit event exists, and the v2/redline documents are active on Case `16`.
6. Only after verification, update feedback report `#148` with the deployed release id, repair evidence, and final status.

## User Guide Requirements

Create a staff-facing guide before TEST UAT. It should cover:

- what changed and why;
- what ISET Coordinators do after submitting;
- what Regional Managers review and what they can/cannot edit;
- how RM return notes work;
- what the Decision Maker sees;
- what happens when the Decision Maker requests changes;
- where each role finds its queue;
- what appears on the final PDF;
- what to do if someone is away during first-pass rollout.

Guide should be written as a job aid, not implementation notes.

## Phase 2 Candidates

- Explicit alternate RM/delegate owner for vacation coverage.
- Temporary out-of-office routing with start/end dates.
- SLA timers split by RM review and Decision Maker final decision.
- Configurable per-region review routing.
- Reporting widgets for RM review throughput and returned-work reasons.

## Cross-workflow assessment-start contract

Conflict declarations remain case-and-staff scoped, while assessment start is
application scoped. Merely opening the page or signing or reusing a declaration
must not advance an application. On the first successful assessment write to a
`submitted` application, the transactional backend boundary requires the exact
assigned ISET Coordinator or Regional Manager and an active no-conflict or
cleared-conflict declaration, then moves only that application to `in_review`.
Direct submission can move directly to its review-owned state. A draft save does
not create a review workflow or change the case lifecycle, sibling applications,
decisions, letters, CFA state, or prior assessments.

The broader composed-workflow review must continue to model exact application,
business role or capacity, application lifecycle, review stage, conflict
declaration, participant-form and signing state, generated-document version,
Action Plan and intervention lineage, decision outcome, and post-decision
communication. Every transition needs one authoritative owner and caller
boundary; an unrelated prerequisite must never be the only way another state
machine advances.

## Open Business Watchpoints

- Confirm remaining stakeholder UAT/training gaps after the early 2026-06-20 PROD activation; do not use the older July 13 target as evidence that PROD is still disabled.
- Confirm whether the Decision Maker role should be described as permanent in user-facing training, or as a current approval-routing process.
- Confirm whether final PDFs should include full RM notes or only RM name/date/sign-off plus a reference to internal notes.
- Keep training and support guidance clear that a valid case-level declaration
  carries across that staff member's applications on the case, while each
  application's assessment begins independently on its first successful save.
