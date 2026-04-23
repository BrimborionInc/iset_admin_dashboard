-- One-off PROD data repair for application ISET-20260409-123477.
-- Purpose: force step-13 / step-14 workspace hydration onto the denied path for a single inconsistent PROD record.
-- The application row already records `rejected` / `denied`, and the case context already records
-- `assessment_nwac_review_status = reject`, but the live workspace continued to render the approval path.
-- This guarded one-off also sets the persisted assessment assurance field to `disagree` so any fallback logic
-- still resolves the file to the denied path, then bumps the application row version to force a fresh hydrate.

START TRANSACTION;

UPDATE iset_case_assessment ca
JOIN iset_case c ON c.id = ca.case_id
JOIN iset_application a ON a.id = c.application_id
JOIN iset_application_submission s ON s.id = a.submission_id
SET ca.nwac_review = 'disagree'
WHERE s.reference_number = 'ISET-20260409-123477'
  AND a.status = 'rejected'
  AND a.decision_outcome = 'denied'
  AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.assessment_nwac_review_status')) = 'reject'
  AND ca.nwac_review <> 'disagree';

SELECT ROW_COUNT() AS assessment_rows_updated;

UPDATE iset_application a
JOIN iset_application_submission s ON s.id = a.submission_id
SET a.row_version = a.row_version + 1
WHERE s.reference_number = 'ISET-20260409-123477'
  AND a.status = 'rejected'
  AND a.decision_outcome = 'denied';

SELECT ROW_COUNT() AS application_rows_bumped;

COMMIT;
