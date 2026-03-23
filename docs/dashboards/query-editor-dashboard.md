# Query Editor Dashboard

Last updated: 2026-03-23

## Purpose
Provide System Administrators with a focused workspace for running ad hoc SQL text against the current environment database for diagnostics, validation, and controlled operational updates.

## Route and access
- Route: `/configuration/query-editor`
- Default access: `System Administrator`
- Page source: `src/pages/configuration/QueryEditorDashboard.js`
- Widget sources:
  - `src/pages/configuration/widgets/QueryEditorInputWidget.jsx`
  - `src/pages/configuration/widgets/QueryEditorResultsWidget.jsx`
  - `src/pages/configuration/widgets/QueryEditorEnvironmentWidget.jsx`
- Backend endpoint: `POST /api/admin/query-editor` in `isetadminserver.js`

## Current behavior
- Input is SQL text through a Cloudscape `CodeEditor`, with optional file-loading from the same widget.
- The dashboard submits `{ sql }` to `/api/admin/query-editor`.
- Uploading one `.sql` or `.txt` file loads its contents into the editor so the existing Run action can execute it.
- Multiple statements are supported in a single request when separated by semicolons.
- The backend splits SQL text while respecting quoted strings, backticks, line comments, and block comments.
- `SELECT` results are capped at 100 rows per statement and flagged as truncated when more rows exist.
- Write statements return `rowsAffected` plus a status message.
- When multiple statements produce results, the results widget shows a statement selector.
- The environment widget reads `/api/config/runtime` and displays `env.nodeEnv`.

## SQL file support
- Uploading a `.sql` or `.txt` file in the Query Editor is supported and loads the file contents into the editor.
- File uploads use the same execution path as pasted SQL: the frontend still submits `{ sql }` to `/api/admin/query-editor`.
- Client-side upload size is limited to 900 KB so the request stays within the server's 1 MB JSON body limit.
- Ordinary multi-statement SQL scripts should work once loaded into the editor.
- Scripts that depend on MySQL client commands such as `SOURCE`, `DELIMITER`, or other file-oriented client behavior are not supported by this endpoint.
- The repo does have a separate startup migration runner that reads `.sql` files from `/sql`, but that is not a user-driven Query Editor feature.

## Current limitations
- No saved queries, query history, or export action beyond copying results from the CSV/JSON views.
- No confirmation workflow or dry-run mode for write statements.
- The dashboard executes against the current environment database connection; there is no environment override in the UI.

## Implementation direction
- Keep a single execution path.
- The current upload flow already treats file loading as a content-loading aid, not a second execution mechanism.
- If a later "import" feature is added, it should remain an editor-population workflow rather than a separate backend import endpoint.
