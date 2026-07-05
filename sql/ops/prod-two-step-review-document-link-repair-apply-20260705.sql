-- Guarded apply for two-step review intervention packet document-link repair.
-- Do not run without explicit current Bill approval.
-- Repair action: insert missing iset_document_intervention links for generated PDFs
-- whose metadata already declares the exact target intervention.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-two-step-review-document-link-repair-apply-20260705.sql

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_two_step_expected_document_links (
  workflow_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  intervention_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (document_id, intervention_id)
);

INSERT INTO tmp_two_step_expected_document_links (workflow_id, document_id, intervention_id)
VALUES
  (12, 5087, 219),
  (12, 5089, 219),
  (13, 5112, 220),
  (13, 5113, 220),
  (13, 5142, 220);

CREATE TEMPORARY TABLE tmp_two_step_ready_document_links AS
SELECT
  expected.workflow_id,
  expected.document_id,
  expected.intervention_id
FROM tmp_two_step_expected_document_links expected
JOIN iset_review_workflow rw
  ON rw.id = expected.workflow_id
 AND rw.archived_at IS NULL
 AND rw.intervention_id = expected.intervention_id
JOIN iset_document d
  ON d.id = expected.document_id
 AND d.status = 'active'
 AND d.source = 'system_generated'
 AND d.document_category IN ('case_assessment', 'case_assessment_redline', 'case_assessment_approved')
 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS UNSIGNED) = expected.intervention_id;

SELECT
  'guard_ready_count' AS section,
  COUNT(*) AS ready_count,
  (SELECT COUNT(*) FROM tmp_two_step_expected_document_links) AS expected_count
FROM tmp_two_step_ready_document_links;

SELECT COUNT(*) INTO @two_step_ready_count
FROM tmp_two_step_ready_document_links;

SELECT COUNT(*) INTO @two_step_expected_count
FROM tmp_two_step_expected_document_links;

SELECT
  'guard_blockers' AS section,
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
FROM tmp_two_step_expected_document_links expected
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

INSERT IGNORE INTO iset_document_intervention (document_id, intervention_id, created_at)
SELECT ready.document_id, ready.intervention_id, NOW()
FROM tmp_two_step_ready_document_links ready
WHERE @two_step_ready_count = @two_step_expected_count;

SELECT ROW_COUNT() AS inserted_link_count;

SELECT
  'post_repair_links' AS section,
  expected.workflow_id,
  expected.document_id,
  expected.intervention_id,
  di.created_at AS link_created_at
FROM tmp_two_step_expected_document_links expected
LEFT JOIN iset_document_intervention di
  ON di.document_id = expected.document_id
 AND di.intervention_id = expected.intervention_id
ORDER BY expected.workflow_id, expected.document_id;

COMMIT;
