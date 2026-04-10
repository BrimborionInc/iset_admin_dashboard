# Admin AI Guidance

Purpose: move PATH workflow grounding for the embedded admin help chat out of brittle page-local `aiContext` strings and into dedicated database-backed guidance records.

## Current design

- The embedded help chat still keeps a small system-prompt layer for answer style and safety.
- When the help chat calls `POST /api/ai/chat`, it now sends a `chatContext` object containing:
  - `surface`
  - `pathname`
  - `helpTitle`
  - `aiContext`
  - `role`
- The server uses that metadata plus the latest user question to retrieve matching guidance rows and prepend a grounded system message before calling the model.

## Tables

- `admin_ai_guidance_entry`
  - one row per guidance rule or workflow instruction
  - stores route patterns, help titles, roles, topic tags, keywords, source anchors, and guidance text
- `admin_ai_guidance_example`
  - approved example Q&A pairs tied to a guidance slug
  - used to steer answer level and phrasing

These tables are created lazily by the server the first time help-panel guidance retrieval runs.

## Seeded scope

The first seeded guidance slice is intentionally narrow:

- imported/application-less backload overview
- existing-intervention lifecycle guardrails
- historical finance handling for `manual_backload` interventions

This limited seed exists to tune answer quality before expanding coverage across the full admin dashboard.

## Current source of truth

The seeded rows were derived from existing curated guidance in:

- `src/helpPanelContents/caseWorkspaceHelp.js`
- `src/helpPanelContents/caseWorkspaceInterventionsHelp.js`
- `docs/guides/client-file-imports.md`

## Expansion plan

- add more guidance rows by workflow area
- add admin editing/versioning once the retrieval shape is validated
- reduce reliance on large frontend `aiContext` strings as DB-backed coverage expands
