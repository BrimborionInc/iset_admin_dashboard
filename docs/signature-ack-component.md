# Signature Acknowledgment Component (signature-ack)

Status: Planned  
Task ID: t8  
Category: Component Library

## Purpose
Provide a positive, explicit acknowledgment interaction beyond implicit "Next" navigation: user types their name then clicks a configurable action (e.g., "Sign Now"). After signing the field locks and displays a handwriting-like font. User may clear to re-enter before submission.

## Data Model
Persist minimal boolean for workflow logic while retaining typed name for audit.
Suggested stored value shape in step answers:
```json
{
  "signed": true,
  "name": "Jane Doe"
}
```
If unsigned (initial): either undefined or `{ "signed": false, "name": "" }` (choose consistent approach; prefer undefined until interaction for cleanliness).

## Authoring Schema Additions
Component type: `signature-ack`
Configurable properties:
- `label` (string | i18n object): Field label / instruction.
- `actionLabel` (default: "Sign Now").
- `clearLabel` (default: "Clear").
- `placeholder` (default: "Type your full name").
- `handwritingFont` (optional string CSS font-family, fallback to a bundled script-style font or cursive stack).
- `required` (boolean) — ensures a name must be provided & signed before step validation passes.

Example component JSON:
```json
{
  "key": "applicant_signature",
  "type": "signature-ack",
  "label": { "en": "Type your full name to acknowledge", "fr": "Tapez votre nom complet pour confirmer" },
  "actionLabel": { "en": "Sign Now", "fr": "Signer" },
  "clearLabel": { "en": "Clear", "fr": "Effacer" },
  "placeholder": { "en": "First Last", "fr": "Prénom Nom" },
  "required": true
}
```

## Rendering Behavior (Portal Runtime)
1. Initial state: editable text input, Sign button enabled only when input non-empty and not yet signed.
2. On Sign:
   - Validate non-empty name.
   - Persist `{ signed: true, name }`.
   - Input becomes readOnly and styled with handwriting font.
   - Button switches to Clear (or separate Clear button) enabling user to revert (sets value to unsigned state and restores editability).
3. Validation: If `required` and not signed at step submission time, add error: "Please sign to continue" (bilingual).

## Admin Preview / Step Editor
- Renders same interaction logic inside preview region.
- Editor form exposes configurable labels and placeholder.
- Stored JSON includes component type ensuring export to workflow JSON.

## Accessibility
- Input uses standard text input semantics.
- Sign action announces via ARIA live region (e.g., "Signature captured.").
- Clear action announces ("Signature cleared.").
- Handwriting font must maintain sufficient legibility; allow toggle to normal text with visually hidden accessible label if necessary.

## Styling
- Apply class (e.g., `.sig-locked`) when signed: cursive/handwriting font, maybe slight baseline jitter optional (future enhancement) but keep accessible.
- Avoid color-only cues; rely on readOnly state and descriptive text.

## Storage & Normalization
Normalization hook ensures if value present with `signed: true` then `name` string retained; if clearing returns to undefined or base object.

## Edge Cases
- User edits name then signs: ok.
- User signs, clears, changes name, re-signs: updates stored name.
- Step revisit: already signed displays locked state.
- Attempt to sign with empty name prevented.

## Validation Integration
Existing validation pipeline should treat `signature-ack` with custom rule: if `required` and either no value or `signed !== true` -> error.

## Implementation Steps (High Level)
1. Extend component templates (`componentTemplates.json`) with `signature-ack` entry.
2. Add renderer in intake portal `renderer/renderers.js` mapping `signature-ack` to new component implementation.
3. Implement React component with internal local state bound to form value adapter.
4. Update admin step editor library panel to include new component type.
5. Update `WorkflowPreviewWidget.js` to recognize and render via shared renderer (if using mapping) or add case.
6. Add validation logic (either inline or in central validation switch).
7. Add bilingual default strings.
8. Document usage (this file) and update both project maps.
9. Add dev task (t8) already created; mark progress as implementation proceeds.

## Future Enhancements
- Capture timestamp of signing.
- Optional signature re-confirmation modal.
- Digital hash/seal for tamper verification.

---
Initial spec drafted. Update upon implementation.
