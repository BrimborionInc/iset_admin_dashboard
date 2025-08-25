# Select Component Pattern

## Purpose
Provide a compact control for choosing exactly one option from a list where space is limited or more than ~7 options would make radios unwieldy.

## Authoring Summary
- Data Key: Required unique within Step. Forms POST under this name. ID defaults to Data Key.
- Label Text: Required; default medium size class `govuk-label--m`.
- Hint Text: Optional supporting text.
- Items: Ordered list.
  - Include a leading placeholder option with empty value (e.g. `-- Select --`) if a null choice is needed.
  - Each item has: value (submitted) and text (display). Per-option hints are NOT supported for native selects; use radios/checkboxes if you need a hint per choice.
- Disabled: Entire control disabled (avoid for mandatory fields; prefer conditional display).
- Classes: Width utility helpers; keep minimal.
- Form Group Classes: Error state should normally be applied by validation rather than manually.

## Translations
Bilingual fields: label.text, hint.text, each item text. (Item hints not supported.)
AI/manual edits trigger dirty state enabling save.

## Rendering
Nunjucks macro: `govukSelect`.
Normalization (server):
- Ensure each item.text / item.hint coerced into `{ en, fr }` objects.
- Leading empty value retained to allow blank selection; server validation must enforce required when necessary.

## Accessibility
- Provide meaningful label; avoid only using placeholder as a label.
- If a blank option exists, text must clarify action (e.g. `-- Select province --`).
- Keep list length reasonable; for >25 items consider autocomplete component (future enhancement).

## Validation Guidance
- Required logic: Reject empty value if mandatory (server-side + client hint in future).
- Prevent duplicate item values.
- Keep values machine-friendly (snake_case or hyphen, lowercase).

## Example JSON
```
{
  "type": "select",
  "props": {
    "name": "province",
    "label": { "text": { "en": "Province", "fr": "Province" }, "classes": "govuk-label--m" },
    "hint": { "text": { "en": "Select your province.", "fr": "Sélectionnez votre province." } },
    "items": [
      { "value": "", "text": { "en": "-- Select --", "fr": "-- Sélectionnez --" } },
      { "value": "ab", "text": { "en": "Alberta", "fr": "Alberta" } },
      { "value": "bc", "text": { "en": "British Columbia", "fr": "Colombie-Britannique" } }
    ]
  }
}
```

## Future Enhancements
- Grouped options (optgroup) support.
- Async dynamic options / data source binding.
- Client-side required + duplicate value detection.
- Enhanced accessible autocomplete variant.
