-- Read-only preview for Application 11 assessment decision-context repair.
-- Purpose: verify the stale scoped applicationDecisionLetters["11"].assessment_nwac_review_status
-- is still "approve" while the authoritative application/assessment state resolves to denial.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-application-11-assessment-context-repair-preview-20260706.sql

SELECT
  'repair_candidate' AS section,
  a.id AS application_id,
  c.id AS case_id,
  c.case_number,
  s.reference_number,
  a.status AS application_status,
  a.lifecycle_status,
  a.decision_outcome,
  aa.recommendation,
  aa.nwac_review,
  aa.nwac_reason,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status')) AS current_scoped_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.assessment_nwac_review_status')) AS current_root_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".decisionLetterSent.denial')) AS denial_letter_sent_at,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".decisionLetterSent.approval')) AS approval_letter_sent_at,
  SHA2(CAST(c.case_context_json AS CHAR), 256) AS case_context_sha256_before
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
JOIN iset_application_assessment aa ON aa.application_id = a.id
WHERE a.id = 11
  AND c.id = 93;

SELECT
  'blocking_condition' AS section,
  CASE
    WHEN a.id IS NULL THEN 'application_missing'
    WHEN c.id IS NULL THEN 'case_missing'
    WHEN aa.id IS NULL THEN 'assessment_missing'
    WHEN rw.id IS NOT NULL THEN 'active_review_workflow_exists'
    WHEN a.status <> 'completed' THEN 'application_status_changed'
    WHEN a.lifecycle_status <> 'closed' THEN 'application_lifecycle_changed'
    WHEN a.decision_outcome <> 'denied' THEN 'application_outcome_changed'
    WHEN aa.recommendation <> 'no_recommend' THEN 'assessment_recommendation_changed'
    WHEN aa.nwac_review <> 'agree' THEN 'assessment_agreement_changed'
    WHEN JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status')) <> 'approve' THEN 'scoped_review_status_not_expected_stale_value'
    WHEN JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".decisionLetterSent.denial')) IS NULL THEN 'denial_letter_sent_context_missing'
    ELSE NULL
  END AS blocker
FROM iset_application a
LEFT JOIN iset_case c ON c.id = a.case_id
LEFT JOIN iset_application_assessment aa ON aa.application_id = a.id
LEFT JOIN iset_review_workflow rw
  ON rw.workflow_type = 'application_assessment'
 AND rw.application_id = a.id
 AND rw.archived_at IS NULL
WHERE a.id = 11
  AND (
    c.id IS NULL
    OR aa.id IS NULL
    OR rw.id IS NOT NULL
    OR c.id <> 93
    OR a.status <> 'completed'
    OR a.lifecycle_status <> 'closed'
    OR a.decision_outcome <> 'denied'
    OR aa.recommendation <> 'no_recommend'
    OR aa.nwac_review <> 'agree'
    OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status')) <> 'approve'
    OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."11".decisionLetterSent.denial')) IS NULL
  );

SELECT
  'post_repair_projection' AS section,
  JSON_UNQUOTE(JSON_EXTRACT(
    JSON_SET(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status', 'reject'),
    '$.applicationDecisionLetters."11".assessment_nwac_review_status'
  )) AS projected_scoped_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(
    JSON_SET(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status', 'reject'),
    '$.applicationDecisionLetters."11".decisionLetterSent.denial'
  )) AS projected_denial_letter_sent_at,
  SHA2(CAST(JSON_SET(c.case_context_json, '$.applicationDecisionLetters."11".assessment_nwac_review_status', 'reject') AS CHAR), 256) AS projected_case_context_sha256_after
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
WHERE a.id = 11
  AND c.id = 93;
