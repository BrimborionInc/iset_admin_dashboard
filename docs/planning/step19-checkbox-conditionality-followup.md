# Step 19 Checkbox Conditionality Follow-up

Status: partial implementation
Last Updated: 2026-04-01

## What is implemented now

- The public intake portal runtime now supports checkbox-array conditional operators:
  - `contains`
  - `notContains`
  - `containsAny`
  - `notContainsAny`
  - `containsAll`
- The public intake portal now also auto-skips steps whose authored components are all hidden by conditions, and the visible step/progress count is renumbered to match the applicant-visible path.
- DEV authoring for workflow `21` now uses those operators to drive later intake questions and uploads from Step 19 `requested-supports` without replacing that step with separate yes/no fields.
- DEV workflow `21` Step 21 and Step 22 no longer rely on placeholder fallback notices; they now disappear entirely in the public portal when their support-driven conditions are not met.
- DEV workflow `21` now also branches after Step `93` (`Employment Goals and Barriers`) based on `dependent-children`, sending `0` / `No` applicants to a cloned Step 19 variant that omits the `Childcare` support option while leaving the default path on the full Step 19.

## Current scope boundary

- Implemented path:
  - public portal runtime in `../ISET-intake/src/pages/DynamicTest.js`
  - DEV workflow authoring rows in `step_component`
- Not yet implemented:
  - admin Manual Intake evaluator
  - Workflow Preview evaluator
  - intake-step editor operator picker / help text
  - admin/manual step-skipping parity for steps that become empty after conditional visibility is applied

This means the live applicant portal can honor these rules, including hiding whole irrelevant steps, but admin-side preview/manual-intake behavior can still diverge until parity work is done.

## Why this note exists

This was added to keep Step 19 as a single checkbox array while still allowing later intake steps to react to support selections such as `living`, `transportation`, `childcare`, and `other`.

Without runtime checkbox-array operators, the earlier fallback would have been refactoring Step 19 into separate scalar yes/no fields.

## Follow-up work still required

1. Extend Manual Intake condition evaluation in `src/pages/intake/ManualApplicationIntakePage.jsx` to understand the same checkbox-array operators.
2. Extend Manual Intake navigation/progress logic so steps with no visible components are skipped the same way as the public portal.
3. Extend admin preview condition evaluation in `src/widgets/WorkflowPreviewWidget.js` to understand the same operators and surface the same whole-step hiding behavior.
4. Extend the intake-step editor condition builder in `src/pages/modifyIntakeStep.js` so authors can create/edit these operators in the UI instead of hand-authoring them in DB JSON.
5. Update authoring docs, especially `docs/features/file-uploads/conditional-visibility-authoring.md`, with the checkbox-array operator contract, whole-step-skip behavior, and examples.
6. Add parity tests for Manual Intake and Workflow Preview after the evaluator work lands.

## Editing caution

Until the admin editor catches up, treat these operators and the resulting whole-step skip behavior as public-portal runtime-only authoring features.

If a future thread edits the affected conditions through DB rows or raw JSON, verify that the admin editor does not strip or overwrite unknown operators before using the UI to resave those components.
