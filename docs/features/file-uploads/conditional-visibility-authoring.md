# Conditional Visibility (Admin Dashboard)

## Overview
Admin authoring now supports defining AND-based conditional visibility rules for the same runtime-backed component targets honored by the public portal preview path. Rules are authored in the component panel (Conditions section), previewed in `Workflow Preview`, and serialized at publish time into the runtime workflow schema.

## Data Model
```
component.conditions = {
  all: [ { ref: <string>, op: <operator>, value?: <any> }, ... ]
}
```
- Evaluation: ALL rules must pass (logical AND) for the component to be visible.
- Supported ops:
  - `equals` (loose equality)
  - `notEquals`
  - `exists` (non-null, non-empty string)
  - `notExists`
  - `emptyOrZero`
  - `contains`
  - `notContains`
  - `containsAny`
  - `notContainsAny`
  - `containsAll`
  - `>` numeric comparison (both sides numeric after coercion)
  - `<` numeric comparison

## Supported target components
- `file-upload`
- `radio` / `radios`
- `checkbox` / `checkboxes`
- `input`
- `textarea`
- `character-count`
- `warning-text`
- `inset-text`
- `paragraph`

The editor intentionally does not expose conditions on component types the current runtime ignores.

## Reference Resolution
`ref` can point to another component by any of: `storageKey`, `id`, `name`. Earlier components in the current step are always available in the authoring picker. Optional workflow context (`conditionsWorkflowId`) can add fields from another workflow's steps, and the editor refreshes that field snapshot on reopen so large authoring-only snapshots do not have to stay embedded in the saved step JSON. A fallback match is attempted across id/name/storageKey when evaluating.

## Serialization
During publish (normalization pipeline), supported components with draft conditions have those rules copied to `component.conditions` in the emitted workflow JSON. This allows the public portal runtime to apply the same logic without needing authoring metadata.

Verified on 2026-04-14 for DEV workflow `21`: rebuilding from the authoring tables through `buildWorkflowSchema` reproduces the current published runtime payload in `iset_runtime_config(scope='publish', k='workflow.schema.intake')` apart from the normal timestamp/checksum refresh.

## Admin Preview Runtime
`WorkflowPreviewWidget.js`:
- Uses the shared admin conditional-visibility utility aligned to the public portal runtime operators.
- Applies conditional visibility across all currently supported target components, not only file uploads.
- Skips steps whose components all hide after visibility evaluation and renumbers the visible preview path accordingly.
- When a condition-hidden component already has a stored answer, its preview answer/errors/warnings are cleared to avoid stale state.

## Manual Intake Runtime
`src/pages/intake/ManualApplicationIntakePage.jsx`:
- Uses the same shared conditional-visibility evaluator and checkbox-array operators as the preview/editor path.
- Skips steps that have no remaining renderable manual-intake content after visibility rules are applied.
- Clears stored answers for condition-hidden manual-intake components so stale values are not submitted after a backtrack.
- Still intentionally skips portal-only upload and signature steps in the manual admin path.

## Editing UX Notes
- Value entry in condition rows uses internal React state to remain editable without premature commit.
- `containsAny`, `notContainsAny`, and `containsAll` expect comma-separated values in the editor UI.
- The step validator now flags unsupported operators, missing comparison values, missing refs, and conditions attached to unsupported component types before publish.

## Non-Goals
- OR logic (not required)
- Nested condition groups
- Cross-workflow referencing (not supported)

## Future (Not Implemented Yet)
- JSON schema validation of condition objects server-side.
