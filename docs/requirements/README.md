# Requirements Docs

Status: source requirements and reference artifacts.

This directory contains source requirement documents, older module specs, spreadsheets, PDFs, and forms sent to applicants. These are inputs to product and implementation work, not proof of current behavior.

## How To Use

- Use these files to understand source requirements, reporting obligations, payment-module expectations, and applicant-facing form references.
- Verify current implementation in code, schema, runtime config, tests, and current domain docs before making changes.
- For current payment behavior, prefer maintained docs linked from `docs/AGENTS.md`, `docs/features/payments-module.md`, and current finance/dashboard docs.
- For applicant form artifacts, check current document-generation/signing flows before assuming these PDFs are still the active template source.

## Cleanup Rule

When touching requirement files, classify whether the file is:

- current requirement source
- historical requirement source
- reference form/template artifact
- superseded by a current implementation or planning doc

Do not rewrite source artifacts into implementation instructions without verifying the current system.
