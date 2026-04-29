# Data Artifact Retention Policy - 2026-04-29

Status: first-pass retention policy for generated/reference data artifacts.
Last reviewed: 2026-04-29 during documentation cleanup.

Purpose: separate generated/source artifacts from maintained Codex guidance so future threads do not treat dumps, spreadsheets, or PDFs as current system truth.

## Scope

- `docs/data/DB-Structure-Dump/`: 132 tracked SQL schema snapshot files, about 370 KB total.
- `docs/data/temp/`: 3 tracked binary source/reference artifacts, about 500 KB total.
- Other external reference data under `docs/data/`, such as NOC CSVs and regional spreadsheet samples, remain source/reference artifacts unless a maintained domain doc says otherwise.

## Source Of Truth

For schema work, use this authority order:

1. Current canonical migrations in `sql/migrations/`.
2. Live DEV/TEST/PROD database checks appropriate to the task.
3. `npm run db:migrate:inventory`, `npm run db:migrate:plan`, and related migration tooling.
4. Fresh local generated schema output from `npm run dump:dev-schema` when needed for read-only inspection.
5. Existing tracked schema dump files only as historical snapshots.

## DB-Structure-Dump Policy

- Treat existing files under `docs/data/DB-Structure-Dump/` as legacy generated snapshots.
- Do not manually edit individual table dump files.
- Do not update or add dump files in normal feature/schema work. `docs/AGENTS.md` already says to regenerate schema dumps after schema changes but not commit dump files.
- If a future thread needs a durable schema evidence bundle, prefer a dated audit/report Markdown file that summarizes the relevant tables and says how it was generated.
- Later pruning candidate: remove tracked dump files from the docs tree or move them to an explicitly ignored/generated-artifacts location after confirming no workflow depends on them.

## Temp Artifact Policy

The current tracked `docs/data/temp/` files are source/reference artifacts, not project memory:

| File | Retention class | Notes |
| --- | --- | --- |
| `3789fc21-e228-4298-a3c6-97e12a7b596c-cfa-v2-iset-20260117-04558e.pdf` | source/reference artifact | Likely generated CFA/payment evidence sample. May contain sensitive client/program content; inspect only when needed. |
| `CURRENT BC 2025-26 - ISET Advance and Active Client Spreadsheet.xlsx` | source/reference artifact | Spreadsheet source material. May contain sensitive or program-specific data; do not use as current behavior. |
| `Data Entry Spreadsheets - Rebecca.xlsx` | source/reference artifact | Spreadsheet source material. May contain sensitive or program-specific data; do not use as current behavior. |

Future action: identify whether each temp artifact still supports a current import, reporting, finance, or CFA workflow. If not, remove it or move it to a non-guidance archive with a changelog entry.

