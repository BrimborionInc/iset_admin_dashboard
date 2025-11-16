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
- features/ — product capabilities; subfolders such as `file-uploads/`, `intake-authoring/`, and `status-tracking/` keep related specs grouped.
- guides/ — how-to walkthroughs and scaffolding instructions for the team.
- ops/ — operational knowledge, split into `deployments/`, `environments/`, and `runbooks/`.
- planning/ — forward-looking initiatives and proposal docs.
- prompts/ — curated prompt sheets for Copilot/LLM workflows.
- runtime/ — normalization, publication, and renderer internals that feed the public portal.

## Authoring Guidelines

1. Start each page with Purpose, Audience, and Last Updated.
2. Prefer concise bullets or short sections; link to source code where clarity helps.
3. Cross-link instead of duplicating content from the public portal library.
4. Use TODO lines for known gaps or follow-ups.
5. Keep credentials, secrets, and environment-specific tokens out of this library.

## Maintenance Hints

- Update `meta/changelog.md` when you land user-visible or operational changes.
- Record structural reorganizations in `meta/project-map.md` so humans and LLMs can follow the breadcrumb trail.
- When a document replaces a legacy location, leave a short note pointing at the new canonical file until external references are updated.
- Note for assistants/LLMs: the admin dashboard and the public portal (`ISET-intake`) share some concepts but are deployed and configured independently. Do not automatically reuse code, environment files, or startup behaviors between them.
