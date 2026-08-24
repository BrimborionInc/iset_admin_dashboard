# ChatGPT-To-Codex Support Handoff

Status: current explicit bridge between ChatGPT Pro content work and this repository workspace.
Audience: Bill, the ChatGPT Pro content project, and Codex support threads.
Last Updated: 2026-08-21

## Operating Model

The ChatGPT project is the content-production workspace. Codex is the repository- and DEV-aware evidence assistant. Current OpenAI product guidance treats Chat/Work and Codex as separate views with separate histories. ChatGPT web cannot directly access files on this machine; Codex in the IDE or desktop app can work with the local repository after Bill grants access. The bridge is therefore explicit:

1. ChatGPT emits a structured `CODEX_REQUEST`.
2. Bill submits the request to the PATH Codex project in the IDE/desktop app, normally by pasting it into this workspace thread or a new thread rooted at the same repository.
3. Codex checks the current source and, when authorized and safe, the DEV application.
4. Codex returns a `CODEX_RESPONSE` and any artifacts.
5. Bill returns the response or approved artifacts to the ChatGPT project.
6. Reusable findings are added to the curated source pack; one-off raw artifacts remain under ignored `tmp/` storage.

Signing into ChatGPT and Codex with the same account does not merge their histories or give an ordinary ChatGPT Project control of this active Codex thread. Do not tell the production LLM that it directly called, messaged, or controlled Codex unless a matching response actually came back. An automated custom app/plugin or API dispatcher is a separate implementation requiring explicit authentication, permissions, security review, and approval; none is configured by this source pack.

Platform references checked 2026-08-21:

- [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275/)
- [Codex availability and access](https://help.openai.com/en/articles/11369540/)

## Request Types

- `FACT_CHECK` — verify a feature, role, label, limitation, or status.
- `SOURCE_EXTRACT` — produce a concise evidence-backed explanation from current source.
- `MANUAL_STEP_VERIFY` — confirm a proposed procedure against current UI/API behavior.
- `SCREENSHOT` — capture a real PATH screen in DEV with synthetic or safely stubbed data.
- `FLOW_WALKTHROUGH` — document an end-to-end task and expected states.
- `COPY_REVIEW` — compare proposed wording with current product truth.
- `ACCESSIBILITY_CHECK` — inspect a screen or flow for accessibility evidence.
- `SUPPORTING_ARTIFACT` — prepare a diagram, table, export, annotated image, or evidence packet.

## Request Template

```text
CODEX_REQUEST
request_id: PATH-CONTENT-YYYYMMDD-NNN
type: FACT_CHECK | SOURCE_EXTRACT | MANUAL_STEP_VERIFY | SCREENSHOT | FLOW_WALKTHROUGH | COPY_REVIEW | ACCESSIBILITY_CHECK | SUPPORTING_ARTIFACT
deliverable: Marketing website | Product manual | Training | Sales support | Other
audience: <who will use the result>
question_or_task: <one bounded question or artifact request>
claim_or_procedure_under_review: <exact draft wording or proposed steps, if applicable>
target_surface: Admin console | Applicant portal | Both
target_role: <role or applicant state>
status_needed: PROD | Current source | DEV | Historical comparison
environment_permission: Source only | Local stubbed browser | DEV read-only | DEV synthetic fixture
synthetic_state: <required dummy scenario; never include real client facts>
artifact_spec: <format, viewport, crop, file type, annotations, or output shape>
privacy_constraints: No real personal data; list any additional exclusions
source_pack_refs: <relevant uploaded sections>
acceptance_criteria:
- <criterion 1>
- <criterion 2>
END_CODEX_REQUEST
```

Use one request per independently reviewable outcome. A screenshot request may include a small shot list for the same screen state, but it should not combine unrelated product areas.

## Codex Response Template

```text
CODEX_RESPONSE
request_id: <matching id>
result: CONFIRMED | CONFIRMED_WITH_QUALIFICATION | NOT_CONFIRMED | BLOCKED
answer: <plain-language answer suitable for the content producer>
publishing_wording: <safe wording, when useful>
status_basis: <PROD evidence, current source, DEV observation, or historical evidence>
evidence:
- <repository file and line, test, DEV observation, or artifact manifest>
limitations:
- <anything not proven>
artifacts:
- <path and description>
source_pack_update: <updated durable file, recommended update, or none>
END_CODEX_RESPONSE
```

## Artifact Locations

- Raw work: `tmp/product-content-support/<request_id>/`
- Raw screenshots: `tmp/product-content-support/<request_id>/raw/`
- Review-ready candidates: `tmp/product-content-support/<request_id>/review/`
- Approved, public-safe screenshots: `docs/product/assets/screenshots/`

`tmp/` is intentionally ignored by Git. Only an explicitly reviewed, synthetic-data artifact and its manifest may be promoted into the tracked screenshot catalogue.

## Default Authority And Safety

A request authorizes read-only source inspection and proportionate local checks. It does not authorize:

- TEST or PROD mutation;
- real email, notification, signing, finance, or external-provider sends;
- runtime-configuration or database changes;
- use of live applicant/client data;
- publication of an artifact merely because it was captured.

If a request needs any broader authority, Codex must stop and ask Bill explicitly.
