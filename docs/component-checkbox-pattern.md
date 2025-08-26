# Checkboxes Component Pattern

Status: Modernized (filesystem template + AJV schema + validation + dev sync)

## Purpose
Let users select zero, one, or multiple options from a small to moderate list where independent selection matters (not mutually exclusive like radios).

## Authoring Summary
- Data Key: Required; shared across all items. Server receives multiple values (array) when more than one is checked.
- Legend Text: Required question or prompt (fieldset legend). Can be page heading if this is the main question.
- Hint Text: Optional supporting help below legend. Default bilingual: "Select all that apply." / "Sélectionnez toutes les options applicables." (Adjust to context.)
- Items: Each has value (submitted), text (label), optional hint (subtext). Keep hint concise.
- Container Classes: Base always normalised to `govuk-checkboxes`; optional `--small` to reduce box size.
- Error State: Use validation to add `govuk-form-group--error` not manual editing (authoring toggle exists but prefer automation later).
- Disabled: Disables the whole set (rare; prefer conditional rendering instead).

## Translations
Bilingual fields: `fieldset.legend.text`, `hint.text`, each `items[].text`, each optional `items[].hint`.
Prefix/suffix are not applicable.

## Rendering
Macro: `govukCheckboxes` (see `export_njk_template` in `checkbox.template.json`).
Normalization: Server ensures `govuk-checkboxes` present in classes; item hint primitive strings converted to object form; bilingual expansion handled elsewhere.

## Accessibility
- Use a clear legend summarizing all items.
- Hints should clarify selection criteria, not repeat the label.
- Avoid too many checkboxes (>12) — consider a multi-select autocomplete.
- Provide mutually exclusive option (e.g. "None of the above") only if logic requires; ensure exclusive behavior (future enhancement).

## Validation Guidance (AJV Schema: `checkbox.schema.json`)
Required top-level: `name`, `fieldset.legend.text|isPageHeading|classes`, `items` (>=1). Hint text required to encourage authors to give clarifying context (policy aligned with radios).
Per item: `text`, `value` required; optional `hint`, `checked`, `disabled`.
Recommended additional logical constraints (not yet enforced in schema):
- Unique item `value`s
- Avoid empty strings for bilingual `text.en` / `text.fr` when known
- Hint length ≤ 300 chars (schema enforces)

## Dev Sync & Source of Truth
Filesystem template: `src/component-lib/checkbox.template.json`
Schema: `src/component-lib/schemas/checkbox.schema.json`
Dev resync endpoint: `POST /api/dev/sync/checkbox-template`
PUT validation: `/api/component-templates/:id` triggers AJV when `template_key` is `checkbox` / `checkboxes`.

## Example JSON
```
{
  "type": "checkbox",
  "props": {
    "name": "services",
    "fieldset": { "legend": { "text": { "en": "Services required", "fr": "Services requis" }, "isPageHeading": false, "classes": "govuk-fieldset__legend--m" } },
    "hint": { "text": { "en": "Select all that apply.", "fr": "Sélectionnez tout ce qui s'applique." } },
    "items": [
      { "value": "counselling", "text": { "en": "Counselling", "fr": "Counseling" } },
      { "value": "training", "text": { "en": "Training", "fr": "Formation" }, "hint": { "en": "Includes workshops", "fr": "Inclut des ateliers" } }
    ]
  }
}
```

## Future Enhancements
- Exclusive (none) option auto-uncheck logic
- Min/max selection client validation
- Grouped checkbox sets collapse/expand
- Optional `idPrefix` support (macro supports it; currently omitted as `name`-based IDs suffice)

---
Last updated: 2025-08-26
