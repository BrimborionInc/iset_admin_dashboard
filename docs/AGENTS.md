# Admin Dashboard Assistant Notes

Purpose: Standing directives and operating details for assistants and developers working on the admin dashboard.
Audience: Assistants and developers.
Last Updated: 2026-01-19

## Standing directives

- Before modifying any dashboard or widget, read `docs/guides/configurable-dashboard-notes.md`. Treat it as a blocker. Summarize how you applied it when you finish a dashboard change.
- For complex tasks, follow Interview -> Planning -> Implementation.
- Interview rules: ask one short question at a time, wait for the answer, and only ask about requirements or desired behavior. Do not ask questions about your approach to coding. You own the code and data.
- If anything is unclear (requirements, data, ownership, API payloads), stop and ask before coding.
- Prefer evidence over guesses. Inspect payloads, schemas, and renderer code before claiming behavior exists.
- If blocked (tooling, permissions, platform limits), state that clearly before proceeding.

## UI and data conventions

- Use Cloudscape components over native HTML. Use `Link` from `@cloudscape-design/components` instead of `<a>` unless there is no Cloudscape equivalent.
- Do not assume parity with the public portal. Verify end-to-end propagation (schema -> runtime JSON -> renderer/template) before changing UI fields.
- When adding or changing UI fields, confirm the backend response actually exposes the data. Do not assume API payloads.

## Known pitfalls and quality notes

- Program Admin "Unassigned Applications" must use `/api/applications`, not `/api/cases`, or applicant names will be missing.
- Avoid layering workarounds on top of known problems. Fix the root cause.
- When changes require new files in a deployment package, update `scripts/deploy-admin-test.ps1` and/or `../ISET-intake/scripts/deploy-portal-test.ps1` to stage the additional files.

## Documentation maintenance

- Update `docs/meta/changelog.md` for user-visible or operational changes.
- Record structural reorganizations in `docs/meta/project-map.md`.
- Keep credentials and environment-specific secrets out of this library.

## DB introspection (dev)

- MySQL runs on the Windows host and only accepts local connections.
- From WSL, use the Windows client with credentials from `.env`:
  `"/mnt/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" -u root -p"<from .env>" -D iset_intake -e "SHOW TABLES;"`
- If that fails, run `npm run dump:dev-schema` to refresh `docs/data/DB-Structure-Dump/` (kept out of git).

## Cross-app context

- The admin dashboard and the public portal are separate. Do not copy env files or code between apps without approval.
- Portal renderer: `../ISET-intake/src/renderer/renderers.js`. Admin preview renderer: `apps/web/src/features/intake/ComponentRenderer.tsx`. Confirm which one you are editing.
