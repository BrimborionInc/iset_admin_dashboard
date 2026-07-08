-- Guarded apply for Application 11 assessment decision-context repair.
-- Do not run without explicit current Bill approval.
-- Repair action: change only applicationDecisionLetters["11"].assessment_nwac_review_status
-- from "approve" to "reject" on case 93 / application 11.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-application-11-assessment-context-repair-apply-20260706.sql

START TRANSACTION;

SELECT
  'pre_repair' AS section,
  a.id AS application_id,
  c.id AS case_id,
  c.case_number,
  s.reference_number,
  a.status AS application_status,
  a.lifecycle_status,
  a.decision_outcome,
  aa.recommendation,
  aa.nwac_review,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status')) AS current_scoped_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".decisionLetterSent.denial')) AS denial_letter_sent_at,
  SHA2(CAST(c.case_context_json AS CHAR), 256) AS case_context_sha256_before
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
JOIN iset_application_assessment aa ON aa.application_id = a.id
WHERE a.id = 11
  AND c.id = 93
FOR UPDATE;

UPDATE iset_case c
JOIN iset_application a ON a.case_id = c.id
JOIN iset_application_assessment aa ON aa.application_id = a.id
SET c.case_context_json = JSON_SET(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status', 'reject'),
    c.updated_at = c.updated_at
WHERE c.id = 93
  AND a.id = 11
  AND aa.application_id = 11
  AND a.status = 'completed'
  AND a.lifecycle_status = 'closed'
  AND a.decision_outcome = 'denied'
  AND aa.recommendation = 'no_recommend'
  AND aa.nwac_review = 'agree'
  AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status')) = 'approve'
  AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".decisionLetterSent.denial')) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM iset_review_workflow rw
     WHERE rw.workflow_type = 'application_assessment'
       AND rw.application_id = a.id
       AND rw.archived_at IS NULL
  );

SELECT ROW_COUNT() AS updated_case_context_count;

SELECT
  'post_repair' AS section,
  a.id AS application_id,
  c.id AS case_id,
  c.case_number,
  s.reference_number,
  a.status AS application_status,
  a.lifecycle_status,
  a.decision_outcome,
  aa.recommendation,
  aa.nwac_review,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status')) AS repaired_scoped_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".decisionLetterSent.denial')) AS denial_letter_sent_at,
  SHA2(CAST(c.case_context_json AS CHAR), 256) AS case_context_sha256_after
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
JOIN iset_application_assessment aa ON aa.application_id = a.id
WHERE a.id = 11
  AND c.id = 93;

COMMIT;
