# Checkboxes Component Pattern

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
Bilingual: legend.text, hint.text, each item text, each item hint. Translation widget excludes unrelated fields.

## Rendering
Macro: `govukCheckboxes`.
Normalization: Ensures `govuk-checkboxes` present in classes (base class re-added if missing); item hint strings coerced to `{ text: "..." }` objects; bilingual expansion handled elsewhere.

## Accessibility
- Use a clear legend summarizing all items.
- Hints should clarify selection criteria, not repeat the label.
- Avoid too many checkboxes (>12) — consider a multi-select autocomplete.
- Provide mutually exclusive option (e.g. "None of the above") only if logic requires; ensure exclusive behavior (future enhancement).

## Validation Guidance
- Option values must be unique.
- Server: produce an array of selected values; enforce min/max selection rules if any.
- Do not rely solely on disabled state; remove items not applicable.

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
- Exclusive (none) option auto-uncheck logic.
- Min/max selection client validation.
- Grouped checkbox sets collapse/expand.
 - Optional `idPrefix` support (currently omitted; GOV.UK macro accepts it to customise generated IDs when needed, but default `name`-based IDs are sufficient for our usage).
