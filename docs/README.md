# Admin Console Documentation Library

This library captures the working knowledge for the admin dashboard. The goal is to make it easy for engineers, operators, and analysts to find canonical references for authoring workflows, operational runbooks, and shared platform decisions.

## Structure

- meta/ — changelog, project map, standing directives, and working notes for the library itself.
- architecture/ — system views, migration runner notes, and `integrations/` (e.g., portal ↔ admin interface).
- auth/ — incident write-ups and `plans/` for ongoing authentication work.
- assignment/ — staffing models and sourcing notes.
- change-requests/ — individual CR packages and decision logs.
- components/ — component contract plus `patterns/` with per-component specs.
- dashboards/ — dashboard-specific behavior and widget references.
- data/ — canonical models, runtime-config references, and cross-application integrations.
- data/DB-Structure-Dump — location for the current database structure dumps (kept out of git; see `docs/data/DB-Structure-Dump` on disk).
- features/ — product capabilities; subfolders such as `file-uploads/`, `intake-authoring/`, and `status-tracking/` keep related specs grouped.
- guides/ — how-to walkthroughs and scaffolding instructions for the team.
- ops/ — operational knowledge, split into `deployments/`, `environments/`, and `runbooks/`.
- planning/ — forward-looking initiatives and proposal docs.
- prompts/ — curated prompt sheets for Copilot/LLM workflows.
- runtime/ — normalization, publication, and renderer internals that feed the public portal.
- Note: Dev DB legacy cleanup completed (2025-01-13). Appointment/queue/location/service taxonomy tables dropped from `iset_intake`; backend legacy endpoints for those tables removed. `organization` and `ptma` retained. Details: `docs/planning/db-legacy-table-cleanup.md`.

## Authoring Guidelines

1. Start each page with Purpose, Audience, and Last Updated.
2. Prefer concise bullets or short sections; link to source code where clarity helps.
3. Cross-link instead of duplicating content from the public portal library.
4. Use TODO lines for known gaps or follow-ups.
5. Keep credentials, secrets, and environment-specific tokens out of this library.

### Dashboard UI conventions

- Favor Cloudscape components over native HTML for all in-product UI; use native elements only when there is no Cloudscape equivalent.
- Use Cloudscape navigation: prefer `<Link>` from `@cloudscape-design/components` instead of native `<a>` tags in dashboard widgets (e.g., Application Work Queue) unless a specific case requires otherwise.

## Maintenance Hints

- Update `meta/changelog.md` when you land user-visible or operational changes.
- Record structural reorganizations in `meta/project-map.md` so humans and LLMs can follow the breadcrumb trail.
- When a document replaces a legacy location, leave a short note pointing at the new canonical file until external references are updated.
- Note for assistants/LLMs: the admin dashboard and the public portal (`ISET-intake`) share some concepts but are deployed and configured independently. Do not automatically reuse code, environment files, or startup behaviors between them.
- TODO (uploads config): the “File Upload Config” admin page currently proxies to the intake backend and rejects admin tokens. Next session, decide whether to move the API into the admin backend or let intake trust the admin pool for this route.
- Priority instruction for assistants/LLMs: before modifying dashboards or widgets, read the relevant guidance in `docs/guides/` (e.g., `configurable-dashboard-notes.md`) and follow it as a system-level directive to avoid regressions.
- Reminder for assistants/LLMs: when uncertain about intent, ask before acting; don’t proceed on assumptions.
- Assistant directive: if a requested action is impossible or blocked (tooling, permissions, platform limits), state that clearly before attempting work so expectations stay aligned.
- Assumption freeze: Never assume API payloads, projections, or parity with other views. Before adding or changing UI fields, confirm the backend response actually exposes the data (e.g., inspect `/api/...` payloads or the query/projection). If anything is unclear, stop and ask for clarification before coding.
- Assistant coding discipline:
  - Do not assume parity with the public portal; inspect the relevant renderer/component before concluding no change is needed.
  - Verify end-to-end propagation (schema → runtime JSON → renderer/template) before claiming a behavior exists.
  - If a feature is missing at render time, check the renderer code first (not just the data) before advising “no change needed.”
  - Prefer evidence (files, responses, DOM) over guesses; pause and ask if intent or ownership is unclear.
  - Masking / renderer hotspot: the portal renderer lives in `../ISET-intake/src/renderer/renderers.js`. The admin preview renderer is in `apps/web/src/features/intake/ComponentRenderer.tsx` and is **not** the live portal. Confirm which one you’re editing before making mask or formatting changes.

## Thread bootstrap notes

- Cross-reference: the public portal library lives at `../ISET-intake/docs/README.md`; read it alongside this file at the start of a thread to keep the two applications straight.
- When changing admin dashboards or widgets, consult `docs/guides/configurable-dashboard-notes.md` first; it encodes system-level guardrails.
- If you need portal behavior for comparison (e.g., renderer parity), check `../ISET-intake/docs/runtime/` but avoid copying code or env files between apps without approval.
