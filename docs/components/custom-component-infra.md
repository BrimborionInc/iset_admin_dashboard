# Custom Component Infrastructure (Planned)

Status: Backlog (see dev task t9 in `src/devTasksData.js`). This document captures the intended design before implementation so reviewers can validate direction and spot integration risks early.

## Problem Statement
The current `signature-ack` component preview styling depends on client-side DOM transformation in `PreviewIntakeStep.js` to approximate final layout. This approach is:
- Timing sensitive (depends on iframe load & mutation order)
- Hard to test deterministically (post-render surgery)
- Inconsistent with server-side GOV.UK macro rendering pipeline
- Not easily extensible for future bespoke components

## Goals
1. Server-first rendering for all components (GOV.UK + custom) with consistent Nunjucks pipeline.
2. Eliminate iframe DOM surgery once macro parity validated.
3. Provide a discoverable registry enabling type -> render strategy mapping.
4. Maintain backward compatibility during transition (dual path allowed temporarily).
5. Keep security posture: no arbitrary template execution from user input.

## Non-Goals
- Full dynamic plugin system (no runtime upload of user templates yet).
- Version bump semantics (handled in separate future enhancement).
- Client runtime changes for portal already rendering custom interactive logic.

## Architecture Overview
```
/api/preview/step
  for each component:
    resolveRender(type, template_key) ->
      if registry entry with macro: env.render(macroTemplate, { props })
      else if registry entry with custom fn: fn(props)
      else DB export_njk_template fallback (current path)
      else stub comment
  wrapGovukDoc(html)
```

## Components
- Macro Directory: `src/server-macros/` (added to Nunjucks search path highest precedence).
- Registry Module: `src/server/componentRenderRegistry.js` exports function `getRenderer(type)`.
- Signature Macro: `signature-ack.njk` implements layout (1/3 width boxed input area + Sign / Clear buttons alignment) using semantic markup + GOV.UK utility classes where possible.

## Registry Shape (Draft)
```js
// src/server/componentRenderRegistry.js (planned)
module.exports = {
  'signature-ack': { macro: 'signatureAck' },
  // future: 'complex-widget': { render: (env, props) => customHtml }
};
```

Nunjucks macro file pattern:
```njk
{# src/server-macros/signature-ack.njk #}
{% macro signatureAck(props) %}
<div class="signature-ack govuk-!-margin-bottom-6">
  <div class="signature-ack__row" style="display:flex;align-items:flex-end;gap:12px;">
    <div class="signature-ack__input-wrapper" style="flex:0 0 33%;">
      <label class="govuk-label" for="{{ props.id or props.name }}">{{ props.label.text or 'Signature' }}</label>
      {% if props.hint %}<div class="govuk-hint">{{ props.hint.text }}</div>{% endif %}
      <input class="govuk-input signature-ack__input" id="{{ props.id or props.name }}" name="{{ props.name }}" type="text" value="{{ props.value or '' }}" autocomplete="off" />
    </div>
    <div class="signature-ack__actions" style="display:flex;gap:8px;">
      <button type="button" class="govuk-button govuk-button--secondary signature-ack__sign-btn">{{ props.actionLabel or 'Sign' }}</button>
      <button type="button" class="govuk-button govuk-button--warning signature-ack__clear-btn">{{ props.clearLabel or 'Clear' }}</button>
    </div>
  </div>
</div>
{% endmacro %}
```

## Migration Plan
1. Implement macro + registry behind development flag `ENABLE_CUSTOM_MACROS=true` (default true in dev, false in prod until validated).
2. Add server log diffing: render both old (DB template) and new (macro) for signature-ack and compare normalized HTML (strip whitespace, attribute order) for N sessions.
3. Once stable, remove DOM transformation from `PreviewIntakeStep.js` and disable dual rendering.
4. Update docs & remove flag gating.

## Testing Strategy
- Unit: snapshot render of macro with representative prop sets (empty, with hint, required state, pre-signed state).
- Integration: call `/api/preview/step` with single signature component; verify layout containers & classnames.
- Regression: automated diff tool comparing macro vs previous DB template output (during dual phase).

## Accessibility Considerations
- Ensure label association via `for` / `id`.
- Do not rely solely on color for state (handwriting font purely decorative, ensure underlying text remains plain input value).
- Buttons have descriptive text; if replaced by icons later add `aria-label`.

## Open Questions
- Should the DB `export_njk_template` for signature-ack be deprecated (set to minimal stub) once macro canonical? (Likely yes to avoid divergence.)
- How to express width (1/3) in a tokenized way (utility class vs inline style) – consider custom class with stylesheet addition.

## Future Extensions
- Allow macro overrides per environment via optional `local.server-macros/` path earlier in search chain.
- Introduce macro-level parity audit endpoint enumerating all registry entries and basic accessibility checks.

---
Document owner: Engineering (update required before implementation PR and after rollout completion). Revisit after first custom macro addition beyond signature-ack.
