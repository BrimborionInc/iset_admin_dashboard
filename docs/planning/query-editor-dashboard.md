Purpose: Track planning and implementation for the Query Editor configuration dashboard scaffold.
Audience: Admin dashboard engineers and product owners.
Last Updated: 2026-02-02

## Background
- A new Configuration dashboard titled "Query Editor" is required.
- It must live under the Configuration section in the side navigation.
- Default access is System Administrator only.
- Initial delivery is an empty scaffold (no widgets or backend integration).

## Goals
- Add a new route at `/configuration/query-editor` with standard header, breadcrumb trail, and help info link.
- Wire access control defaults so only System Administrators can access the route by default.
- Add the link under Configuration in the side navigation with role-based visibility.
- Provide an empty Cloudscape board scaffold that follows configurable dashboard conventions.
- Supply dashboard-level help content with AI context.

## Non-goals
- Implementing query editing functionality or APIs.
- Adding widgets or live data.
- Altering permissions for other routes.

## Constraints / References
- Follow `docs/guides/configurable-dashboard-notes.md`.
- Use Cloudscape components (Board, Header, Link).
- Route access defaults in `src/config/roleMatrix.json` and labels in `src/widgets/AccessControlMatrix.jsx`.
- Side navigation in `src/layouts/SideNavigation.js`.
- Help panel wiring in `src/routes/AppRoutes.js`.

## Open Questions
- None.

## Decisions (Interview Log)
- Route path: `/configuration/query-editor`
- Dashboard title: "Query Editor"
- Default access: System Administrator only
- Empty board scaffold with an empty-state message; palette actions wired for consistency.
- Query Editor MVP uses widget-based layout with a 100-row maximum result size.

## MVP Design (Widget-Based)
- Widgets (default layout):
  - Query Editor: SQL input area (Cloudscape CodeEditor, SQL mode), Run button, inline status/error.
  - Results: Tabbed view with CSV, JSON, Table (CSV default), all using Code View for easy copy. A statement selector appears only when multiple statements return results.
  - Environment: read-only display of current environment identifier from `/api/config/runtime` (`env.nodeEnv`).
- Page state owns `sql`, `isRunning`, `result`, `error`, and `env`; widgets receive props.
- No saved queries, exports, history, file uploads, or safety workflows in MVP.

## Backend Expectations
- `POST /api/admin/query-editor` accepts `{ sql }` and executes one or more statements (semicolon-delimited) against the existing connection pool.
- System Administrator only; no separate DB configuration or environment selector.
- Limit SELECT results to 100 rows; return `truncated: true` when applicable.
- Return results or errors verbatim to the UI.

## Implementation Notes
- Widget IDs: `query-editor`, `query-results`, `query-environment`.
- Results payload: `{ results: [{ statement, type: 'select', columns, rows, rowCount, truncated } | { statement, type: 'write', rowsAffected, message }], statements, statementCount }`.

## Implementation Plan
1) Create `src/pages/configuration/QueryEditorDashboard.js` using the standard configurable board scaffold with empty widget registry, layout persistence, palette wiring, and canonical board i18n strings.
2) Add `src/helpPanelContents/queryEditorHelp.js` with page-level help content and `aiContext`.
3) Register the route in `src/routes/AppRoutes.js` with breadcrumbs, header info link, and header actions (add/reset if board scaffolding uses palette events).
4) Add the navigation link under Configuration in `src/layouts/SideNavigation.js`.
5) Add access control defaults in `src/config/roleMatrix.json` and label mapping in `src/widgets/AccessControlMatrix.jsx`.
6) Update `docs/meta/changelog.md` once the dashboard is wired.
