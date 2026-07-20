# Regional Manager Cross-Region Reassignment Release Contract

Purpose: Control the release that allows Regional Managers to choose any active case-assignment target while preserving their existing access to source cases.
Last Updated: 2026-07-20
Status: Deployed and verified in TEST and PROD on 2026-07-20; feedback #160 resolved

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
- Feedback closeout rule: PROD report #160 was to remain `planned` until deployment and targeted live recheck; it moved to `resolved` only after both passed. Reports #161 and #162 are closed support/by-design items and were not part of this code release.

## Deployment Result

- Final release: `20260719-rm-cross-region-reassignment-r3`; admin `c33c376`, portal `4b8135d`, shared `e8dc303`.
- TEST evidence: `0ba9213e745ed2acd815703a3209f1b449a6b27e5c67dc2e55b06fc5d1eee471` (`GO`).
- PROD ASG refresh: `1b9eaeb3-7900-4f37-b29a-f6d2df43bd19`; replacement instance `i-025f0c9390a64f53a`.
- Normal-routing readiness passed for the admin console and both applicant portal hostnames. Deployed provenance and targeted policy execution passed; maintenance state returned to normal with zero announcement rows.
- Feedback #160 moved from `planned` to `resolved`. Reports #161 and #162 remain closed support/by-design items.
