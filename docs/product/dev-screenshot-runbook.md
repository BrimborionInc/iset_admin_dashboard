# DEV Screenshot Production For Marketing And Manuals

Status: current privacy-first runbook for documentation screenshots.
Audience: Codex threads, Bill, content reviewers, and documentation maintainers.
Last Updated: 2026-08-21

## Purpose

Produce real PATH interface screenshots without exposing applicant, client, staff, financial, message, document, or environment-sensitive data. The default is a real local/DEV UI rendered with deterministic synthetic or stubbed data. Redacting a real record is a fallback, not the normal method.

Read `docs/testing/browser-workflow-smoke-automation.md` before adapting a browser workflow. Existing browser smokes are test evidence; they are not automatically publication-ready screenshot generators.

## Hard Boundaries

- Use local or DEV only unless Bill separately authorizes another environment for an exact read-only task.
- Never use PROD data as screenshot source material.
- Do not trigger real email, notifications, signing delivery, finance sends, external uploads, or other provider side effects.
- Do not put personal data into an external AI tool for redaction.
- Do not assume a blurred name makes an image safe. Other fields, filenames, counts, dates, messages, URLs, tooltips, browser autofill, and accessibility text can identify a person.
- Do not present a stubbed or DEV-only screen as proof that the function is enabled in PROD.
- Do not run a database-backed capture script unless its target identity, live schema metadata, finished statements, fixture, and cleanup meet the repository's current fail-closed SQL rules.

## Preferred Capture Modes

Use the safest mode that still proves the intended visual:

1. **Local compiled UI with intercepted APIs and deterministic synthetic data.** Best for layout, labels, widgets, menus, empty states, and generic workflow states.
2. **DEV with disposable synthetic identities and fixtures.** Use only when real authentication, server rendering, upload/signing behavior, or an exact integrated state is essential.
3. **DOM masking in a synthetic DEV session.** Use for irrelevant dynamic environment labels or IDs that cannot be excluded at the fixture layer. Record every mask in the manifest.
4. **Image redaction.** Last resort. Preserve an untracked raw copy, create a review copy, record every redacted region, and obtain manual privacy approval before promotion.

## Synthetic Persona Rules

Use obviously fictitious values that cannot be mistaken for a real participant:

- names such as `Avery Example` or `Jordan Demo`;
- references beginning with `DEMO-` or `SAMPLE-`;
- reserved example domains such as `example.test` or `example.com`;
- non-dialable example phone values;
- generated documents containing only `SYNTHETIC DEMO — NOT A REAL RECORD`;
- dates and dollar values chosen for the scenario, not copied from a live file.

Do not use a real person's name with changed details, a real email with a dummy record, recognizable correspondence, copied document filenames, production-like credentials, or real signatures.

## Capture Workflow

### 1. Resolve The Request

Start from a `SCREENSHOT` request in `docs/product/codex-support-handoff.md`. Confirm:

- deliverable and audience;
- admin console or applicant portal;
- exact screen, role, and state;
- whether the image documents current PROD behavior or previews current DEV/source behavior;
- viewport, crop, format, and callout requirements;
- which labels and fields must be visible.

### 2. Prove The Baseline

Record:

- repository and commit;
- dirty/clean state;
- build target;
- target route;
- role/persona;
- data mode: stubbed, synthetic fixture, or masked;
- status basis: PROD-equivalent source, current DEV, or explicit preview.

If the working tree is dirty, list the files that could affect the screen. A screenshot from uncommitted UI code must be captioned as a preview unless those changes are intentionally the subject.

### 3. Stage The Screen

- Prefer an existing deterministic browser smoke when it already renders the required surface.
- Narrow or extend the smoke for the requested state; do not make a broad fixture merely to obtain one image.
- Set a stable viewport before capture. Default documentation desktop viewport: `1440 × 1100` with device scale factor `1`.
- Dismiss tutorials, developer overlays, password-manager prompts, and browser chrome unless they are the subject.
- Wait for the product-owned loaded/active-state signal and for relevant API traffic to settle.
- Check browser console and failed responses before treating the visual as valid.

### 4. Capture Raw Evidence

Write raw work under:

```text
tmp/product-content-support/<request_id>/raw/
```

Capture the smallest useful frame. Prefer component or viewport shots over full-page images that expose unrelated records. Keep the raw image untracked.

### 5. Privacy And Accuracy Review

Inspect every image at full size. Check:

- names, initials, emails, phones, addresses, dates of birth, SIN-like values;
- case, client, application, submission, document, signing, packet, and message identifiers;
- message subjects/bodies, notes, reminders, filenames, upload previews, signatures, and URLs;
- staff names, assignees, approver names, notification recipients, and avatar initials;
- account lists, global counts, recent activity, search suggestions, and browser autofill;
- DEV banners, environment names, debug panels, console output, and build metadata;
- exact labels, role-appropriate actions, error states, and status captions;
- any state that could be mistaken for a live PROD capability.

Review alt text and accessible labels where the capture method could expose them in an accompanying artifact. A JSON report that redacts an email does not redact pixels.

### 6. Prepare The Review Candidate

Write the candidate and manifest under:

```text
tmp/product-content-support/<request_id>/review/
```

Use captions to disclose one of:

- `PATH interface shown with synthetic data.`
- `Current DEV preview shown with synthetic data; production availability not claimed.`
- `Illustrative local rendering using deterministic stubbed data.`

Do not add callouts that obscure required evidence or imply a function not visible in the original UI.

### 7. Promote Only After Approval

After privacy, product, and visual review, copy the approved image to `docs/product/assets/screenshots/` and add its manifest entry to that directory's `README.md`. If an existing portal manual page must keep its `../ISET-intake/docs/portal/assets/screenshots/` reference, add the same approved image there only after recording the central image ID/cross-reference; do not let the two copies acquire different review status. Raw captures remain in ignored `tmp/` storage and may be deleted after approval when no longer needed.

## Existing Admin Capture Starting Points

These local browser smokes already render deterministic synthetic/stubbed states:

| Surface | Command | Existing image output/use |
| --- | --- | --- |
| Home Work Queue | `npm run smoke:home-overdue:browser` | Queue/status example |
| Manage ISET Applications | `npm run smoke:case-assignment:browser` | Applications table and reassignment modal |
| Manual Application Intake | `npm run smoke:manual-intake:browser` | Staff-assisted intake flow |
| Application Workspace | `npm run smoke:application-workspace:browser` | Default client/application workspace layout |
| Application Assessment | `npm run smoke:application-assessment:workflow:browser` | Multiple synthetic review states |
| Case intervention review | `npm run smoke:intervention-assessment:workflow:browser` | Proposal/revision review states |
| ILMP participant queue | `npm run smoke:esdc-participants:browser` | Participant submission/export queue |
| Manage Intake Steps | `npm run smoke:manage-components:browser` | Workflow-authoring dashboard |
| Modify Intake Step | `npm run smoke:modify-component:browser` | Step editor |

Run only the focused command needed for the requested screen. Review its implementation first: test fixtures often prioritize edge-case proof over clean publication composition.

## Public Portal Capture Notes

Low-risk unauthenticated starting points include the public landing page, sign-in, registration, and password-recovery screens. Authenticated dashboard, intake, messages, documents, and signing screens require a fully synthetic applicant state.

The existing `../ISET-intake/scripts/portal-workflow-smoke/run.js` is **not** a general publication capture command. Its `intake-happy` mode submits a record and performs a database check. Do not use that mode for documentation capture unless it is first brought under the current live-schema preflight and cleanup rules. Its report redacts an email field in JSON, not in screenshots.

When a portal capture is requested, prefer a focused local stubbed browser scenario or a disposable DEV applicant fixture built for that exact screen. Particularly sensitive surfaces are submission detail, secure-message conversations, uploads, signing forms, signed PDFs, and applicant dashboard activity.

## Screenshot Manifest Template

```yaml
id: path-<surface>-<state>-YYYYMMDD
file: <approved-file>.png
request_id: PATH-CONTENT-YYYYMMDD-NNN
surface: Admin console | Applicant portal
route: <route without live identifiers>
role_or_persona: <synthetic role/persona>
state: <what the image proves>
data_mode: stubbed | disposable-dev-fixture | masked-synthetic
status_basis: prod-equivalent | current-dev-preview | illustrative-local
admin_commit: <commit or n/a>
portal_commit: <commit or n/a>
captured_at: <ISO timestamp>
viewport: 1440x1100@1x
privacy_reviewed_by: <reviewer/date>
product_reviewed_by: <reviewer/date>
transformations:
  - none
caption: PATH interface shown with synthetic data.
alt_text: <concise functional description>
supersedes: <prior image id or none>
```

## Completion Standard

A screenshot task is complete only when the requested state is visible, the capture basis is truthful, network/console failures are accounted for, the manifest is complete, privacy review passes, and the content producer receives both the approved image and its caption/alt text.
