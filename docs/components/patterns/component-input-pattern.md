# Input (Text) Component Pattern

## Purpose
Single-line textual data entry supporting common HTML input `type` values (text, email, tel, number, password, url, search, date, month, time, week) with bilingual label, hint, optional prefix/suffix, and validation affordances.

## Authoring Summary
- Data Key (name): Required, snake/kebab allowed; must be unique within the Step. Used as form field name & default id.
- Label Text: Required. Default label classes set to `govuk-label--m` (medium). Change or hide (visually hidden) via Label Classes.
- Hint Text: Optional explanatory text below the label.
- Prefix / Suffix Text: Optional small adornments (currency symbol, units). Each is translatable; omitted if empty.
- Input Type vs Input Mode:
  - Type affects native browser validation / semantics (email, number, date) and virtual keyboard hints on mobile.
  - Input Mode is an advisory override for on-screen keyboards (e.g. `numeric`, `decimal`, `tel`, `email`) without changing semantics.
- Autocomplete: Provide a WHATWG autocomplete token when applicable (e.g. `given-name`, `email`, `postal-code`). Leave blank to disable.
- Pattern (regex): Optional client regex (HTML `pattern`). Use when native type constraints are insufficient. Provide a user-friendly error server-side.
- Spellcheck: Enabled by default for types where browsers honor it (`text`, `search`, etc.). Set to False for structured inputs like codes.
- Default Value: Pre-populates the field (avoid for sensitive data).
- CSS Classes: Always includes `govuk-input`; width modifiers append (e.g. `govuk-input--width-10`).
- Form Group Classes: Add `govuk-form-group--error` only during error rendering (normally set automatically by validation, not manually).

## Translations
Fields made bilingual: label.text, hint.text, prefix.text, suffix.text. Editing translations (manual or AI assisted) marks the Step dirty to enable saving.

## Rendering Details
Nunjucks macro: `govukInput`.
Normalization ensures `govuk-input` base class present. Prefix/suffix objects excluded when empty (trimmed). `id` defaults to `name` when blank.

## Accessibility
- Ensure visible label or a visually hidden label describing purpose.
- Prefix/suffix should not duplicate label meaning; keep them short.
- Use appropriate autocomplete tokens to improve assistive technology & autofill experience.
- Validate server-side regardless of client pattern/type.

## Validation Guidance
Client: Pattern (if provided) + type constraints. Server: Replicate & add business rules. Always trim leading/trailing whitespace server-side unless significant.

## Example JSON Snippet
```
{
  "type": "input",
  "props": {
    "name": "applicant_email",
    "label": { "text": { "en": "Email address", "fr": "Adresse courriel" }, "classes": "govuk-label--m" },
    "hint": { "text": { "en": "We will send a confirmation.", "fr": "Nous enverrons une confirmation." } },
    "type": "email",
    "autocomplete": "email",
    "spellcheck": false,
    "prefix": { "text": { "en": "", "fr": "" } },
    "suffix": { "text": { "en": "", "fr": "" } }
  }
}
```

## Future Enhancements
- Inline character count variant (or separate component).
- Server-enforced Data Key pattern validation.
- Common masks (e.g. postal code) helper library.
