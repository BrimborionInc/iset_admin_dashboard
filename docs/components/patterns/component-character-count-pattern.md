# Character Count Component Pattern

## Summary
The character-count component provides a multi-line text input (`textarea`) with an accessible, live counter showing remaining characters (or words) and warning / error messaging as thresholds are crossed. It wraps the GOV.UK `govukCharacterCount` macro.

## Purpose & When To Use
Use when you must:
- Enforce or clearly communicate a maximum number of characters (or words) users may enter.
- Provide proactive feedback about remaining space to reduce validation failures at submit time.
- Encourage concise responses (eg. short descriptions, summaries) while still allowing multi-line entry.

Use a plain `textarea` instead when:
- There is no maximum length of practical concern OR server-side validation alone is sufficient.
- The limit is extremely high (counter noise) or not meaningful to users.

## Key Props (Authoring Model)
| Prop | Description | Notes |
|------|-------------|-------|
| name | Data submission key (maps to form data) | Required. Also used as fallback `id`. |
| label.text | Visible label text | Provide concise, specific instruction. |
| label.classes | Label size / visibility modifiers | Defaults to `govuk-label--m`. Can be `govuk-visually-hidden`. |
| hint.text | Supplemental guidance | Plain text (or i18n object) kept brief. |
| rows | Initial textarea height (lines) | UI only; does not constrain input length. |
| maxlength | Maximum characters allowed | Drives counter (character mode). Mutually exclusive with `maxwords` for the counter mode. |
| maxwords | Maximum words allowed (optional) | If set (non-null) the counter switches to word counting. Leave null to use characters. |
| threshold | Percentage (0–100) at which to start showing the live countdown | GOV.UK recommends around 75. Lower for very short limits. |
| autocomplete | HTML autocomplete hint | Empty by default. Populate if a known token benefits users (e.g. `organization`). |
| spellcheck | Enable browser assisted spell checking | Keep true for most free text unless domain-specific codes. |
| value | Initial default value | Rarely needed; typically leave blank. |
| classes | Extra CSS classes for outer wrapper | Keep minimal; design system supplies baseline. |
| formGroup.classes | Classes applied to the `.govuk-form-group` wrapper | Use for spacing overrides if necessary. |

## Validation & Schema
AJV schema `schemas/character-count.schema.json` enforces required structure and types:
- Required: `name`, `label`, `hint`, `rows`, `maxlength`, `threshold`.
- `maxwords` is nullable; when provided must be >= 1.
- `threshold` constrained to 0–100; ensures % logic remains valid.
- `maxlength` numeric/string (supports initial ingestion of string values from editor UI) and must be >= 1.
- Label / hint / errorMessage support bilingual (string or object) shapes.

Server PUT validation uses the template key `character-count` via the common AJV loader.

## Rendering (Nunjucks)
Source macro call (`export_njk_template`):
```
{% from "govuk/components/character-count/macro.njk" import govukCharacterCount %}
{{ govukCharacterCount({
  name: props.name,
  id: props.id or props.name,
  label: props.label,
  hint: props.hint,
  errorMessage: props.errorMessage,
  formGroup: props.formGroup,
  classes: props.classes,
  rows: props.rows,
  maxlength: props.maxlength,
  maxwords: props.maxwords,
  threshold: props.threshold,
  autocomplete: props.autocomplete,
  spellcheck: props.spellcheck,
  value: props.value
}) }}
```
The macro handles ARIA live region announcements once JavaScript enhances the component (`GOVUKFrontend.initAll`).

## Accessibility Considerations
- Provides character or word limit guidance before input (per WCAG 3.3.2 – Labels or Instructions).
- Live region (implemented by GOV.UK Frontend) announces remaining count—avoid duplicating this in hint text.
- Ensure limits are inclusive and phrased clearly (e.g. "You can enter up to 200 characters").
- When using `maxwords` ensure copy reflects words not characters.
- Maintain sufficient contrast and avoid replacing text with color alone when warning or error state occurs.

## Authoring Guidance
1. Choose the appropriate limit mode: characters (set `maxlength`) OR words (set `maxwords` and optionally remove `maxlength` from UI editing if needed).
2. Calibrate `threshold`: For short limits (< 50) use a higher threshold (e.g. 90) so users see the counter earlier; for larger limits keep ~75.
3. Keep `hint.text` succinct; the dynamic counter supplies ongoing guidance.
4. Avoid default values unless editing previously saved data; initial defaults can confuse user expectations about required content.
5. If switching to word mode, verify wording of any contextual help matches ("words remaining" vs "characters remaining").

## Differences vs Plain Textarea
| Aspect | Textarea | Character Count |
|--------|----------|-----------------|
| Live feedback | None | Remaining characters/words with warning threshold |
| Enforced limit | Not intrinsic (HTML maxlength optional) | Explicit `maxlength` or `maxwords` drives UI & enforcement |
| Threshold UI | N/A | Controlled via `threshold` percentage |
| Additional props | Basic size & behaviour | Adds `maxlength`, `threshold`, `maxwords` |
| Default classes | `govuk-textarea` mandated | Optional extra classes; macro supplies base structure |

## Migration / Backfill Notes
- Legacy rows where `character-count` lacked filesystem template are now realigned by startup sync (`syncCharacterCountTemplateFromFile`).
- Schema tolerates string numeric inputs (`"200"`) to ease transition from earlier free-form editing; future UI should normalise to numbers.
- Historical templates including only `maxlength` will continue to function; `maxwords` is optional and ignored when null.

## Future Enhancements (Optional)
- Add i18n wrappers for counter messages if/when multilingual content support expands.
- UI toggle to mutually exclude `maxlength` vs `maxwords` ensuring only one mode is active at a time.
- Editor validation to enforce `threshold < 100` and warn if `threshold * maxlength < 10` (counter appears too late).

## Quality Checklist
- [x] Filesystem template present
- [x] AJV schema present & loaded
- [x] Startup sync + dev sync endpoint
- [x] PUT validation branch wired
- [x] Pattern doc added
- [ ] Portal parity check recommended: GET /api/audit/parity-sample?templateKey=character-count

