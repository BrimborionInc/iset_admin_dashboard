# Conditional Visibility (Admin Dashboard)

## Overview
Admin authoring now supports defining AND-based conditional visibility rules for `file-upload` components. Rules are authored in the component panel (Conditions section) and serialized at publish time into the runtime workflow schema.

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
  - `>` numeric comparison (both sides numeric after coercion)
  - `<` numeric comparison

## Reference Resolution
`ref` can point to another component by any of: `storageKey`, `id`, `name`. Admin preview snapshot (`__workflowFields`) is used to populate the "When field" selector with persistable input components (display-only items filtered out). A fallback match is attempted across id/name/storageKey when evaluating.

## Serialization
During publish (normalization pipeline), `file-upload` components with draft conditions have those rules copied to `component.conditions` in the emitted workflow JSON. This allows the public portal runtime to apply the same logic without needing authoring metadata.

## Admin Preview Runtime
`WorkflowPreviewWidget.js`:
- `evaluateConditions(component, answers)` returns boolean.
- When hidden, file-upload answers are cleared to prevent stray persistence.
- Supports top-level `component.conditions` and legacy `props.conditions`.

## Editing UX Notes
- Validation panel auto-suppressed for `file-upload` (per standing directive addendum).
- Value entry in condition rows uses internal React state to remain editable without premature commit.

## Non-Goals
- OR logic (not required)
- Nested condition groups
- Cross-workflow referencing (not supported)

## Future (Not Implemented Yet)
- Visual badge in component list to indicate conditions present.
- JSON schema validation of condition objects server-side.
