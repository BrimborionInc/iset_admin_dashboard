# Meta Log Retention Policy - 2026-04-29

Status: first-pass policy for large project-memory logs.
Last reviewed: 2026-04-29 during documentation cleanup.

Purpose: keep the large meta logs useful for cross-thread recovery without turning them into unreadable transcripts or duplicating domain docs.

## Inventory

Checked from `/mnt/x/ISET/admin-dashboard` on 2026-04-29.

| File | Approx size | Retention decision |
| --- | ---: | --- |
| `docs/meta/codex-thread-index.md` | 166 KB | Keep as one searchable index for now. |
| `docs/meta/changelog.md` | 158 KB | Keep as one chronological admin changelog for now. |
| `docs/meta/next-release-notes-log.md` | 86 KB | Keep as one working release-note log for now. |
| `../ISET-intake/docs/meta/changelog.md` | 12 KB | Keep as one portal changelog for now. |
| `docs/meta/project-map.md` | 26 KB | Keep as concise map; move subsystem detail to domain docs. |
| `../ISET-intake/docs/meta/project-map.md` | 9 KB | Keep as concise portal map. |

## Use Rules

- Search large logs with `rg` or targeted terms; do not read them front to back at thread start.
- Prefer canonical domain docs after a log points you to them.
- Do not paste transcript-like summaries into these logs.
- Do not delete old entries merely to shrink a file. If a split becomes necessary, move entries into a dated archive and leave an index.

## File Responsibilities

- `codex-thread-index.md`: cross-thread recovery index keyed by exact Codex task title where possible. It is not a changelog.
- `changelog.md`: admin technical/user-visible/ops/security/schema change log.
- `next-release-notes-log.md`: working user-facing release-note source for landing-page "What's New" generation.
- `../ISET-intake/docs/meta/changelog.md`: portal-specific technical/user-visible change log.
- `project-map.md`: repo/module map and doc index; keep it concise.

## Split Thresholds

- Under roughly 200 KB: keep as a single searchable file unless structure is already failing.
- Around 200-300 KB: consider a quarterly or yearly archive split if new entries become hard to place or searches return too much noise.
- Over roughly 300 KB: create an index plus dated archive files before adding more broad entries.

Any split must preserve local Markdown links and be validated with `python3 scripts/check-doc-links.py`.

