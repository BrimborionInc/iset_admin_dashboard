# DEV Approved-Application To Case Regression Checklist

Purpose: focused DEV regression script for the post-refactor workflow from application approval through case creation, intervention activation, and payment-packet preparation.

Audience: engineering and business testers validating DEV before promotion to TEST/UAT.

Last Updated: 2026-04-16

## Scope

Use this checklist instead of open-ended exploratory testing when validating the refactored DEV flow.

This checklist covers:

- application approval handoff into the case workspace
- auto-created action plan and interventions
- approved funding-line persistence from assessment into case/payment views
- intervention activation
- payment-packet preparation inputs
- participant-facing status presentation after approval/completion

## Current DEV Baseline

Reference DEV participant/case used during reconciliation:

- Applicant: `Jacqueline Elise Sillery`
- Reference: `ISET-20260416-0DC0EE`
- Case id: `1`

Current expected intervention picture in DEV:

- `Initial Intervention`
  - should exist
  - should not show approved funding lines, because the assessment proposal for intervention code `1` had an empty `costLines` array
- `Goals Program`
  - should exist
  - should show two approved funding lines:
    - `WageSubsidyEmployer` for `$2,000`
    - `Transportation` for `$50`

## Regression Script

### 1. Application completion handoff

1. Open `Manage ISET Applications`.
2. Open Jacqueline's application.
3. Confirm the application is in the post-approval/completion state already reached in DEV.

Expected:

- application remains linked to the same client and case
- no server error on load
- application overview status and timeline load without stale assignment/EI bugs

### 2. Case workspace creation results

1. Open Jacqueline's Case Workspace.
2. Confirm an action plan exists.
3. Confirm interventions exist under that plan.

Expected:

- one draft or active action plan exists from the approval handoff
- `Initial Intervention` exists
- `Goals Program` exists
- no missing-plan / missing-intervention gap after approval

### 3. Intervention status activation

1. In the Interventions widget, activate `Goals Program` if it is still planned.
2. Refresh the workspace after activation.

Expected:

- status changes from `Approved` / planned state to `In progress`
- the parent action plan activates if it was still draft
- no server error on activation

### 4. Intervention modal funding visibility

1. Open `View intervention` or edit/view modal for `Goals Program`.

Expected:

- `Approved funding lines` table is visible
- it shows the two approved lines from the assessment
- `Payment packet lines` table is separate
- if no packet exists yet, the payment-packet-lines section is empty without implying missing approved lines

1. Open `View intervention` for `Initial Intervention`.

Expected:

- `Approved funding lines` table is empty for that intervention
- this is expected, not a bug

### 5. Create payment packet modal

1. Open `Create payment packet`.
2. Select `Goals Program`.

Expected:

- approved ceiling is shown
- approved funding lines are shown
- remaining authorized funding is shown
- payment packet can be created against the intervention without losing the approved-line breakdown

### 6. Portal participant status presentation

1. Open Jacqueline's public portal dashboard.
2. Open the submission details page if applicable.

Expected:

- portal shows participant-safe status language
- portal does not collapse to an empty activities view just because the application is approved/completed
- portal does not expose internal admin workflow jargon

### 7. No silent data loss after refresh

1. Refresh the admin application page, case workspace, and portal dashboard.
2. Re-open the intervention modal and create-payment-packet modal.

Expected:

- action plan and interventions remain present
- approved funding lines still appear for `Goals Program`
- intervention activation state remains persisted

## Notes For TEST/UAT Promotion

Before promoting to TEST/UAT:

- run `scripts/reconcile-auto-assessment-intervention-cost-lines.js` in dry-run mode on the target data set
- backfill any approved auto-assessment interventions missing `metadata.costLines`
- confirm that any intervention with no approved funding lines is truly empty in `iset_case_assessment.proposed_interventions`, not missing data from migration
