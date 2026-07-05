-- Read-only preview for two-step review proposal timestamp repair.
-- Purpose: verify proposal 339 before resetting its compatibility submitted_at
-- to the authoritative review workflow submit timestamp.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-two-step-review-proposal-timestamp-repair-preview-20260705.sql

SELECT
  'proposal_timestamp_repair_candidate' AS section,
  rw.id AS workflow_id,
  rw.workflow_type,
  rw.subject_key,
  rw.current_stage,
  rw.submitted_at AS expected_submitted_at,
  rw.rm_reviewed_at,
  rw.nwac_decided_at,
  p.id AS proposal_id,
  p.review_status,
  p.submitted_at AS current_proposal_submitted_at,
  p.reviewed_at AS proposal_reviewed_at,
  p.updated_at AS proposal_updated_at,
  TIMESTAMPDIFF(SECOND, rw.submitted_at, p.submitted_at) AS submitted_delta_seconds
FROM iset_review_workflow rw
JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
WHERE rw.id = 13
  AND rw.proposal_id = 339
  AND rw.intervention_id = 220;

SELECT
  'blocking_condition' AS section,
  CASE
    WHEN rw.id IS NULL THEN 'workflow_missing'
    WHEN rw.archived_at IS NOT NULL THEN 'workflow_archived'
    WHEN rw.current_stage <> 'final_decision_recorded' THEN 'workflow_not_final'
    WHEN rw.submitted_at <> '2026-06-30 18:29:16' THEN 'workflow_submitted_at_changed'
    WHEN p.id IS NULL THEN 'proposal_missing'
    WHEN p.review_status <> 'approved' THEN 'proposal_not_approved'
    WHEN p.submitted_at <> '2026-06-30 19:21:05' THEN 'proposal_submitted_at_not_expected_bad_value'
    WHEN p.reviewed_at <> '2026-06-30 19:21:05' THEN 'proposal_reviewed_at_changed'
    ELSE NULL
  END AS blocker
FROM iset_review_workflow rw
LEFT JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
WHERE rw.id = 13
  AND (
    rw.archived_at IS NOT NULL
    OR rw.current_stage <> 'final_decision_recorded'
    OR rw.submitted_at <> '2026-06-30 18:29:16'
    OR p.id IS NULL
    OR p.review_status <> 'approved'
    OR p.submitted_at <> '2026-06-30 19:21:05'
    OR p.reviewed_at <> '2026-06-30 19:21:05'
  );
