# Inset Text Component Pattern

Status: Modernized (filesystem template + schema + validation + dev sync)

## Purpose
Inset text draws attention to a block of supporting or contextual information without elevating it to an alert. Use it for explanatory notes, background context, or mild emphasis. Do not use it for errors, success messages, or critical warnings (use appropriate alert/panel patterns instead).

## Source of Truth
- Template: `src/component-lib/inset-text.template.json`
- Schema: `src/component-lib/schemas/inset-text.schema.json`
- Dev sync endpoint: `POST /api/dev/sync/inset-text-template`
- Server validation: PUT `/api/component-templates/:id` triggers AJV when `template_key` == `inset-text`

## Default Props
| Field | Description |
|-------|-------------|
| id | Optional explicit id; defaults can be generated or left blank (GOV.UK macro will derive). |
| text | Plain text content (bilingual object allowed). |
| html | Optional raw HTML variant; if non-empty, used instead of text. |
| classes | Additional CSS classes appended to `govuk-inset-text` (macro adds base). |

## Authoring Guidance
- Prefer `text` for straightforward content; reserve `html` for links or inline formatting.
- Avoid putting headings inside inset text; keep it concise (1–3 sentences).
- Do not duplicate information already conveyed in hint text for a form control.
- Keep critical actions outside inset text for accessibility (screen readers may skim past).

## Translations
Translatable fields: `text` OR `html` (whichever is used). The translation widget will surface them if present. Provide both languages before publishing.

## Validation Rules (Schema)
- `text` required (may be empty string initially, but should be populated before production).
- If `html` is provided, it can override `text` at render time; schema allows nullable string.

## Rendering
Template macro usage:
```
{% from "govuk/components/inset-text/macro.njk" import govukInsetText %}
{{ govukInsetText({
  text: props.text,
  html: props.html,
  id: props.id,
  classes: props.classes
}) }}
```
Server keeps `props.text` and `props.html` as-is; no adornments or label semantics.

## Accessibility
- Content should still make sense when announced inline. Avoid long paragraphs.
- Do not rely on color alone: inset text uses a left border; ensure wording conveys purpose.

## Future Enhancements
- Optional role annotation (e.g., `role="note"`) if needed for AT clarity.
- Auto-enforcement: disallow both `text` and `html` being meaningfully populated simultaneously to reduce duplication.

---
Last updated: 2025-08-26
