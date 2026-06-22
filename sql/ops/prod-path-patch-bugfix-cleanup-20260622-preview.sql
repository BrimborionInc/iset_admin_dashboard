-- Preview data cleanup for the 2026-06-22 PATH patch bundle.
-- Read-only: returns the rows the apply script will touch.

SELECT
  'terminal_docs_requested_active' AS check_name,
  COUNT(*) AS row_count
FROM iset_application a
WHERE a.docs_requested_active = 1
  AND (
    LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.status, '')), '-', '_'), ' ', '_')) IN
      ('approved','completed','complete','rejected','declined','denied','withdrawn','cancelled','closed','archived')
    OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.lifecycle_status, '')), '-', '_'), ' ', '_')) IN ('closed','archived')
  );

SELECT
  a.id AS application_id,
  a.case_id,
  a.status,
  a.lifecycle_status,
  a.decision_outcome,
  a.docs_requested_at,
  a.docs_requested_source,
  JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id
FROM iset_application a
WHERE a.docs_requested_active = 1
  AND (
    LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.status, '')), '-', '_'), ' ', '_')) IN
      ('approved','completed','complete','rejected','declined','denied','withdrawn','cancelled','closed','archived')
    OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(a.lifecycle_status, '')), '-', '_'), ' ', '_')) IN ('closed','archived')
  )
ORDER BY a.id;

SELECT
  'open_reminders_on_terminal_cases' AS check_name,
  COUNT(*) AS row_count
FROM iset_case_reminder r
JOIN iset_case c ON c.id = r.case_id
WHERE r.deleted_at IS NULL
  AND r.status = 'open'
  AND (
    LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.status, '')), '-', '_'), ' ', '_')) IN
      ('closed','completed','cancelled','withdrawn','rejected','archived')
    OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.lifecycle_status, '')), '-', '_'), ' ', '_')) IN ('closed','archived')
  );

SELECT
  r.id AS reminder_id,
  r.case_id,
  r.application_id,
  r.category,
  r.title,
  r.due_at,
  c.status AS case_status,
  c.lifecycle_status AS case_lifecycle_status
FROM iset_case_reminder r
JOIN iset_case c ON c.id = r.case_id
WHERE r.deleted_at IS NULL
  AND r.status = 'open'
  AND (
    LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.status, '')), '-', '_'), ' ', '_')) IN
      ('closed','completed','cancelled','withdrawn','rejected','archived')
    OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.lifecycle_status, '')), '-', '_'), ' ', '_')) IN ('closed','archived')
  )
ORDER BY r.due_at, r.id;

SELECT
  'completed_approved_missing_decision_outcome' AS check_name,
  COUNT(*) AS row_count
FROM iset_application a
JOIN iset_application_assessment aa ON aa.application_id = a.id
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

SELECT
  a.id AS application_id,
  a.case_id,
  a.status,
  a.lifecycle_status,
  a.decision_outcome,
  aa.recommendation,
  aa.nwac_review,
  JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id
FROM iset_application a
JOIN iset_application_assessment aa ON aa.application_id = a.id
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
  )
ORDER BY a.id;

SELECT
  'unreferenced_active_signed_financial_overviews' AS check_name,
  COUNT(*) AS row_count
FROM iset_document d
LEFT JOIN funding_overview_version_documents fovd ON fovd.document_id = d.id
WHERE d.status = 'active'
  AND d.document_category = 'financial_overview'
  AND JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.generated_kind')) = 'signed_form'
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.funding_overview_version_id')) AS UNSIGNED) IS NOT NULL
  AND fovd.document_id IS NULL;

SELECT
  d.id AS document_id,
  d.application_id,
  d.case_id,
  d.file_name,
  d.created_at,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.funding_overview_version_id')) AS funding_overview_version_id,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.funding_overview_version_number')) AS funding_overview_version_number
FROM iset_document d
LEFT JOIN funding_overview_version_documents fovd ON fovd.document_id = d.id
WHERE d.status = 'active'
  AND d.document_category = 'financial_overview'
  AND JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.generated_kind')) = 'signed_form'
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.funding_overview_version_id')) AS UNSIGNED) IS NOT NULL
  AND fovd.document_id IS NULL
ORDER BY d.application_id, d.created_at;
