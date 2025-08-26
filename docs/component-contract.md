# Component Contract (Draft)

This document defines the canonical shape for each supported component produced by normalization (`buildWorkflowSchema`) and consumed by the public portal renderer.

Status legend:
- required: must be present
- optional: may be omitted / undefined
- derived: set internally; authors do not edit directly

Common fields (all components):
- id (required) string unique within step
- type (required) string (registry key)
- storageKey (optional) string (present for input-bearing components)
- label (optional) { en, fr } bilingual
- hint (optional) { en, fr }
- required (optional) boolean (input components)
- class / labelClass / legendClass (optional) styling hints
- normalize (optional) string normalizer id

## radio
Fields:
- options (required) Array<{ value (required), label {en,fr} (required), hint {en,fr} (optional), id (optional) }>
- name (optional) explicit group name
- idPrefix (optional) applied to per-option ids

## checkboxes
Same as radio but value may be array. Key `options`.

## select
Fields:
- options (required) array same shape as radio

## input
Fields:
- inputType (optional) string (maps to HTML input type)
- prefix / suffix { text, classes? } (optional)
- autocomplete, pattern, spellcheck, disabled, inputMode (optional)

## textarea / character-count
Fields:
- maxLength, threshold, rows (optional)

## date-input
Fields:
- dateFields (optional) array of { name, classes? }

## file-upload
Fields:
- multiple (optional) boolean
- accept (optional) string
- documentType (optional) string

## summary-list
Fields:
- rows (required) [{ key, label {en,fr}, format (default 'text') }]
- hideEmpty (optional, default true)
- emptyFallback {en,fr} (optional)

## paragraph / inset-text / warning-text / details / accordion / panel / label
Content components with no storageKey.

---
Validation rules draft (see validator implementation):
1. type must be in SUPPORTED_COMPONENT_TYPES.
2. If storageKey present, must be kebab-case and unique across workflow.
3. radio/checkboxes/select must have non-empty options[]; each option has value.
4. summary-list rows[].key must reference earlier component storageKey.

(This is a draft – extend as components evolve.)
