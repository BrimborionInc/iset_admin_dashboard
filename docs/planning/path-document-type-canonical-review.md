# PATH Document Type Canonical Review

Date: 2026-04-12

## Purpose

This review pack is meant to give NWAC a spreadsheet-friendly starting point for defining the canonical PATH document-type requirement.

It separates:

- current implementation truth in this repo snapshot
- known code/config mismatches
- open business decisions that should be confirmed explicitly instead of being inferred from old notes or current code

## Files

- Matrix: [path-document-type-canonical-review-matrix.csv](./path-document-type-canonical-review-matrix.csv)
- Issue register: [path-document-type-canonical-review-issues.csv](./path-document-type-canonical-review-issues.csv)

These CSVs are intended to open directly in Excel.

## How To Review

Use the matrix as the base catalog review.

- Filter `issue_flag = yes` first.
- Then filter `nwac_decision_required = yes`.
- Confirm the canonical code, label, scope, and whether the type should remain active.
- Confirm whether each flagged type is meant to be reusable across files/cases/applications or tied to a narrower business context.

Use the issue register as the implementation gap list.

- Each row states the current inconsistency.
- Each row includes the business question that should be answered by NWAC.
- After NWAC confirms the requirement, the code/config can be aligned to that decision.

## Important Modeling Note

In the current PATH model, document type is not the same thing as origin.

- `document_type` answers "what kind of document is this?"
- `source` answers "where did this stored file come from?"

Current source/origin values are:

- `application_submission`
- `manual_upload`
- `secure_message_attachment`
- `system_generated`

If NWAC wants formal grouping "by origin", that should be defined as a separate canonical crosswalk, not by overloading document type.

## Current Implementation Truth Used For This Review

This pack was built from the current repo snapshot, using:

- seeded `document_type` rows in [db/dump/LaptopTransfer.sql](../../db/dump/LaptopTransfer.sql)
- later add-type migration [20260317_0001_add_student_financial_assistance_document_type.sql](../../sql/migrations/20260317_0001_add_student_financial_assistance_document_type.sql)
- current server behavior in [isetadminserver.js](../../isetadminserver.js)
- current checklist configs in [src/server/config/checklists/iset-compliance.json](../../src/server/config/checklists/iset-compliance.json) and [src/server/config/checklists/iset-intervention.json](../../src/server/config/checklists/iset-intervention.json)
- current finance evidence mapping in [PaymentDetailWidget.jsx](../../src/pages/finance/widgets/PaymentDetailWidget.jsx)

Local MySQL was not running in this sandbox, so this is a repo-based review, not a live DB export.

## Initial Findings To Put In Front Of NWAC

1. The current seeded catalog contains `evidence_income` and `evidence_expense`, but checklist and finance code still reference `financial_records` and `financial_evidence`.
2. Several current seeded scopes do not match older design notes:
   - `case_assessment`
   - `funding_agreement`
   - `voided_cheque`
   - `receipt`
   - `alternate_payee_letter`
3. The schema supports `case` and `payment_packet` scopes, but the seeded catalog currently has no active rows using either scope.
4. `statement_of_account` is inactive in the catalog but still appears in finance evidence mapping.
5. `release_student_info` is inactive and appears to be legacy, but older notes still mention it.

## Recommended NWAC Decisions

1. Confirm the canonical names for income and expense evidence:
   - `evidence_income` / `evidence_expense`
   - or `financial_records` / `financial_evidence`
2. Confirm the canonical storage scope for:
   - `case_assessment`
   - `funding_agreement`
   - `voided_cheque`
   - `receipt`
   - `alternate_payee_letter`
3. Confirm whether PATH should actively use `case`-scoped document types in the catalog.
4. Confirm whether PATH should actively use `payment_packet`-scoped document types in the catalog.
5. Confirm whether `statement_of_account` should be retired, reactivated, or replaced by another canonical type.
6. Confirm whether `release_student_info` is retired or still part of the business model.

## Recommended Next Step After NWAC Review

Once NWAC marks the matrix and issue register:

- freeze the canonical catalog
- update code/config to match it
- remove stale aliases and stale planning references
- add a small migration/seed strategy so the catalog is reproducible from source, not only from a DB dump
