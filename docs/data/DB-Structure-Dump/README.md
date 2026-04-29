# DB Structure Dump

Status: generated schema snapshots, not maintained guidance.
Last reviewed: 2026-04-29 during documentation cleanup.

This directory contains per-table SQL schema dump files generated from a database snapshot. These files can be useful for rough offline inspection, but they are not authoritative.

Use `sql/migrations/`, live database checks, and the migration tooling before relying on any schema claim here. For the current retention policy, see `docs/meta/data-artifact-retention-2026-04-29.md`.

Do not manually edit individual dump files. Do not update or add tracked dump files during normal schema work unless a future task explicitly approves a schema snapshot refresh.

