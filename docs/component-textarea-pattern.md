# Textarea Component Pattern

## Summary
The textarea component provides a multi‑line free text input using the GOV.UK `govukTextarea` macro. It supports accessible labelling, optional hint text, spellcheck, autocomplete hints and a configurable number of visible rows.

## When To Use
Use for longer free‑form responses where a single input field is insufficient (descriptions, explanations, additional details). Prefer an ordinary single‑line input when expecting short structured values (names, titles, codes) or when you need validation tightly scoped to a simple format.

Do not use when:
- A strict maximum length with in‑context feedback is needed (use `character-count`).
- Rich text formatting is required (a richer editor would be needed).

## Key Props
| Prop | Description | Notes |
|------|-------------|-------|
| name | Submission data key (unique within a form) | Also used as fallback `id`. |
| label.text | Visible label text | Keep concise and action‑oriented. |
| label.classes | Size / visibility modifiers | Default `govuk-label--m`; may be `govuk-visually-hidden`. |
| hint.text | Supplemental guidance | Avoid duplicating label text. |
| rows | Initial number of text rows | UI only; does not limit input length. |
| autocomplete | HTML autocomplete token | Leave blank unless a recognised token applies. |
| spellcheck | Enables browser spellcheck | Default true; disable for codes / identifiers. |
| value | Initial default value | Typically blank unless editing existing data. |
| classes | Extra CSS classes for the `<textarea>` | Base macro applies `govuk-textarea` automatically in export template. |
| formGroup.classes | Classes for surrounding `.govuk-form-group` | Spacing/layout adjustments only. |

## Validation & Schema
AJV schema: `src/component-lib/schemas/textarea.schema.json` enforces basic structure:
- Required: `name`, `label`, `hint`, `classes`, `rows`.
- `rows` accepts number or numeric string (editor flexibility) and must be >= 1.
- Label / hint / errorMessage allow string or object (future i18n compatibility).

Server PUT handler performs validation keyed by `textarea` through the shared schema loader.

## Rendering (Nunjucks)
Export template (abridged) calls:
```
{% from "govuk/components/textarea/macro.njk" import govukTextarea %}
{{ govukTextarea({
  name: props.name,
  id: props.id or props.name,
  label: props.label,
  hint: props.hint,
  errorMessage: props.errorMessage,
  classes: cls,   # ensures 'govuk-textarea' present
  rows: props.rows,
  autocomplete: props.autocomplete,
  spellcheck: props.spellcheck,
  value: props.value
}) }}
```
A helper adds `govuk-textarea` if missing from `props.classes`.

## Accessibility Notes
- Always supply a meaningful label; use `govuk-visually-hidden` class only when context provides an on‑screen description immediately adjacent.
- Hint text should not repeat the label; keep it brief (WCAG 3.3.2).
- Ensure any client‑side validation also reports errors via `errorMessage.text` so screen readers announce them.

## Authoring Guidance
1. Choose a clear label describing the information requested (avoid generic “Details”).
2. Provide a concise hint only if it reduces ambiguity; omit otherwise.
3. Use `rows` to suggest typical length (5 is a good default). Larger values do not impose limits; avoid excessive vertical space.
4. Leave `value` blank for new entries to avoid implying pre‑filled content is required.
5. Keep custom classes minimal; rely on design system spacing utilities sparingly via `formGroup.classes`.

## Differences vs Character Count
| Aspect | Textarea | Character Count |
|--------|----------|-----------------|
| Live remaining counter | No | Yes (chars or words) |
| Limit enforcement | Not inherent (HTML `maxlength` could be added manually) | Managed via `maxlength` / `maxwords` props |
| Extra props | Basic set | Adds `maxlength`, `threshold`, `maxwords` |
| Cognitive load | Lower | Slightly higher (counter UI) |

Choose the simpler textarea unless users benefit from proactive limit feedback.

## Migration Notes
- Legacy versions used an explicit `id`; current template omits it, relying on `name` as fallback when rendering.
- Schema accepts object or string for text fields to ease future multilingual expansion without breaking existing data.

## Quality Checklist
- [x] Filesystem template (`textarea.template.json`)
- [x] AJV schema
- [x] Startup sync + dev sync endpoint
- [x] PUT validation branch
- [x] Pattern doc (this file)

## Future Enhancements
- Optional built‑in `maxlength` support (without counter) for silent truncation / passive validation.
- i18n tooling to manage `{ en: "", fr: "" }` structures if bilingual rollout proceeds.
