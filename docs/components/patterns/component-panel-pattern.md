# Panel Component Pattern

Status: Modernized (filesystem template + schema + validation + dev sync)

## Purpose
The panel is a prominent confirmation or summary banner, typically placed at the top of a page after a successful transaction or important state change (e.g., “Application complete”). It visually groups a headline and optional supporting HTML.

Use a panel for:
- Positive confirmation of completion
- A short success summary with optional next steps immediately below

Do not use for:
- Errors (use error summary)
- General information (use inset text)
- Ongoing statuses or alerts (consider notification banners)

## Source of Truth
- Template: `src/component-lib/panel.template.json`
- Schema: `src/component-lib/schemas/panel.schema.json`
- Dev sync: `POST /api/dev/sync/panel-template`
- Validation: PUT `/api/component-templates/:id` with `template_key` == `panel` invokes AJV

## Default Props
| Field | Description |
|-------|-------------|
| titleText | Required heading text (bilingual capable). Shown large and bold. |
| html | Optional HTML block (appears below title). If empty, only title renders. |
| headingLevel | Structural heading level for `titleText` (1–4). |
| classes | Extra CSS classes appended (macro adds core class automatically). |

## Authoring Guidance
- Keep `titleText` concise (≤ 60 characters).
- Avoid repeating the page `<h1>`—either promote the panel title or ensure distinct wording.
- Keep `html` simple: paragraphs, links, strong/em emphasis. No form controls.
- Use appropriate heading level to maintain a valid document outline.

## Translations
`titleText` and `html` can be bilingual objects (en/fr). Provide both before publishing.

## Validation (AJV)
- `titleText` required (allow object or string)
- `headingLevel` must be one of 1,2,3,4
- `html` optional; may be null or string

## Rendering
```
{% from "govuk/components/panel/macro.njk" import govukPanel %}
{{ govukPanel({
  titleText: props.titleText,
  html: props.html,
  headingLevel: props.headingLevel,
  classes: props.classes
}) }}
```

## Accessibility
- The heading inside the panel participates in the page outline—choose `headingLevel` responsibly.
- If panel conveys success, you may additionally use a status region elsewhere for screen readers; panel itself is purely visual.

## Future Enhancements
- Optional ARIA role or live region injection
- Support for `titleHtml` variant (GOV.UK macro supports `titleHtml` if rich formatting needed)
- Automatic detection & prevention of duplicate h1 usage

---
Last updated: 2025-08-26
