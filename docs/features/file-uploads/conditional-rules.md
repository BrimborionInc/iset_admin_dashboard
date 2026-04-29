# File Upload Conditional Rules – Completion Plan

Task ID: t7
Category: Conditional Visibility
Status: Partially implemented; remaining grouped-logic proposal
Last reviewed: 2026-04-29 against `src/utils/intakeConditionalVisibility.js`, `src/widgets/WorkflowPreviewWidget.js`, `src/pages/modifyIntakeStep.js`, `isetadminserver.js`, and `../ISET-intake/src/pages/DynamicTest.js`.

## Current State
- Conditions still use `AND` semantics through `conditions.all`; multiple rule objects must all evaluate truthy for the conditional component to be shown.
- Supported operators are now `exists`, `notExists`, `emptyOrZero`, `equals`, `notEquals`, `contains`, `notContains`, `containsAny`, `notContainsAny`, `containsAll`, `>`, and `<`.
- Conditional visibility now applies beyond file uploads to supported target types including radio/radios, checkbox/checkboxes, input, textarea, character-count, warning-text, inset-text, and paragraph components.
- Admin authoring/preview uses the shared `src/utils/intakeConditionalVisibility.js` helper. The public portal currently carries equivalent inline logic in `../ISET-intake/src/pages/DynamicTest.js`.
- Hidden components lead to answer clearing to avoid stale data.

## Gaps / Pain Points
1. No `OR` / grouping results in verbose duplication of shared predicates across steps.
2. Absence of `NOT` or negation wrapping increases risk of logical inversion errors.
3. Missing `is null` (or `isNull`) operator: Distinction between field absent vs empty string vs explicit null not expressible.
4. Authoring schema lacks a concise way to express mixed precedence (e.g., `(A && B) || (C && !D)`).
5. Bilingual author messages not auto-generated for complex rule explanations (future improvement).
6. The portal evaluator should eventually be consolidated with the admin helper to reduce drift.

## Target Enhancements
- Introduce explicit logical combinators: `all`, `any`, `none` (maps to AND, OR, NOR) at a group level.
- Allow nested groups for precedence (recursive structure).
- Add unary `not` wrapper for single rule/group.
- Add operator: `isNull` (alias `is null`) and `isNotNull` for symmetry.
- Graceful backward compatibility: If legacy array of rules (flat), treat as `all`.

### Proposed Schema (Backward Compatible)
```jsonc
// Existing (flat):
"conditions": [ { "field": "hasChildren", "operator": "equals", "value": true } ]

// New grouped form:
"conditions": {
  "all": [
    { "field": "householdSize", "operator": ">", "value": 1 },
    {
      "any": [
        { "field": "hasSupportingDocs", "operator": "equals", "value": true },
        { "field": "eligibleException", "operator": "equals", "value": true }
      ]
    },
    { "not": { "field": "isResubmission", "operator": "equals", "value": true } }
  ]
}
```
- Base rule object keys: `field`, `operator`, `value` (value optional for some unary operators like `exists`, `notExists`, `isNull`, `isNotNull`).
- Group keys recognized: `all`, `any`, `none`, `not`.

## Evaluation Algorithm Sketch (Pseudocode)
```js
function evalCond(node, answers) {
  if (!node) return true;
  if (Array.isArray(node)) { // legacy flat list = AND
    return node.every(r => evalCond(r, answers));
  }
  if (node.all) return node.all.every(n => evalCond(n, answers));
  if (node.any) return node.any.some(n => evalCond(n, answers));
  if (node.none) return node.none.every(n => !evalCond(n, answers));
  if (node.not) return !evalCond(node.not, answers);
  // leaf rule
  const { field, operator, value } = node;
  const actual = answers[field];
  switch (operator) {
    case 'exists': return actual !== undefined && actual !== null;
    case 'notExists': return actual === undefined || actual === null;
    case 'isNull': return actual === null;
    case 'isNotNull': return actual !== null;
    case 'equals': return actual === value;
    case 'notEquals': return actual !== value;
    case '>': return typeof actual === 'number' && actual > value;
    case '<': return typeof actual === 'number' && actual < value;
    default: return false; // fail closed
  }
}
```

## Backward Compatibility Plan
1. Detect legacy array: treat as `{ all: [...] }` logically without mutation.
2. Authoring UI: Continue writing arrays until updated UI supports nested builder.
3. Migration script (optional): Provide CLI to wrap existing arrays into `{ "all": [...] }` for clarity.

## Implementation Steps
1. Introduce grouped-condition evaluation while preserving the existing `conditions.all` shape.
2. Consolidate public portal and admin evaluation into a shared or deliberately mirrored utility.
3. Add `isNull` / `isNotNull` only if product/runtime requirements need explicit null semantics.
4. Update clearing logic to use the grouped evaluator unchanged.
5. Write unit tests for nested combinations and backward compatibility.
6. Update documentation: this file, the project map, and portal conditional-visibility docs.
7. Optional: add a dev warning if a legacy AND array's length is greater than 1 and grouped logic would be clearer.

## Testing Matrix
| Scenario | Input | Expected |
|----------|-------|----------|
| Legacy AND flat | `[A,B]` | A && B |
| any (OR) | `{ any:[A,B] }` | A || B |
| none (NOR) | `{ none:[A,B] }` | !A && !B |
| not wrapper | `{ not: A }` | !A |
| Nested mix | `{ all:[ A, { any:[B,C] } ] }` | A && (B || C) |
| isNull | field=null, op=isNull | true |
| isNull w/ undefined | field undefined, op=isNull | false |
| isNotNull w/ value | value present | true |
| Unknown operator | op=foo | false (fail closed) |

## Risks & Mitigations
- Infinite recursion from malformed schema: Limit depth or detect cycles (IDs not used now—low risk).
- Author confusion: Provide docs + examples (this file + inline comments in builder when implemented).
- Performance: Negligible—tree depth expected shallow (<5).

## Acceptance Criteria
- Supports `all`, `any`, `none`, `not` nesting.
- Adds `isNull` / `isNotNull` operators.
- Legacy arrays still function as AND without change.
- Hidden file upload detection (all hidden) still correct with new evaluator.
- Tests cover at least matrix above.

## Future Enhancements (Out of Scope Now)
- JsonLogic conversion compatibility layer.
- Author UI rule builder with drag-and-drop grouping.
- Expression serialization preview (human-readable string).

---
Initial draft created before the partial implementation. Current-state facts corrected during the 2026-04-29 documentation cleanup.
