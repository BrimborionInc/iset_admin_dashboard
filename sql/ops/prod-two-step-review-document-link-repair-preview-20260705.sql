-- Read-only preview for two-step review intervention packet document-link repair.
-- Purpose: verify the exact generated PDFs that already declare the target intervention
-- in metadata but lack iset_document_intervention links.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-two-step-review-document-link-repair-preview-20260705.sql

SELECT
  'expected_document_links' AS section,
  expected.workflow_id,
  rw.workflow_type,
  rw.current_stage,
  rw.case_id AS workflow_case_id,
  rw.intervention_id AS workflow_intervention_id,
  rw.proposal_id AS workflow_proposal_id,
  expected.document_id,
  expected.intervention_id AS expected_intervention_id,
  d.case_id AS document_case_id,
  d.application_id AS document_application_id,
  d.document_category,
  d.label,
  d.file_name,
  d.status AS document_status,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS metadata_intervention_id,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.assessment_version_number')) AS metadata_version_number,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.assessment_variant')) AS metadata_variant,
  CASE WHEN di.document_id IS NULL THEN 0 ELSE 1 END AS link_exists,
  d.created_at,
  d.updated_at
FROM (
  SELECT 12 AS workflow_id, 5087 AS document_id, 219 AS intervention_id
  UNION ALL SELECT 12, 5089, 219
  UNION ALL SELECT 13, 5112, 220
  UNION ALL SELECT 13, 5113, 220
  UNION ALL SELECT 13, 5142, 220
) expected
JOIN iset_review_workflow rw ON rw.id = expected.workflow_id
LEFT JOIN iset_document d ON d.id = expected.document_id
LEFT JOIN iset_document_intervention di
  ON di.document_id = expected.document_id
 AND di.intervention_id = expected.intervention_id
ORDER BY expected.workflow_id, expected.document_id;

SELECT
  'blocking_condition' AS section,
  expected.workflow_id,
  expected.document_id,
  expected.intervention_id,
  CASE
    WHEN rw.id IS NULL THEN 'workflow_missing'
    WHEN rw.archived_at IS NOT NULL THEN 'workflow_archived'
    WHEN rw.intervention_id <> expected.intervention_id THEN 'workflow_intervention_mismatch'
    WHEN d.id IS NULL THEN 'document_missing'
    WHEN d.status <> 'active' THEN 'document_not_active'
    WHEN d.source <> 'system_generated' THEN 'document_not_system_generated'
    WHEN d.document_category NOT IN ('case_assessment', 'case_assessment_redline', 'case_assessment_approved') THEN 'unexpected_document_category'
    WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS UNSIGNED) <> expected.intervention_id THEN 'metadata_intervention_mismatch'
    ELSE NULL
  END AS blocker
FROM (
  SELECT 12 AS workflow_id, 5087 AS document_id, 219 AS intervention_id
  UNION ALL SELECT 12, 5089, 219
  UNION ALL SELECT 13, 5112, 220
  UNION ALL SELECT 13, 5113, 220
  UNION ALL SELECT 13, 5142, 220
) expected
LEFT JOIN iset_review_workflow rw ON rw.id = expected.workflow_id
LEFT JOIN iset_document d ON d.id = expected.document_id
WHERE rw.id IS NULL
   OR rw.archived_at IS NOT NULL
   OR rw.intervention_id <> expected.intervention_id
   OR d.id IS NULL
   OR d.status <> 'active'
   OR d.source <> 'system_generated'
   OR d.document_category NOT IN ('case_assessment', 'case_assessment_redline', 'case_assessment_approved')
   OR CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS UNSIGNED) <> expected.intervention_id
ORDER BY expected.workflow_id, expected.document_id;
