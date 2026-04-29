# Data Docs And Reference Artifacts

Status: mixed maintained documentation, generated/reference artifacts, and temporary source data.

This directory is not a single source of truth. It contains current domain docs, database overview material, generated schema dumps, source spreadsheets, reference standards, and temporary import/backload artifacts.

## How To Use

- For database orientation, start with `database-documentation.md` and `database-overview.md`.
- For document storage/scoping, use `documents-model.md`.
- For applicant accounts, use `applicant-account-activation.md`.
- For secure messaging data integration, use `integrations/secure-messaging.md`.
- For privacy ERM evidence, use `privacy-erm-audits/` plus the controlling planning docs linked from `docs/AGENTS.md`.
- For ESDC, NOC, training, spreadsheet, PDF, XML, XSD, and SCH files, treat the files as reference/source artifacts unless a current implementation doc says otherwise.

## Generated Or Snapshot Material

- `DB-Structure-Dump/` contains schema dump snapshots. Verify against `sql/migrations/`, live DB checks, or regenerated dumps before relying on it.
- `NOC 2016/` and `NOC 2021/` contain external reference CSVs.
- `temp/` contains tracked temporary/source artifacts and has its own README gate. Do not use those files as durable project guidance.

## Cleanup Rule

When adding or changing files here, make their role clear:

- maintained domain doc
- generated snapshot
- external reference artifact
- temporary/source artifact
- historical audit output

Avoid adding narrative implementation guidance to generated/reference folders.
