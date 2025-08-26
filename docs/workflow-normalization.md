Workflow Normalization (Extraction)
===================================

Purpose
-------
Provide a single source of truth that converts a draft Workflow (steps, routes, component templates + overrides) into the immutable Portal runtime schema used by the public site. This powers:

1. Publication (writes schema + meta files into ISET-intake project)
2. In‑admin Preview (dry‑run: returns JSON only)
3. Future validation (structural + semantic) using the normalized shape

Module
------
`src/workflows/normalizeWorkflow.js` exports `buildWorkflowSchema({ pool, workflowId, auditTemplates?, schemaVersion? })`.

Return shape:
```
{ steps, meta, templates: { counts, metaMap }, raw: { usedTemplateIds } }
```

Key Behaviours
--------------
* Stable BFS ordering from declared start step, then any disconnected steps appended.
* Step slugs and component id slugs generated deterministically; uniqueness enforced per scope.
* Storage key precedence aligns with routing: route.field_key > fieldName > name > id > slug(label).
* Supported component types gated by `SUPPORTED_COMPONENT_TYPES` (central constant).
* Summary List rows frozen (key, label, format, hideEmpty, emptyFallback) at normalization time.
* Normalization inference (date → date-iso, numeric/select/radio values → number, yes/no → yn-01, etc.).
* Optional template audit (render each export_njk_template with its default props) when publishing.

Endpoints
---------
* `GET /api/workflows/:id/preview` – Dry-run (no file writes, no template audit) returns `{ mode:'preview', steps, meta }`.
* `POST /api/workflows/:id/publish` – Uses shared builder with `auditTemplates:true`, writes schema + meta files (backward compatible path).

Next Steps (Planned)
--------------------
* Add validation endpoint that wraps normalization then applies structural + field-level rules.
* Introduce versioned shared runtime package consumed by both Admin UI preview and Portal.
* Extend summary-list to optionally embed computed/derived fields (future formatting functions).

Change Log
----------
* Initial extraction (Phase 1) – refactored large inline publish logic into reusable module; added preview endpoint.
