-- Apply data cleanup for the 2026-06-22 PATH patch bundle.
-- Run after the app/portal code patch is deployed.
-- The predicates intentionally match the preview script.

START TRANSACTION;

UPDATE iset_application a
   SET a.docs_requested_active = 0,
       a.docs_requested_cleared_at = COALESCE(a.docs_requested_cleared_at, NOW()),
       a.updated_at = NOW(),
       a.row_version = a.row_version + 1
 WHERE a.docs_requested_active = 1
   AND (
     LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.status, '')), '-', '_'), ' ', '_')) IN
       ('approved','completed','complete','rejected','declined','denied','withdrawn','cancelled','closed','archived')
     OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.lifecycle_status, '')), '-', '_'), ' ', '_')) IN ('closed','archived')
   );

SELECT ROW_COUNT() AS terminal_document_requests_cleared;

UPDATE iset_case_reminder r
JOIN iset_case c ON c.id = r.case_id
   SET r.status = 'cancelled',
       r.deleted_at = COALESCE(r.deleted_at, CURRENT_TIMESTAMP),
       r.updated_at = CURRENT_TIMESTAMP
 WHERE r.deleted_at IS NULL
   AND r.status = 'open'
   AND (
     LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.status, '')), '-', '_'), ' ', '_')) IN
       ('closed','completed','cancelled','withdrawn','rejected','archived')
     OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.lifecycle_status, '')), '-', '_'), ' ', '_')) IN ('closed','archived')
   );

SELECT ROW_COUNT() AS terminal_case_reminders_cancelled;

UPDATE iset_application a
JOIN iset_application_assessment aa ON aa.application_id = a.id
   SET a.decision_outcome = 'approved',
       a.updated_at = NOW(),
       a.row_version = a.row_version + 1
 WHERE LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.status, '')), '-', '_'), ' ', '_')) = 'completed'
   AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.lifecycle_status, '')), '-', '_'), ' ', '_')) = 'closed'
   AND (a.decision_outcome IS NULL OR TRIM(a.decision_outcome) = '')
   AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(aa.recommendation, '')), '-', '_'), ' ', '_')) IN ('recommend','recommended','approve','approved')
   AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(aa.nwac_review, '')), '-', '_'), ' ', '_')) IN ('agree','approved','approve','accepted','accept')
   AND EXISTS (
     SELECT 1
       FROM iset_document d
      WHERE d.application_id = a.id
        AND d.status = 'active'
        AND d.document_category IN ('assessment_approval_letter', 'funding_agreement')
   );

SELECT ROW_COUNT() AS completed_approved_decision_outcomes_backfilled;

UPDATE iset_document d
LEFT JOIN funding_overview_version_documents fovd ON fovd.document_id = d.id
   SET d.status = 'archived',
       d.updated_at = NOW()
 WHERE d.status = 'active'
   AND d.document_category = 'financial_overview'
   AND JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.generated_kind')) = 'signed_form'
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.funding_overview_version_id')) AS UNSIGNED) IS NOT NULL
   AND fovd.document_id IS NULL;

SELECT ROW_COUNT() AS duplicate_signed_financial_overviews_archived;

COMMIT;
