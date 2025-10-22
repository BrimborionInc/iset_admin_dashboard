# Details Component Pattern

Status: Modernized (filesystem template + schema + validation + dev sync)

## Purpose
The Details component provides a progressive disclosure pattern: a short summary users click to reveal additional information.

Use it for:
- Supplementary explanations that only some users need
- Long examples or background sections that would otherwise clutter the page

Avoid for:
- Critical information (should not be hidden)
- Validation errors (use error summary / inline errors)
- Navigation (do not hide navigation choices) 

## Source of Truth
- Template: `src/component-lib/details.template.json`
- Schema: `src/component-lib/schemas/details.schema.json`
- Dev sync: `POST /api/dev/sync/details-template`
- Validation: PUT `/api/component-templates/:id` with `template_key` == `details`

## Default Props
| Field | Description |
|-------|-------------|
| id | Optional explicit id. |
| open | Whether expanded by default (usually false). |
| summaryText | Required clickable summary text (bilingual capable). |
| text | Plain body text (bilingual capable). Ignored if `html` provided. |
| html | Optional HTML body override; if present, used instead of `text`. |
| classes | Extra CSS classes. Base macro adds `govuk-details` automatically. |

## Authoring Guidance
- Keep `summaryText` concise (a short phrase). It’s the affordance users scan.
- Prefer `text` for simple content; only use `html` when links or formatting are required.
- Do not place interactive form controls inside details unless research supports it (discoverability risk).
- Avoid nesting multiple details components—content becomes hard to navigate.

## Translations
Translatable fields: `summaryText`, `text` (or `html` if used). Provide both languages before publishing.

## Validation (AJV)
- `summaryText` required
- `open` boolean (default false)
- `html` optional; if present it overrides `text`

## Rendering
```
{% from "govuk/components/details/macro.njk" import govukDetails %}
{{ govukDetails({
  summaryText: props.summaryText,
  text: props.text,
  html: props.html,
  open: props.open,
  id: props.id,
  classes: props.classes
}) }}
```

## Accessibility
- The summary is rendered as a `<summary>` element within `<details>`—screen readers announce its state.
- Avoid very long `summaryText`; keep to a single line where possible.
- If content contains headings, ensure the outline remains logical when expanded.

## Future Enhancements
- Optional `summaryHtml` support (GOV.UK macro offers `summaryHtml`).
- Analytics hook to record expand/collapse interactions.
- Auto-focus management for newly revealed complex content.

---
Last updated: 2025-08-26
