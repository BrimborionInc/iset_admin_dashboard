# Regional Manager Two-Step Review Workflow

Purpose: plan the new Regional Manager review stage for assessment and intervention approval workflows.
Audience: product, engineering, operations, training, and future AI-assisted development threads.
Last Updated: 2026-06-20

## Status

Design accepted for a low-risk first pass. The implementation now covers application assessments, new intervention proposals, and intervention amendments/revisions behind the runtime toggle. Schema, shared transition helper, backend submission/final-decision integration, Regional Manager action endpoints, workspace payloads, stage-aware homepage queues, final-PDF RM sign-off support, `CoordinatorAssessmentWidget`, and the Case Workspace intervention proposal widget are wired. Application-assessment browser smoke coverage and a live DEV UI walkthrough with real role logins are in place; intervention proposal/revision workflow browser smoke coverage is now in place for the deterministic UI paths. Live role-based UAT across the two intervention workflows remains the next validation step.

The migration/runtime default is off, but DEV, TEST, and PROD now have the flag enabled for `application_assessment`, `intervention_proposal`, and `intervention_revision`.

Deployment note: release `20260620-rm-two-step-review-rollout` deployed the feature to TEST and PROD on 2026-06-20 with the one-off notification configuration operation applied in both environments. Do not assume future app/schema deployment alone is enough if these rows drift; explicitly verify and normalize the notification rows listed under **TEST/PROD Notification Configuration** below.

Target launch date: **Monday, July 13, 2026**, pending stakeholder UAT readiness, remaining scope completion, and Bill's explicit PROD release approval.

## Business Trigger

Regional Managers no longer have final approval rights for the affected approval workflows. The expected workflow is now:

1. Coordinator or Case Manager submits the assessment/proposal.
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
- Application final decisions are currently restricted in frontend/backend to Decision Maker users (`NWAC Administrator`) and `System Administrator`.
- Intervention proposal/revision final decisions are also currently restricted to Decision Maker users (`NWAC Administrator`) and `System Administrator`.
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
- Decision Maker request-changes returns to RM first, not directly to the submitter.
- RM forwards Decision Maker-requested changes to the submitter with notes.
- Coordinator/Case Manager edits are allowed only after the workflow is returned to them.
- Only Shelley Stacey (`sstacey@nwac.ca`) can approve funding of `$20,000` or above. This applies to application assessments, new intervention proposals, and intervention amendments/revisions. Other final-decision users can deny or request changes, but the approval path is blocked in the decision UI and enforced by the backend.
- Use professional, role-based workflow labels in staff-facing copy. Say `Decision Maker` for the final-decision role. Do not use `NWAC` as shorthand for an approval actor because coordinators and Regional Managers are also NWAC staff. Reserve `NWAC` for the organization, the program/funding source, or exact system role names. Do not name individual approvers except where the Shelley Stacey high-value funding threshold rule genuinely requires it.
- Submitter-facing copy should say `Submit for review`, `Resubmit for review`, `submitted to Regional Manager review`, or `submitted for review` while the two-step workflow is active. Regional Manager escalation should say `Submit for final decision`. Reserve `approval` wording for the final decision and post-approval letter/funding-document surfaces.
- Every stage transition must have audit evidence: actor, role, timestamp, note where applicable, and workflow subject.
- Review and decision notes must also be easy to find from the case file: when an RM or Decision Maker enters a transition note, PATH mirrors it into `Notes and Tasks` as an internal case note and carries the note plus the case-note reference in event payload data.
- Feature should ship behind a runtime config toggle so PROD can be deployed safely before activation.

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
- `src/lib/reviewWorkflow.test.js` covers the first-pass transition rules, including RM no-final-decision authority, Decision Maker request-changes returning to RM, and submitter edit locks during review.
- `isetadminserver.js` wires the workflow behind the per-workflow runtime flag for application assessments, new intervention proposals, and intervention revisions. Submitter submission starts or restarts review at `rm_review`; RM return/forward actions write workflow events and reopen the item to the submitter; RM submit sends the item to the final-decision stage (`nwac_review`); Decision Maker request-changes returns the item to RM before the submitter; approve/deny records final workflow decision.
- `src/lib/reviewWorkflowCaseNotes.js` and the review-action backend routes mirror RM/Decision Maker transition notes into `iset_case_note` and include `note`, `review_note`, `decision_notes`, `case_note_id`, and `case_note_body` in review event payloads. `src/widgets/applicationEvents.js` displays those notes in the Events Timeline event data text.
- `src/widgets/CoordinatorAssessmentWidget.js` reads `reviewWorkflow`/`twoStepReviewEnabled`, locks submitted assessment body edits for reviewers, shows RM return/submit controls at RM stages, gates Decision Maker final decision controls to `nwac_review`, and blocks coordinator recall after RM sign-off.
- `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx` reads `reviewWorkflow`/`twoStepReviewEnabled`, locks submitted proposal/revision body edits, shows RM return/submit/forward controls at RM stages, gates Decision Maker final decision controls to `nwac_review`, and blocks submitter recall after RM sign-off.
- Application assessment, new intervention proposal, and intervention revision final approval paths all enforce the single high-value funding policy: non-Shelley users cannot approve funding of `$20,000` or above. Decision pages show a Shelley-required warning and disable the approve option; backend guards reject the same approval if called directly.
- Approved intervention revisions reset the current client funding revision letter follow-up to `pending` when the revision is applied. Older original approval-letter sent markers are archived in `approvalLetterFollowUpHistory` and must not make a later revision appear complete; the widget and completion queue require revision-specific send evidence before saying the revision letter was sent.
- `sql/migrations/20260619_0002_seed_rm_review_notification_settings.sql` seeds default bell-alert rows for RM review handoffs, and `sql/migrations/20260620_0001_seed_rm_review_requested_notification.sql` seeds the initial `rm_review_requested` bell alert for Regional Managers. When an application assessment, new intervention proposal, or intervention amendment enters `rm_review`, PATH emits `rm_review_requested` and resolves Regional Manager recipients from the case portfolio region, falling back to the assigned case owner's region when the portfolio region is empty. Decision Maker request-changes events in the two-step workflow target the RM reviewer first; RM return/forward events target the submitter/case owner and include the RM note in the bell notification. Email delivery for these new RM handoff events remains off until workflow-specific templates are configured.
- Approved assessment PDFs now resolve RM sign-off from `iset_review_workflow.rm_reviewed_*` and show it in the final agreement section between submitter evidence and Decision Maker approval evidence.
- The Regional Manager/Decision Maker/System Administrator EI verification control is intentionally separate from submitted-packet body edit permission, so reviewers can set EI status and upload an EI verification report without editing the assessment narrative/recommendation body.
- `scripts/application-assessment-workflow-browser-smoke.js` covers the application-assessment RM and Decision Maker branches with deterministic browser-driven fixtures.
- `scripts/intervention-assessment-workflow-browser-smoke.js` covers the new intervention proposal and intervention revision RM/Decision Maker branches with deterministic browser-driven fixtures, including returned-change notes and approved letter/funding-revision follow-up deep links.
- Local DEV migration verification on 2026-06-19 confirmed both workflow tables and the runtime flag exist. Local DEV is enabled for all three workflow types. A live DEV role-based UI walkthrough on 2026-06-19 passed through the application-assessment RM EI upload, RM return, RM submit upward, Decision Maker request-changes returning to RM, RM forward to coordinator, coordinator resubmission, and final approval. No TEST or PROD deploy/activation has happened.

## Queue Behavior

The application-assessment first pass is stage-aware on the homepage:

- Regional Managers see application-assessment and intervention proposal/revision items in `Pending Review` when the review workflow is `rm_review` or `returned_to_rm`.
- Final-decision users see application-assessment and intervention proposal/revision items in `Pending Decision` only when the review workflow is `nwac_review` or when no two-step workflow row exists for legacy/off-toggle pending decisions.
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

- Case Manager submit sends new proposals/revisions to RM review.
- RM can inspect, return with notes, or submit for final decision.
- Final approval/denial/request-changes remains Decision Maker-only, with System Administrator technical superuser access.
- The decision step shows the Case Manager proposal recommendation/rationale and the Regional Manager review note.
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
| `rm_review_submitted_to_nwac` | `System Administrator` | `en` | `1` | `0` | `1` | Alerts System Administrator users acting as Decision Makers when RM submits work for final decision. |
| `nwac_review_changes_requested` | `Regional Manager` | `en` | `1` | `0` | `1` | Alerts the RM reviewer when the Decision Maker requests changes. |

Disable the legacy admin submit-for-review rows when the two-step workflow is active:

| event | role | language | enabled | email_alert | bell_alert | reason |
| --- | --- | --- | --- | --- | --- | --- |
| `assessment_submitted` | `NWAC Administrator` | any | `0` | `0` | `0` | Admin users should not receive the initial Coordinator/Case Manager submission into RM review. |
| `assessment_submitted` | `System Administrator` | any | `0` | `0` | `0` | System Administrator users should not receive the initial Coordinator/Case Manager submission into RM review. |
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

- Coordinator/Case Manager submit creates/advances review workflow to `rm_review`.
- RM cannot final approve/deny.
- RM return requires a note and moves to `returned_to_submitter`.
- RM submit for final decision moves to `nwac_review`.
- Decision Maker approve/deny records final decision and preserves RM sign-off.
- Decision Maker/System Administrator users other than Shelley cannot approve funding of `$20,000` or above across application assessments, new intervention proposals, or intervention amendments/revisions.
- Decision Maker request changes moves to `returned_to_rm`.
- RM forwards Decision Maker changes to submitter and unlocks submitter edits.
- RM cannot resubmit directly for final decision from `returned_to_rm`.
- Submitter cannot edit while stage is `rm_review`, `nwac_review`, or `returned_to_rm`.
- Stage transitions are rejected when actor role/stage is invalid.
- RM and Decision Maker transition notes are recorded once in `Notes and Tasks` with actor/context wording and are included in the corresponding Events Timeline payload/message data.
- Notification routing sends a `Pending Review` bell alert to Regional Managers in the case review region when work first enters `rm_review`; sends Decision Maker request-changes alerts to the RM while the workflow is `returned_to_rm`; then sends the later RM-forwarded change alert to the submitter/case owner with the RM forwarding note.

Browser smokes:

- `npm run smoke:application-assessment:workflow:browser` covers the application-assessment first pass, including RM return to submitter, RM submit for final decision, Decision Maker request-changes returning to RM, and RM forwarding requested changes to the submitter. Passing local run: 2026-06-19.
- `npm run smoke:intervention-assessment:workflow:browser` covers intervention proposal/revision RM return, RM submit upward, Decision Maker review with RM notes, high-value Shelley warning, Decision Maker request-changes returning through RM, submitter-visible Decision Maker/RM notes, revision decision review, and approved communication/funding-revision letter follow-up entry points. Passing local run: 2026-06-19.
- Live DEV UI walkthrough evidence on 2026-06-19 used real role logins and left application `1` approved with review workflow `15` at `final_decision_recorded`; screenshots are under `tmp/rm-review-live-ui/2026-06-19T17-22-44-405Z/`.
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

Future PROD changes to this workflow still require explicit Bill approval in the launch thread.

## User Guide Requirements

Create a staff-facing guide before TEST UAT. It should cover:

- what changed and why;
- what Coordinators/Case Managers do after submitting;
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

## Open Business Watchpoints

- Confirm whether any staff blackout/vacation windows conflict with the July 13, 2026 target.
- Confirm whether the Decision Maker role should be described as permanent in user-facing training, or as a current approval-routing process.
- Confirm whether final PDFs should include full RM notes or only RM name/date/sign-off plus a reference to internal notes.
