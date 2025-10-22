# Text Block Component Pattern

Status: Modernized (filesystem template + schema + validation + dev sync)

## Purpose
Provides simple static textual content (paragraphs or headings) inside a step without adding an input field. Supports bilingual content and a curated set of GOV.UK typographic utility classes.

## Source of Truth
- Template: `src/component-lib/text-block.template.json`
- Schema: `src/component-lib/schemas/text-block.schema.json`
- Dev sync: `POST /api/dev/sync/text-block-template`
- Validation: PUT `/api/component-templates/:id` with `template_key` == `text-block`

## Default Props
| Field | Description |
|-------|-------------|
| text | Bilingual object `{ en, fr }` or string. Required unless `html` provided. |
| html | Optional HTML override; if present it is rendered instead of resolved `text`. |
| classes | GOV.UK class controlling typography (e.g., `govuk-body`, `govuk-heading-m`). |

## Authoring Guidance
- Pick the correct heading level (`govuk-heading-m` etc.) consistent with the page outline. The export template wraps headings with `<h2>`; adjust future template if different heading ranks are needed.
- Use `govuk-body` for standard paragraphs.
- Avoid embedding raw HTML—extend component if richer formatting required.
- Use visually hidden class only for accessibility labels; not for large content blocks.

## Translations
`text` is a bilingual object (preferred). UI lets you edit each language. If `html` is supplied it overrides bilingual text at render time.

## Validation (AJV)
- Ensures `text` is present (string or object with en/fr keys)
- `classes` optional

## Rendering Logic
Pseudo-Nunjucks (see template):
1. If `html` set: use as-is (safe filtered by templating layer assumptions) and skip text resolution.
2. Else resolve string from bilingual `text` (prefer current locale -> en -> fr).
3. Heading logic: if `classes` contains `govuk-heading-` render `<h2>`.
4. Inset variant: if `govuk-inset-text` present, wrap in `<div>`.
5. Default: `<p class="govuk-body">`.

## Accessibility
- Maintain correct document outline; currently always renders `<h2>` for heading classes. Future enhancement: allow explicit heading level selection.
- Avoid long blocks in visually hidden text.

## Future Enhancements
- Separate heading level property
- Allow limited inline HTML (links, emphasis)
- Optional markdown rendering

---
Last updated: 2025-08-26
