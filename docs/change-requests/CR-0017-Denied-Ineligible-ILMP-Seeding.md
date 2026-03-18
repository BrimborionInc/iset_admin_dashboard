# CR-0017: Denied-Ineligible ILMP Seeding

Status: Implementation Complete / Verification Pending
Owner: Codex + Bill
Last updated: 2026-03-17

## Goal
Ensure applications denied specifically for `eligibility_not_met` still produce the downstream client/action-plan/intervention/reporting records required for ESDC ILMP reporting, without pushing those records into normal casework workflows.

## Current behavior (baseline)
- In the Application Workspace, Regional Managers and Program Managers can deny funding through the Application Assessment widget.
- The current denial communication flow sends the denial letter and then marks the application `rejected`.
- The denial flow does not currently seed any additional downstream program structure for reporting.
- The existing automatic downstream seeding path is approval-centric:
  - `ensureCaseClientLinkForApproval(...)` creates or links the client.
  - `ensureAutoPlanAndInterventionFromAssessment(...)` creates an auto-generated action plan and planned intervention.
  - `ensureEsdcParticipantSubmissionRecord(...)` creates or refreshes the ESDC participant submission row.
- The ESDC participant submission pipeline already supports non-ready states:
  - `readiness_status` includes `needs_review` / `blocked` / `ready`.
  - queue logic already surfaces blocking issues and can keep records out of submission workflows until data validates.

## Problem statement
- ESDC ILMP reporting is structured around a client with at least one action plan and one intervention.
- A denied application on its own is not a reportable ILMP unit.
- MWAC/NWAC business direction requires denied applicants, specifically ineligible applicants, to still be represented in ESDC reporting outputs.
- If the system continues treating eligibility denials as terminal application-only outcomes, these applicants are missing from downstream reporting.

## Interview decisions (locked)
### Trigger
- Only denials with `assessment_nwac_reason = eligibility_not_met` trigger the new downstream record creation.
- No other denial reasons should trigger this behavior unless explicitly added later.

### Resulting operational model
- Keep the application denial flow intact:
  - denial letter still sends
  - application still ends in denied/rejected state
- In parallel, automatically create the downstream reporting structure required for ILMP.
- These records are not part of ongoing service delivery and must stay out of normal active casework queues.

### Required automatic creation
- Ensure a client record exists for the denied applicant; create one if needed.
- Ensure an action plan exists for ILMP reporting.
- The action plan should be effectively opened and closed immediately.
- Create exactly one intervention under that action plan.
- The intervention type must be `Career Research and Exploration`.
- Action plan/intervention exact status/result/outcome values are still to be finalized during planning.

### Reporting and queue behavior
- Create the downstream records even when ILMP-required data is incomplete or invalid.
- Newly created denied-ineligible reporting records should be auto-excluded from the ESDC submission queue by default when validation is not satisfied.
- Validation failures must be surfaced clearly in the admin UI.
- These records must not silently block a reporting batch.
- Staff should not need to manually remove them from a batch every time.
- Once missing/invalid ILMP-required data is corrected and the record validates, the system should automatically unblock it and allow it into the ESDC reporting queue.
- No separate manual “ready/include for reporting” step should be introduced at this stage.

### Ownership and correction surface
- Ownership remains with the current application owner or denying manager only for reporting-data correction.
- These records should appear in ESDC/ILMP validation and reporting exception surfaces, not in standard service-delivery queues.
- Staff should correct missing ILMP-required data in the existing Application Workspace.
- Those corrections must propagate downstream to the generated client/action plan/intervention/reporting records.
- Staff should not need to enter the full Case Workspace unless a technical limitation makes that unavoidable.

## Business constraints captured in interview
- ILMP minimum data requirements can include:
  - client identity/contact fields such as valid SIN, date of birth, address, Indigenous identity, disability, gender
  - action plan fields such as agreement number, EI claimant type, social assistance status, start/result dates and result code
  - intervention fields such as intervention code, start/end dates, and intervention outcome
- Some denied-ineligible applications may not contain enough data to validate cleanly for ILMP at denial time.
- That incompleteness is not a reason to skip downstream record creation; it is a reason to create the records in a blocked reporting state.

## Non-goals
- Do not broaden the trigger to all denial reasons.
- Do not route these records into normal case management/service-delivery workflows.
- Do not introduce a second manual reporting-approval gate.
- Do not require staff to manage denied-ineligible reporting fixes in the Case Workspace by default.

## Codebase findings relevant to planning
### Denial path today
- `src/widgets/CoordinatorAssessmentWidget.js`
  - `handleCommunicationComplete()` sends the denial letter and then updates the application status to `rejected`.
- `isetadminserver.js`
  - assessment update flow persists application status changes and events, but the auto-plan/client-link seeding is currently tied to approval/completion transitions.

### Existing seeding path we can likely adapt
- `ensureCaseClientLinkForApproval(...)`
  - builds/links a `client` row from the application payload and attaches it to `iset_case.client_id`.
- `ensureAutoPlanAndInterventionFromAssessment(...)`
  - creates an auto-generated action plan plus intervention from assessment data.
  - current behavior is approval-oriented:
    - action plan starts as `draft`
    - intervention starts as `planned`
    - seeding is skipped if an active/draft plan already exists
- `ensureEsdcParticipantSubmissionRecord(...)`
  - creates/resets the ESDC participant submission row for the case.
- `markEsdcParticipantSubmissionNeedsReview(...)`
  - resets readiness/submission state after data changes.

### Existing ESDC queue behavior we can reuse
- `esdc_participant_submission.readiness_status` already supports queue gating.
- `/api/esdc/participants` already distinguishes `ready`, `needs_review`, and `blocked`.
- The ILMP validation pipeline already stores warnings and blocking issues and can keep records out of queueable submission states.

### Confirmed reference/lookups
- The existing intervention lookup set already maps code `1` to `Career research and exploration` in the case workspace UI.
- Action plan close flows already use standard ILMP result-code values including `6 = No longer in labour force` and `9 = Ready for work`.

### Current Application Workspace limitation
- Application Workspace answer editing currently persists to `iset_application.payload_json` and version history only.
- There is no existing automatic downstream resync from that edit path into:
  - `client`
  - `iset_case.case_context_json`
  - `iset_case_action_plan`
  - `iset_case_intervention`
  - `esdc_participant_submission`
- This means the denied-ineligible reporting fix path requires explicit sync/revalidation logic; it is not already solved by current edit APIs.

## Planning hypotheses
- We should extend the current approval-only seeding helpers rather than invent a second parallel data-creation stack.
- The denial-specific path likely needs its own helper or a generalized “reporting seeding” helper because the existing auto-plan helper is approval-biased in several ways:
  - it expects proposed interventions from the assessment
  - it creates `draft` + `planned` records meant for ongoing casework
  - it assumes the intervention definition comes from the recommendation, not a denial-specific fixed code
- The Application Workspace will need a clearer reporting-fix surface for denied-ineligible records so users can see:
  - why the record is blocked
  - which ILMP fields are missing or invalid
  - whether the record has automatically re-entered the ESDC queue after correction

## Open technical decisions for planning
1. Exact action plan lifecycle values for the denied-ineligible synthetic plan:
   - persisted `status`
   - effective date / result date behavior
   - result code to use for immediate closure
2. Exact intervention lifecycle values for the denied-ineligible synthetic intervention:
   - persisted `status`
   - outcome code for ILMP close-out
3. Canonical intervention code/value for `Career Research and Exploration`:
   - current codebase evidence points to ILMP intervention code `1`
   - decide whether implementation should hard-code `1` or resolve it defensively from the reference table
4. Agreement/funding mapping for denied-ineligible records:
   - derive EI vs CRF from existing eligibility/application data
   - confirm agreement-number derivation rules when the applicant is ineligible
5. Data repair propagation model:
   - determine which Application Workspace edits must re-sync `client`, action plan, intervention, and `esdc_participant_submission`
   - determine whether any denied-ineligible action-plan/intervention fields should remain system-owned and immutable
6. Queue/filtering impact:
   - ensure these records appear in ILMP validation/exception surfaces
   - ensure they remain absent from ordinary casework portfolio and service-delivery views

## Initial implementation outline
1. Add a denial-specific reporting-seeding path triggered only when the denial reason is `eligibility_not_met`.
2. Ensure client linkage/creation occurs for that path, not only for approvals.
3. Create the synthetic closed action plan and single `Career Research and Exploration` intervention.
4. Create/reset the ESDC participant submission record and run ILMP validation.
5. Default invalid records to blocked/excluded queue behavior.
6. Surface the blocked state and validation issues in Application Workspace.
7. Re-run sync + validation automatically when Application Workspace corrections affect ILMP-required fields.
8. Automatically unblock once validation passes.

## Planning decisions (implementation baseline)
### 1. No schema migration in v1
- Use existing columns plus JSON metadata/flags.
- Persist the reporting-only denial marker in `iset_case.case_context_json`.
- Persist synthetic-record provenance in:
  - `iset_case_action_plan.metadata_json`
  - `iset_case_intervention.metadata_json`
- Reuse existing `esdc_participant_submission` readiness/submission state rather than introducing a second reporting queue table.

### 2. Reporting-only case model
- Do **not** create a second case. Use the existing case already attached to the application.
- After denial seeding completes, move the case to `closed` and set `closed_at`.
- Add persistent case-context flags so the record can be hidden from normal casework surfaces while remaining accessible to:
  - direct Application Workspace route
  - ESDC participant/validation/reporting views
- Planned case-context flags:
  - `reportingOnlyDeniedIneligible: true`
  - `excludeFromCaseworkQueues: true`
  - `reportingCorrectionAllowed: true`
  - `reportingSeedSource: 'eligibility_not_met'`
  - `reportingSeededAt`

### 3. Synthetic action plan/intervention defaults
These are the planning defaults unless explicitly overridden during implementation:

- Action plan:
  - `status = 'closed'`
  - `effective_date = denial communication date`
  - `result_date = denial communication date`
  - `result_code = '1'` (`Unemployed but available for work`)
- Intervention:
  - `intervention_code = 1` (`Career research and exploration`)
  - `status = 'completed'`
  - `start_date = denial communication date`
  - `end_date = denial communication date`
  - `duration_days = 0`
  - `outcome_code = 1` (`Complete`)

Rationale:
- This keeps the synthetic record ILMP-closeable on day one.
- Result code `1` avoids the extra NOC and future-education requirements that result codes `2` and `4` impose.
- A completed same-day intervention plus a closed same-day action plan is structurally compatible with the existing close-out validation path.

### 4. Funding/agreement behavior
- Derive funding stream from the same EI/CRF logic already used in the approval auto-plan path.
- Derive agreement number from funding stream using the existing helper.
- Treat unresolved/placeholder agreement state as a blocking reporting condition for this flow.

Reason:
- Current placeholder agreement fallback (`999999999`) is structurally valid enough to pass the existing length check.
- That is too weak for denied-ineligible reporting, where the requirement is explicit that the action plan must be tied to a real EI or CRF agreement context.

### 5. Downstream correction model
- Application Workspace remains the only correction surface.
- Application edits for flagged denied-ineligible records must trigger downstream sync and revalidation automatically.
- Current application-edit endpoints only persist `iset_application.payload_json`; that is insufficient for this requirement because stale `case_context_json` can override newer application answers during ILMP extraction.

Therefore implementation will add a dedicated sync path that updates:
- `client`
- `iset_case.case_context_json`
- synthetic action plan ILMP fields
- synthetic intervention metadata when needed
- `esdc_participant_submission` readiness state

### 6. ESDC batch behavior change
- Batch prepare/submit must operate on `ready` participants only.
- Blocked or `needs_review` participants remain visible in exception/validation surfaces but are excluded from batch generation by default.
- This is required because current batch endpoints still include blocked rows and abort the full batch when any blocker exists.

## Planned technical design
### Backend workstream A: denial trigger + seeding
- Add a new transactional helper, working name:
  - `ensureDeniedIneligibleReportingSeed(connection, { caseId, applicationId, actorId, actorName, denialDate })`
- Trigger it inside `PUT /api/cases/:id` when all are true:
  - application status is transitioning to `rejected`
  - current NWAC denial reason is `eligibility_not_met`
  - the case is not already seeded for denied-ineligible reporting
- Make the helper idempotent by detecting an existing synthetic plan/intervention via metadata source keys.

### Backend workstream B: client sync refactor
- Split the current approval-specific client helper into reusable pieces:
  - profile extraction / matching
  - case linking
  - mutable client-data update
- The current helper is adequate for initial link/create but not for later corrections because it does not fully sync edited client data back onto an existing client row.
- New reusable helper target:
  - `syncCaseClientFromApplication(...)`

### Backend workstream C: reporting-only case flags
- Write the reporting-only flags into `iset_case.case_context_json`.
- Expose them in `GET /api/cases/:id` so Application Workspace can:
  - show reporting status
  - allow post-denial editing for these cases only
- Keep `GET /api/cases/:id/workspace` unchanged initially unless needed for shared components.

### Backend workstream D: Application Workspace save hook
- Extend the application-edit save path (`POST /api/applications/:id/versions`, and the lighter `PATCH /api/applications/:id/answers` for parity) so that after a successful save:
  - if the linked case is flagged `reportingOnlyDeniedIneligible`
  - run the sync helper
  - re-run ILMP validation
  - refresh readiness/blocking state automatically

## Implementation summary
- Added a new denied-ineligible reporting sync path in `isetadminserver.js`:
  - `syncDeniedIneligibleReportingArtifacts(...)`
  - `syncDeniedIneligibleReportingForApplicationIfNeeded(...)`
  - `syncCaseClientFromApplication(...)`
- Triggered the reporting sync automatically when:
  - a case is moved to application status `rejected` and the stored denial reason is `eligibility_not_met`
  - Application Workspace saves or restores answers for a flagged denied-ineligible record
- Implemented the reporting-only model by:
  - closing the case
  - writing reporting flags into `case_context_json`
  - ensuring/updating the linked client
  - creating/updating a closed synthetic action plan
  - creating/updating one completed `Career Research and Exploration` intervention
  - validating and refreshing the linked `esdc_participant_submission`
- Updated Application Workspace UI so denied-ineligible reporting files:
  - remain editable after rejection
  - show ILMP/ESDC readiness and blocking feedback in Application Overview
  - explain the reporting-only edit behavior in the Application Form widget
- Updated ESDC batch generation so only `ready` participants are included and non-ready participants are returned as excluded exceptions instead of failing the whole batch.

### Backend workstream E: casework list exclusion
- Update `/api/cases` default behavior to exclude `reportingOnlyDeniedIneligible` records unless an explicit opt-in parameter is supplied.
- This prevents synthetic denied reporting cases from appearing in ordinary case portfolio lists.
- Keeping the case itself `closed` also keeps it out of active-case metrics, but the explicit exclusion flag is still needed because closed cases can still appear in case listings today.

### Backend workstream F: ESDC summary on case detail
- Add latest participant-submission summary to `GET /api/cases/:id`, for example:
  - `esdc_submission_id`
  - `esdc_readiness_status`
  - `esdc_submission_status`
  - `esdc_blocking_issues`
  - `esdc_warnings`
  - `esdc_last_validated_at`
- This lets Application Workspace surface the reporting state without requiring a second discovery request.

### Backend workstream G: batch operation hardening
- Update:
  - `POST /api/esdc/participants/batch-prepare`
  - `POST /api/esdc/participants/batch-submit`
- New default behavior:
  - include only participants whose grouped readiness is `ready`
  - skip blocked and `needs_review` records automatically
  - do not fail the whole batch because blocked denied-ineligible records exist elsewhere in the queue
- `validate-all` can continue revalidating all pending/rejected rows, including blocked ones, because that supports automatic unblocking after corrections.

## Planned frontend changes
### Application Workspace
- `IsetApplicationFormWidget`
  - allow editing after application rejection **only** when the case is flagged `reportingOnlyDeniedIneligible`
  - keep the existing lock/version workflow
- `ApplicationOverviewWidget`
  - show ILMP reporting state for flagged denied-ineligible cases
  - display readiness badge + blocking count/message
  - link to the ESDC participant workspace when a submission row exists
  - explain that the record is excluded from normal casework and is waiting on reporting-data fixes

### ESDC dashboard
- `EsdcBatchSubmissionWidget`
  - gate batch generation on ready-count rather than generic queue-count
  - message blocked/needs-review records as excluded exceptions, not batch blockers

## Implementation phases
### Phase 1: backend seeding and reporting-only flags
- Add denied trigger detection in `PUT /api/cases/:id`.
- Implement idempotent denied-ineligible seed helper.
- Create synthetic closed plan/intervention + submission record.
- Mark case `closed` and set reporting-only case flags.

### Phase 2: downstream sync on Application Workspace edits
- Refactor client sync helper.
- Add reporting-only sync/revalidate hook to application-save endpoints.
- Refresh case detail response with ESDC readiness summary.

### Phase 3: UI alignment
- Allow post-denial Application Workspace editing for flagged records.
- Surface ILMP readiness/blocking state in Application Workspace.
- Add link-through to participant workspace.

### Phase 4: batch hardening
- Update batch prepare/submit to skip blocked and `needs_review` participants automatically.
- Update batch widget counts/copy so operators see what is batch-ready vs exception-only.

### Phase 5: docs and regression coverage
- Update status-lifecycle and case/application workspace docs.
- Update ESDC reporting docs/help panels where behavior changed.
- Add regression coverage for:
  - eligibility denial seeding
  - idempotent repeat denial path
  - blocked-at-creation behavior
  - automatic unblocking after Application Workspace corrections
  - batch submit with blocked denied-ineligible records present elsewhere in queue

## Test plan
- Deny an application with `eligibility_not_met` and confirm:
  - application becomes `rejected`
  - client exists / links correctly
  - exactly one synthetic closed action plan exists
  - exactly one synthetic completed intervention exists with code `1`
  - participant submission row exists and validates to `blocked` when required data is missing
- Correct missing data in Application Workspace and confirm:
  - save succeeds despite rejected application state
  - client/case-context/action-plan data resyncs
  - participant submission revalidates automatically
  - readiness moves from `blocked` / `needs_review` to `ready` when sufficient
- Confirm casework isolation:
  - record is absent from normal `/api/cases` portfolio results by default
  - record is still visible in ESDC participant/validation surfaces
- Confirm batch safety:
  - blocked denied-ineligible rows do not abort batch prepare/submit
  - ready participants still batch successfully

## Ready-to-commence summary
Implementation is ready to start with the following planning assumptions:
- intervention code `1`
- action plan result code `1`
- intervention outcome code `1`
- case marked `closed` plus explicit reporting-only exclusion flags
- no schema migration in v1

If any of those assumptions change later, they should be isolated as constants/helper behavior rather than requiring a structural redesign.

## Risks
- Reusing approval-oriented helpers without separating business intent could pollute denied records with service-delivery assumptions.
- If queue filtering is incomplete, denied-ineligible synthetic cases may leak into active casework lists.
- If sync rules are partial, Application Workspace edits may fix one source of truth but leave client/action-plan/intervention/reporting data stale.
- Hard-coding the wrong intervention code/result code/outcome code would create formally invalid ILMP payloads.

## Progress log
- 2026-03-17: Interview completed. Locked business behavior for eligibility-only denial trigger, blocked-by-default reporting posture, automatic unblocking on valid data, Application Workspace as the correction surface, and exclusion from normal casework queues.
- 2026-03-17: Confirmed in code that current denial flow stops at application rejection, while automatic client/plan/intervention/ESDC seeding exists only for approval-oriented paths.
- 2026-03-17: Planning completed. Locked implementation approach: no v1 schema migration, reporting-only closed-case model with explicit exclusion flags, post-denial Application Workspace edit override for flagged records, downstream sync/revalidate on application saves, and batch prepare/submit hardened to exclude blocked/needs-review rows automatically.
