-- Read-only PROD audit for the two-step Regional Manager review rollout.
-- Purpose: find workflow/status/document damage independently of individual feedback reports.
-- Run with: bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-two-step-review-audit-preview-20260705.sql

SELECT
  'runtime_flag' AS section,
  scope,
  k,
  JSON_PRETTY(v) AS value_json,
  updated_at
FROM iset_runtime_config
WHERE scope = 'feature_flags'
  AND k = 'workflow.two_step_rm_review.enabled';

SELECT
  'workflow_stage_counts' AS section,
  workflow_type,
  current_stage,
  current_owner_role,
  COUNT(*) AS row_count
FROM iset_review_workflow
WHERE archived_at IS NULL
GROUP BY workflow_type, current_stage, current_owner_role
ORDER BY workflow_type, current_stage, current_owner_role;

SELECT
  'invalid_workflow_values' AS section,
  id,
  workflow_type,
  subject_key,
  current_stage,
  current_owner_role,
  case_id,
  application_id,
  intervention_id,
  proposal_id,
  created_at,
  updated_at
FROM iset_review_workflow
WHERE archived_at IS NULL
  AND (
    workflow_type NOT IN ('application_assessment', 'intervention_proposal', 'intervention_revision')
    OR current_stage NOT IN ('rm_review', 'nwac_review', 'returned_to_rm', 'returned_to_submitter', 'final_decision_recorded', 'withdrawn')
  )
ORDER BY id;

SELECT
  'application_workflow_status_mismatch' AS section,
  rw.id AS workflow_id,
  rw.subject_key,
  rw.current_stage,
  rw.current_owner_role,
  rw.submitted_at,
  rw.rm_reviewed_at,
  rw.nwac_decision,
  a.id AS application_id,
  a.case_id,
  c.case_number,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  a.decision_outcome,
  ca.id AS assessment_id,
  submitter.email AS submitted_by_email,
  rm.email AS rm_reviewer_email,
  decider.email AS decision_email,
  rw.updated_at
FROM iset_review_workflow rw
JOIN iset_application a ON a.id = rw.application_id
LEFT JOIN iset_case c ON c.id = a.case_id
LEFT JOIN iset_application_assessment ca ON ca.application_id = a.id
LEFT JOIN staff_profiles submitter ON submitter.id = rw.submitted_by_staff_profile_id
LEFT JOIN staff_profiles rm ON rm.id = rw.rm_reviewed_by_staff_profile_id
LEFT JOIN staff_profiles decider ON decider.id = rw.nwac_decided_by_staff_profile_id
WHERE rw.archived_at IS NULL
  AND rw.workflow_type = 'application_assessment'
  AND (
    (rw.current_stage IN ('rm_review', 'nwac_review', 'returned_to_rm')
      AND COALESCE(a.lifecycle_status, a.status) <> 'pending_decision')
    OR (rw.current_stage = 'returned_to_submitter'
      AND COALESCE(a.lifecycle_status, a.status) <> 'in_review')
    OR (rw.current_stage = 'final_decision_recorded'
      AND (a.decision_outcome IS NULL OR a.decision_outcome = ''))
    OR ca.id IS NULL
  )
ORDER BY rw.updated_at DESC, rw.id DESC
LIMIT 100;

SELECT
  'application_pending_decision_missing_workflow' AS section,
  a.id AS application_id,
  a.case_id,
  c.case_number,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  a.decision_outcome,
  ca.id AS assessment_id,
  sp.email AS assigned_staff_email,
  a.created_at,
  a.updated_at
FROM iset_application a
JOIN iset_application_assessment ca ON ca.application_id = a.id
LEFT JOIN iset_case c ON c.id = a.case_id
LEFT JOIN staff_profiles sp ON sp.id = c.assigned_staff_profile_id
LEFT JOIN iset_review_workflow rw
  ON rw.workflow_type = 'application_assessment'
 AND rw.application_id = a.id
 AND rw.archived_at IS NULL
WHERE COALESCE(a.lifecycle_status, a.status) = 'pending_decision'
  AND a.updated_at >= '2026-06-20 00:00:00'
  AND rw.id IS NULL
ORDER BY a.updated_at DESC, a.id DESC
LIMIT 100;

SELECT
  'intervention_workflow_status_mismatch' AS section,
  rw.id AS workflow_id,
  rw.workflow_type,
  rw.subject_key,
  rw.current_stage,
  rw.current_owner_role,
  rw.submitted_at,
  rw.rm_reviewed_at,
  rw.nwac_decision,
  rw.case_id,
  rw.intervention_id,
  rw.proposal_id,
  c.case_number,
  ci.status AS intervention_status,
  ci.delivery_status AS intervention_delivery_status,
  p.review_status AS proposal_review_status,
  p.proposal_kind,
  submitter.email AS submitted_by_email,
  rm.email AS rm_reviewer_email,
  decider.email AS decision_email,
  rw.updated_at
FROM iset_review_workflow rw
LEFT JOIN iset_case c ON c.id = rw.case_id
LEFT JOIN iset_case_intervention ci ON ci.id = rw.intervention_id
LEFT JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
LEFT JOIN staff_profiles submitter ON submitter.id = rw.submitted_by_staff_profile_id
LEFT JOIN staff_profiles rm ON rm.id = rw.rm_reviewed_by_staff_profile_id
LEFT JOIN staff_profiles decider ON decider.id = rw.nwac_decided_by_staff_profile_id
WHERE rw.archived_at IS NULL
  AND rw.workflow_type IN ('intervention_proposal', 'intervention_revision')
  AND (
    (rw.proposal_id IS NOT NULL AND p.id IS NULL)
    OR (rw.intervention_id IS NOT NULL AND ci.id IS NULL)
    OR (rw.current_stage IN ('rm_review', 'nwac_review', 'returned_to_rm')
      AND COALESCE(p.review_status, ci.status) NOT IN ('submitted', 'in_review'))
    OR (rw.current_stage = 'returned_to_submitter'
      AND COALESCE(p.review_status, ci.status) NOT IN ('changes_requested', 'draft'))
    OR (rw.current_stage = 'final_decision_recorded'
      AND COALESCE(p.review_status, ci.status) NOT IN ('approved', 'rejected', 'changes_requested'))
  )
ORDER BY rw.updated_at DESC, rw.id DESC
LIMIT 100;

SELECT
  'proposal_missing_workflow' AS section,
  p.id AS proposal_id,
  p.proposal_kind,
  p.legacy_intervention_id,
  p.source_intervention_id,
  p.case_id,
  c.case_number,
  p.review_status,
  p.submitted_by_staff_profile_id,
  sp.email AS submitted_by_email,
  p.submitted_at,
  p.updated_at
FROM iset_intervention_proposal p
LEFT JOIN iset_case c ON c.id = p.case_id
LEFT JOIN staff_profiles sp ON sp.id = p.submitted_by_staff_profile_id
LEFT JOIN iset_review_workflow rw
  ON rw.archived_at IS NULL
 AND rw.workflow_type = CASE
   WHEN p.proposal_kind = 'revision' OR p.source_intervention_id IS NOT NULL
     THEN 'intervention_revision'
   ELSE 'intervention_proposal'
 END
 AND rw.proposal_id = p.id
WHERE p.archived_at IS NULL
  AND p.review_status IN ('submitted', 'in_review')
  AND p.updated_at >= '2026-06-20 00:00:00'
  AND rw.id IS NULL
ORDER BY p.updated_at DESC, p.id DESC
LIMIT 100;

SELECT
  'proposal_submitted_at_mismatch' AS section,
  rw.id AS workflow_id,
  rw.workflow_type,
  rw.subject_key,
  rw.current_stage,
  rw.submitted_at AS workflow_submitted_at,
  rw.rm_reviewed_at AS workflow_rm_reviewed_at,
  rw.nwac_decided_at AS workflow_decided_at,
  p.id AS proposal_id,
  p.review_status,
  p.submitted_at AS proposal_submitted_at,
  p.reviewed_at AS proposal_reviewed_at,
  p.updated_at AS proposal_updated_at,
  TIMESTAMPDIFF(SECOND, rw.submitted_at, p.submitted_at) AS submitted_delta_seconds
FROM iset_review_workflow rw
JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
WHERE rw.archived_at IS NULL
  AND rw.workflow_type IN ('intervention_proposal', 'intervention_revision')
  AND rw.submitted_at >= '2026-06-20 00:00:00'
  AND p.submitted_at IS NOT NULL
  AND ABS(TIMESTAMPDIFF(SECOND, rw.submitted_at, p.submitted_at)) > 60
ORDER BY rw.id
LIMIT 100;

SELECT
  'legacy_intervention_missing_workflow' AS section,
  ci.id AS intervention_id,
  ci.case_id,
  c.case_number,
  ci.status AS intervention_status,
  ci.delivery_status,
  ci.created_by_staff_profile_id,
  sp.email AS created_by_email,
  ci.created_at,
  ci.updated_at
FROM iset_case_intervention ci
LEFT JOIN iset_case c ON c.id = ci.case_id
LEFT JOIN staff_profiles sp ON sp.id = ci.created_by_staff_profile_id
LEFT JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
LEFT JOIN iset_review_workflow rw
  ON rw.archived_at IS NULL
 AND rw.workflow_type = CASE
   WHEN JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.revision.sourceInterventionId')) IS NOT NULL
     OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.revision.source_intervention_id')) IS NOT NULL
     THEN 'intervention_revision'
   ELSE 'intervention_proposal'
 END
 AND rw.intervention_id = ci.id
WHERE p.id IS NULL
  AND ci.status IN ('submitted', 'in_review')
  AND ci.updated_at >= '2026-06-20 00:00:00'
  AND rw.id IS NULL
ORDER BY ci.updated_at DESC, ci.id DESC
LIMIT 100;

SELECT
  'application_workflow_missing_packet_document' AS section,
  rw.id AS workflow_id,
  rw.subject_key,
  rw.current_stage,
  rw.application_id,
  a.case_id,
  c.case_number,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  rw.submitted_at,
  rw.updated_at
FROM iset_review_workflow rw
JOIN iset_application a ON a.id = rw.application_id
LEFT JOIN iset_case c ON c.id = a.case_id
WHERE rw.archived_at IS NULL
  AND rw.workflow_type = 'application_assessment'
  AND rw.current_stage IN ('rm_review', 'nwac_review', 'returned_to_rm', 'final_decision_recorded')
  AND rw.submitted_at >= '2026-06-20 00:00:00'
  AND NOT EXISTS (
    SELECT 1
    FROM iset_document d
    WHERE d.application_id = rw.application_id
      AND d.status = 'active'
      AND d.document_category IN ('case_assessment', 'case_assessment_approved')
  )
ORDER BY rw.updated_at DESC, rw.id DESC
LIMIT 100;

SELECT
  'intervention_workflow_missing_packet_document' AS section,
  rw.id AS workflow_id,
  rw.workflow_type,
  rw.subject_key,
  rw.current_stage,
  rw.intervention_id,
  rw.proposal_id,
  rw.case_id,
  c.case_number,
  rw.submitted_at,
  rw.updated_at
FROM iset_review_workflow rw
LEFT JOIN iset_case c ON c.id = rw.case_id
WHERE rw.archived_at IS NULL
  AND rw.workflow_type IN ('intervention_proposal', 'intervention_revision')
  AND rw.current_stage IN ('rm_review', 'nwac_review', 'returned_to_rm', 'final_decision_recorded')
  AND rw.submitted_at >= '2026-06-20 00:00:00'
  AND rw.intervention_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM iset_document_intervention di
    JOIN iset_document d ON d.id = di.document_id
    WHERE di.intervention_id = rw.intervention_id
      AND d.status = 'active'
      AND d.document_category IN ('case_assessment', 'case_assessment_approved')
  )
ORDER BY rw.updated_at DESC, rw.id DESC
LIMIT 100;
