# Radio Component Modernization Pattern

This document captures the canonical pattern applied to the modernized `radio` ("Radio Group") component. Future components should mirror this approach (adjusting only for control‑specific nuances) to ensure consistency across: source of truth, validation, editing UI, rendering, i18n, and drift management.

## Goals
- Single source of truth per component in version-controlled JSON.
- Declarative prop editing schema driving the Properties panel (no hand wiring per field).
- AJV JSON Schema validation of default/edited props before persistence.
- Server + DB sync so latest file definition updates in-place during pre‑release (no historical version churn yet).
- Seamless bilingual (EN/FR) handling for user-facing text and option text/hints.
- GOV.UK parity in exported Nunjucks template while allowing internal conveniences (string shorthand for option hint) that are normalized before render.

## Files Introduced / Touched
- `src/component-lib/radio.template.json` (authoritative definition)
- `src/component-lib/schemas/radio.schema.json` (validation of `default_props` and edited props)
- `isetadminserver.js` (AJV loader, validation in PUT, on‑startup sync + dev sync endpoint, render normalization)
- `src/pages/PropertiesPanel.js` (dynamic option list editing, per-component class options, removal of redundant required flag)
- `src/widgets/TranslationsWidget.js` (bilingual editing for legend/hint + per-option text & hint)

## Template JSON Structure (`radio.template.json`)
Key fields:
- `template_key`: "radio"
- `default_props`: Authoritative default props object.
  - `name`: Data Key (identifier capturing the user’s answer in submission JSON / exports)
  - `fieldset.legend.text`: question text (bilingual capable via object { en, fr })
  - `fieldset.legend.isPageHeading`: boolean (exposed as True/False) promoting legend to `<h1>` if true.
  - `hint.text`: helper text under legend.
  - `classes`: container classes (enforces base `govuk-radios`).
  - `formGroup.classes`: optional form group classes (error class etc.).
  - `disabled`: boolean; disables whole group when true.
  - `items`: array of options `{ text, value, hint? }` where `hint` may be a simple string in authoring but is normalized to object on render.
- `prop_schema`: drives Properties panel. Each entry:
  - `path` (dot path into props)
  - `type` (text/select/optionList/number/boolean…)
  - `label` (UI surface label)
  - `options` (select choices; booleans shown as True/False so label == value)
- `has_options`: true
- `option_schema`: `["text","value","hint"]` defines columns/order in option list editor.
- `export_njk_template`: Nunjucks macro invocation of `govukRadios` with minimal logic (adds base class if missing).

## Validation Layer
- `radio.schema.json` (AJV) validates `default_props` shape (fieldset, items, bilingual-ready fields) when template loads / updates.
- On PUT update of a component template with `template_key='radio'`, server validates incoming props using cached compiled schema; rejects invalid payloads early.

## Sync & Drift Handling
- On server startup: `syncRadioTemplateFromFile()` loads file, compares core fields (label, description, default_props, prop_schema, option_schema, export_njk_template) to latest active DB row for `template_key='radio'`. If drift detected, performs an in-place UPDATE (pre-release strategy: only the “latest” matters).
- Manual dev sync endpoint: `POST /api/dev/sync/radio-template` to force re-sync without restart.

## Rendering Normalization
Problem: GOV.UK macro expects option hint objects (`{ text: "..." }`), while author UI stores simple strings for brevity.
Solution: In `renderComponentHtml()` and `/api/render/component`, if component key is `radio`, map each option: `if typeof hint === 'string'` => wrap as `{ text: hint }` before calling Nunjucks.

## Editing UI (Properties Panel)
- Renders rows from `prop_schema` except the `optionList` which has specialized UI.
- Container classes field uses template-provided curated options; user can still enter custom via “Custom…” branch.
- Option list table dynamically builds columns from `option_schema`. Hint column uses a textarea for better visibility.
- Validation panel controls “required” (so a `required` prop was removed from template to avoid duplication).
- Boolean selects display True/False to match actual values.

## Bilingual (Translations Widget)
- Includes legend (`fieldset.legend.text`), hint (`hint.text`), option text (`items[i].text`), and option hint (`items[i].hint`).
- Each translatable leaf stored as object `{ en, fr }` when edited; existing plain strings auto-upgraded on first edit.
- Coverage metrics count each bilingual field to show translation completeness.

## Accessibility & Semantics
- `fieldset.legend.isPageHeading=true` promotes legend text to `<h1>` via GOV.UK macro (only one per page recommended). This is exposed explicitly as “Is Page Heading?” in UI.
- Ensures base `govuk-radios` class applied (adds if user omitted).

## Data Key Naming Guidance
- Use lowercase letters, digits, hyphens or underscores (regex: `^[a-z0-9_-]+$`).
- Must be unique per page; collisions overwrite or merge data unintentionally.
- Choose early; renaming later can orphan previously stored data.

## Boolean Label Convention
- All boolean selects use labels matching literal values: `True` / `False` (not Yes/No) to reduce ambiguity and improve consistency across components.

## Option Hint Handling
- Authoring: plain string allowed for quick entry.
- Preview/Render: normalized to object to satisfy macro expectations.
- Translation: hint strings become bilingual objects just like option text.

## Error Avoidance Patterns
- Avoid unsupported Nunjucks filters (e.g., removed earlier `map` usage); prefer explicit `{% for %}` loops or direct macro parameter passing.
- Keep export template minimal: logic belongs in normalization step, not inside template string.
- Avoid redundant fields (e.g., `required` prop) when a separate validation system controls behavior.

## Adding New Components (Blueprint Extract)
1. Create `<key>.template.json` with: metadata, `default_props`, `prop_schema`, `option_schema` (if needed), and minimal `export_njk_template`.
2. Add JSON Schema under `src/component-lib/schemas/<key>.schema.json`.
3. Extend server: load & validate schema, add sync function + (optional) manual dev sync endpoint, integrate validation into PUT.
4. Normalize any authoring-time shorthand just before rendering (like radio hint wrapping).
5. Update `PropertiesPanel` if component introduces new field types or option editing patterns.
6. Ensure `TranslationsWidget` includes all user-facing text/hints.
7. Manual parity test (optional): add audit route or reuse existing parity endpoint.

## Future Enhancements (Deferred)
- Generic sync for all component template files (reduce per-component boilerplate).
- Central boolean field label enforcement utility.
- Automated parity audit for each component on sync.
- CLI or script to batch re-sync all template files.

## Conditional Follow-ups (In Progress)
Alpha scaffold added allowing each `items[]` entry to optionally include a `conditional.questions` array of embedded component definitions. Current release:
- Schema updated to tolerate `conditional.questions` (array) but UI only shows a placeholder panel.
- Single depth only; nested follow-ups within a follow-up will be ignored/blocked.
- Rendering/export logic unchanged until implementation phase; existing radios unaffected.
Planned next steps: authoring UI for attaching components, runtime reveal script, validation gating (required only when parent option selected), bilingual text handling for embedded components, and documentation examples.

## Quick Checklist (Radio Done)
- [x] File source of truth
- [x] Schema validation (AJV)
- [x] Sync + dev endpoint
- [x] Export template parity
- [x] Option hint support + normalization
- [x] Bilingual text & hints
- [x] Boolean label convention (True/False)
- [x] Removed redundant required prop
- [x] Documentation (this file)

This pattern is now the reference implementation—subsequent components should converge on it unless a deliberate deviation is documented.
