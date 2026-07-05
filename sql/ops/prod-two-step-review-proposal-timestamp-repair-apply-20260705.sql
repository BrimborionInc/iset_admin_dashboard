-- Guarded apply for two-step review proposal timestamp repair.
-- Do not run without explicit current Bill approval.
-- Repair action: reset proposal 339 submitted_at to workflow 13 submitted_at.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-two-step-review-proposal-timestamp-repair-apply-20260705.sql

START TRANSACTION;

SELECT
  'pre_repair' AS section,
  rw.id AS workflow_id,
  rw.submitted_at AS expected_submitted_at,
  p.id AS proposal_id,
  p.review_status,
  p.submitted_at AS current_proposal_submitted_at,
  p.reviewed_at AS proposal_reviewed_at,
  p.updated_at AS proposal_updated_at
FROM iset_review_workflow rw
JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
WHERE rw.id = 13
  AND rw.proposal_id = 339
  AND rw.intervention_id = 220;

UPDATE iset_intervention_proposal p
JOIN iset_review_workflow rw ON rw.id = 13
SET p.submitted_at = rw.submitted_at,
    p.updated_at = p.updated_at
WHERE p.id = 339
  AND rw.proposal_id = 339
  AND rw.intervention_id = 220
  AND rw.archived_at IS NULL
  AND rw.current_stage = 'final_decision_recorded'
  AND rw.submitted_at = '2026-06-30 18:29:16'
  AND p.review_status = 'approved'
  AND p.submitted_at = '2026-06-30 19:21:05'
  AND p.reviewed_at = '2026-06-30 19:21:05';

SELECT ROW_COUNT() AS updated_proposal_count;

SELECT
  'post_repair' AS section,
  rw.id AS workflow_id,
  rw.submitted_at AS expected_submitted_at,
  p.id AS proposal_id,
  p.review_status,
  p.submitted_at AS proposal_submitted_at,
  p.reviewed_at AS proposal_reviewed_at,
  p.updated_at AS proposal_updated_at,
  TIMESTAMPDIFF(SECOND, rw.submitted_at, p.submitted_at) AS submitted_delta_seconds
FROM iset_review_workflow rw
JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
WHERE rw.id = 13
  AND rw.proposal_id = 339
  AND rw.intervention_id = 220;

COMMIT;
