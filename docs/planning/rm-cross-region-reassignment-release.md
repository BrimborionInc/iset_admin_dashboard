# Regional Manager Cross-Region Reassignment Release Contract

Purpose: Control the release that allows Regional Managers to choose any active case-assignment target while preserving their existing access to source cases.
Last Updated: 2026-07-19
Status: DEV implementation complete; TEST qualification and deployment pending

## Scope

- In scope: manual assignment/reassignment from Manage ISET Applications and Application Overview; shared backend assignment authorization; conflict-driven reassignment, which uses the same target guard.
- Out of scope: source-case visibility, auto-assignment rules, application/case lifecycle transitions, assessment/review ownership, final-decision authority, notification configuration, runtime configuration, schema, and historical data repair.

## Role and State Contract

- System Administrator and NWAC Administrator retain their existing assignment authority.
- Regional Manager may assign or reassign a case they are already authorized to access to any active staff member returned by the assignable pool, regardless of the target's region.
- ISET Coordinator cannot assign or reassign cases.
- Archived-case and existing UI/action availability rules remain unchanged.
- Disabled Cognito users and inactive staff profiles must not appear as targets; assignment APIs must reject an inactive target ID posted directly.
- Regional Manager access to the source case remains governed by direct assignment and existing portfolio/owner-region case-access rules. This release must not make an otherwise inaccessible case assignable.

## Persistence, Queues, and Audit

- `iset_case.assigned_staff_profile_id` remains the assignment authority.
- Existing `case_assigned` / `case_reassigned` event payloads and notification routing remain unchanged.
- The new assignee receives the file through existing queue rules; the previous owner loses ownership through the same rules.
- No PDF, letter, signing request, document link, compatibility-field backfill, migration, or data repair is required.

## Release and Acceptance

- Release surfaces: admin application plus the coupled portal/shared candidate required by the release qualifier and assignment-notification runtime dependency.
- Runtime/data operations: none. Deploy with `--skip-data`; do not publish intake workflow/runtime configuration or refresh TEST data.
- Required local evidence: assignment-policy and case-access tests; admin/portal aggregates and lint; isolated builds; compiled admin journeys including the RM cross-region assignment selector and network-idle assertion; real DEV MySQL and all other mandatory qualification gates.
- Required TEST evidence: exact deployed provenance and rollback artifacts; normal routing/readiness; role/applicant/cross-app/strict-denial/cleanup gates; deployed admin source contains and executes the cross-region RM policy; assignable staff remains active-only.
- Rollback: redeploy the retained prior TEST admin/portal/shared artifacts. No database rollback is required.
- Feedback: PROD report #160 remains `planned` until deployment and targeted live recheck. Reports #161 and #162 are closed support/by-design items and are not part of this code release.
