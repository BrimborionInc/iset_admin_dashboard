# Step 19 Checkbox Conditionality Follow-up

Status: implemented
Last Updated: 2026-04-14

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
- Verified on 2026-04-14: rebuilding DEV workflow `21` from the authoring tables through `buildWorkflowSchema` reproduces the current published runtime payload in `iset_runtime_config(scope='publish', k='workflow.schema.intake')` apart from the normal timestamp/checksum refresh, so no separate step/workflow-library backfill is currently required to match the published intake.

## Current scope boundary

- Implemented path:
  - public portal runtime in `../ISET-intake/src/pages/DynamicTest.js`
  - DEV workflow authoring rows in `step_component`
  - admin Workflow Preview evaluator and visible-step skipping
  - intake-step editor operator picker / validation/help text for the checkbox-array operators
  - admin Manual Intake evaluator and visible-step skipping for renderable manual-intake content
- Manual-path caveat:
  - portal-only upload and signature steps are still intentionally skipped in Manual Intake

This means the live applicant portal and the admin-side authoring, preview, and Manual Intake paths can now honor these Step 19 checkbox-array rules with the same whole-step skip behavior, subject to Manual Intake's existing omission of portal-only upload/signature steps.

## Why this note exists

This was added to keep Step 19 as a single checkbox array while still allowing later intake steps to react to support selections such as `living`, `transportation`, `childcare`, and `other`.

Without runtime checkbox-array operators, the earlier fallback would have been refactoring Step 19 into separate scalar yes/no fields.

## Follow-up work

1. Keep authoring docs, especially `docs/features/file-uploads/conditional-visibility-authoring.md`, current with the checkbox-array operator contract and whole-step-skip behavior.
2. If Manual Intake ever adds upload or signature capture, verify those portal-only steps before assuming full end-to-end parity for every step type.

## Editing caution

Manual Intake now follows this contract for renderable manual-intake steps. If a future thread edits portal-only upload/signature steps through DB rows or raw JSON, verify Manual Intake behavior for those step types separately before treating it as a parity check for the portal path.
