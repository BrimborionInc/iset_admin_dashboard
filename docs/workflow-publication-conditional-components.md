# Workflow Publication & Conditional Component Embedding

## Summary
This document captures the investigation, root cause, and resolution for missing conditional components (radio / checkbox option reveals) in published workflow schemas. The admin preview correctly showed conditional children after recent normalization changes, but the published schema (used by the public intake portal) did not include them until the publish pipeline was refactored.

## Problem Statement
Authoring introduced `conditionalChildId` on choice component options (radios / checkboxes) to link an option to a sibling component that should render *conditionally* when the option is selected. The runtime preview (admin side) was updated to:
- Copy the target child component under the triggering option as `children: [ ... ]`.
- Remove the embedded child from the top-level component list.

However, the publication endpoint produced a separate, *flat* list of components without embedding. As a result, the public portal received a schema that could not drive conditional reveals.

## Symptoms
1. Admin Preview (Runtime Schema widget) – options show nested `children` arrays (correct).
2. Runtime payload (`iset_runtime_config` -> `workflow.schema.intake`) – conditional targets remained as independent top-level components; options lacked `children`.
3. Conditional UI did not appear in the public portal context.

## Root Cause
Two divergent code paths:
- Preview / validation: `buildWorkflowSchema` in `src/workflows/normalizeWorkflow.js` (updated to perform conditional embedding).
- Publish: A large, duplicated transformation inside `isetadminserver.js` that predated conditional logic and did **not** embed children.

The publish path never reused the normalized output; thus enhancements to normalization did not propagate.

## Resolution Summary
1. Enhanced `buildWorkflowSchema` to:
   - Propagate `conditionalChildId` from `props.items[].conditionalChildId` into option objects.
   - Second pass: embed referenced components under `option.children[]` and prune them from the step’s top‑level `components` array.
2. Refactored publish endpoint (`/api/workflows/:id/publish`) to delegate entirely to `buildWorkflowSchema({ auditTemplates: true })`.
3. Upserted the normalized payload into `iset_runtime_config` (`scope='publish'`, `k='workflow.schema.intake'`) while still producing the legacy file output for backward compatibility.
4. Updated `WorkflowPropertiesWidget` to use authenticated `apiFetch` instead of raw axios for publish/save operations (fixing the “Missing bearer token” error when clicking Publish).

## Data Flow (Before vs After)
| Stage | Before (Publish) | After (Publish) |
|-------|------------------|-----------------|
| Normalizer used | Custom in endpoint | `buildWorkflowSchema` |
| Conditional linkage | Dropped (`conditionalChildId` ignored) | Embedded `option.children[]` |
| Top-level components | Included conditional targets | Excludes embedded children |
| Auth for publish call | axios (no token) | `apiFetch` (Bearer + Dev bypass) |

## Current Schema Shape (Relevant Portion)
```
{
  "type": "radio",
  "options": [
    { "label": "Option 1", "value": "1", "children": [ { "id": "example-input", ... } ] },
    { "label": "Option 2", "value": "2", "children": [ { "id": "example-input-2", ... } ] },
    { "label": "Option 3", "value": "3", "children": [ { "id": "example-textarea", ... } ] }
  ]
}
```

Checkbox example (only Option A reveals a child):
```
{
  "type": "checkboxes",
  "options": [
    { "label": "Option A", "value": "a", "children": [ { "id": "example-select", ... } ] },
    { "label": "Option B", "value": "b" },
    { "label": "Option C", "value": "c" }
  ]
}
```

## Key Code Locations
- Normalizer (embedding logic): `src/workflows/normalizeWorkflow.js`
  - Tracks `authoringIdIndex` and `consumedChildIndices`.
  - Second pass attaches children and prunes consumed components.
- Publish endpoint: `isetadminserver.js` (`/api/workflows/:id/publish`) now calling `buildWorkflowSchema`.
- Authenticated fetch helper: `src/auth/apiClient.js` (`apiFetch`).
- Updated widget: `src/widgets/WorkflowPropertiesWidget.js`.

## Verification Steps
1. In admin dashboard, open Manage Workflows → select workflow with conditional components.
2. Check Runtime Schema widget: options contain `children` arrays; no duplicate conditional components at top-level.
3. Click Publish (should succeed without “Missing bearer token”).
4. Inspect the runtime payload (`SELECT v FROM iset_runtime_config WHERE scope='publish' AND k='workflow.schema.intake'` or call `/api/runtime/workflow-schema`):
   - Ensure the same nested structure appears.
   - Confirm conditional target components are *not* duplicated at top-level.
5. Run / reload public intake portal and verify conditional reveals expand/collapse correctly.

## Meta Counts Behavior
`meta.counts.components` counts only top-level components (embedded children excluded). This matches the normalized meta output. If a total including embedded children is desired later, adjust after embedding:
```
const total = steps.reduce((n, s) => n + s.components.length + sum(s.components.filter(c=>c.options).flatMap(c=>c.options).map(o=>o.children?o.children.length:0)), 0);
```

## Edge Cases & Limitations
| Case | Current Handling |
|------|------------------|
| Missing `conditionalChildId` target | Silently ignored (no child embedded). |
| Same child referenced by multiple options | First wins; others skipped (no warning). |
| Deeply nested conditionals | Not supported (only one embedding layer). |
| Validation of hidden children | Child validation present; portal must not surface errors until revealed. |

## Potential Enhancements
- Emit warnings list in meta for unresolved or duplicate `conditionalChildId` references.
- Track conditional stats (e.g., `meta.conditional = { embedded: N, skipped: M }`).
- Support multi-level / chained conditionals (requires recursion + renderer adjustments).
- Option to include embedded children in component count for analytics.
- Add unit tests around normalization of conditionals.

## Rollback Plan
To revert to pre-embedding publish behavior:
1. Restore previous publish endpoint block from git history (before refactor to `buildWorkflowSchema`).
2. Remove embedding second pass from `normalizeWorkflow.js`.
3. Republish a workflow; conditional reveals will again flatten (not recommended).

## Quick Troubleshooting
| Symptom | Likely Cause | Action |
|---------|-------------|--------|
| Publish fails 401 / Missing bearer token | Widget still using axios or expired session | Confirm `WorkflowPropertiesWidget` uses `apiFetch`; refresh login. |
| Conditional child still appears top-level after publish | Old publish code still deployed | Redeploy server; ensure refactored endpoint active. |
| Conditional reveal not expanding in portal | GOV.UK JS not re-init or schema not nested | Check schema JSON for `children`; ensure portal reloaded and `data-module="govuk-radios" / govuk-checkboxes` present. |

## Changelog (Relevant Commits / Changes)
- Added conditional embedding normalization pass.
- Refactored publish endpoint to reuse normalization.
- Migrated publish & save actions to authenticated `apiFetch`.

## References
- GOV.UK Design System conditional reveal pattern.
- Internal files: `normalizeWorkflow.js`, `isetadminserver.js`, `apiClient.js`, `WorkflowPropertiesWidget.js`.

---
Maintained as of: 2025-08-29
Owner (implicit): Platform / Workflow subsystem maintainers.
