-- Read-only discovery audit for PROD new intervention proposal two-step review integrity.
-- Purpose: verify intervention_proposal workflow/status/queue/document/notification consistency
-- after the two-step review rollout and 2026-07-05 prevention release.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-intervention-proposal-two-step-discovery-20260706.sql

SELECT
  'runtime_flag' AS section,
  id,
  scope,
  k,
  JSON_PRETTY(v) AS value_json,
  updated_at
FROM iset_runtime_config
WHERE scope = 'feature_flags'
  AND k = 'workflow.two_step_rm_review.enabled';

SELECT
  'notification_settings' AS section,
  event,
  role,
  language,
  enabled,
  email_alert,
  bell_alert,
  updated_at
FROM notification_setting
WHERE event IN (
  'rm_review_requested',
  'rm_review_returned_to_submitter',
  'rm_review_changes_forwarded',
  'rm_review_submitted_to_nwac',
  'nwac_review_changes_requested'
)
ORDER BY event, role, language;

SELECT
  'proposal_status_counts' AS section,
  COALESCE(proposal_kind, '(null)') AS proposal_kind,
  COALESCE(review_status, '(null)') AS review_status,
  CASE WHEN archived_at IS NULL THEN 'active' ELSE 'archived' END AS archive_state,
  COUNT(*) AS row_count,
  MIN(created_at) AS earliest_created_at,
  MAX(created_at) AS latest_created_at,
  MIN(submitted_at) AS earliest_submitted_at,
  MAX(submitted_at) AS latest_submitted_at,
  MIN(reviewed_at) AS earliest_reviewed_at,
  MAX(reviewed_at) AS latest_reviewed_at
FROM iset_intervention_proposal
GROUP BY COALESCE(proposal_kind, '(null)'), COALESCE(review_status, '(null)'), CASE WHEN archived_at IS NULL THEN 'active' ELSE 'archived' END
ORDER BY archive_state, proposal_kind, review_status;

SELECT
  'active_workflow_stage_counts' AS section,
  current_stage,
  current_owner_role,
  COUNT(*) AS workflow_count,
  GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS workflow_ids
FROM iset_review_workflow
WHERE workflow_type = 'intervention_proposal'
  AND archived_at IS NULL
GROUP BY current_stage, current_owner_role
ORDER BY current_stage, current_owner_role;

SELECT
  'active_workflow_details' AS section,
  rw.id AS workflow_id,
  rw.subject_key,
  rw.current_stage,
  rw.current_owner_role,
  rw.current_owner_staff_profile_id,
  rw.case_id,
  c.case_number,
  rw.application_id,
  s.reference_number,
  rw.proposal_id,
  p.proposal_kind,
  p.review_status AS proposal_review_status,
  p.submitted_at AS proposal_submitted_at,
  p.reviewed_at AS proposal_reviewed_at,
  rw.intervention_id,
  ci.status AS intervention_status,
  ci.delivery_status AS intervention_delivery_status,
  c.assigned_staff_profile_id,
  assigned.display_name AS assigned_staff_name,
  assigned.primary_role AS assigned_staff_role,
  assigned.region_id AS assigned_staff_primary_region_id,
  c.portfolio_region_id,
  JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')) AS client_address_province,
  region_from_address.region_id AS address_region_id,
  region_from_address.name_en AS address_region_name,
  rw.submitted_by_staff_profile_id,
  submitter.display_name AS submitted_by_name,
  submitter.primary_role AS submitted_by_role,
  rw.submitted_at AS workflow_submitted_at,
  rw.rm_reviewed_by_staff_profile_id,
  rm_reviewer.display_name AS rm_reviewed_by_name,
  rw.rm_reviewed_at,
  rw.nwac_decided_by_staff_profile_id,
  nwac_decider.display_name AS nwac_decided_by_name,
  rw.nwac_decision,
  rw.nwac_decided_at,
  rw.created_at AS workflow_created_at,
  rw.updated_at AS workflow_updated_at
FROM iset_review_workflow rw
LEFT JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
LEFT JOIN iset_case_intervention ci ON ci.id = COALESCE(rw.intervention_id, p.legacy_intervention_id)
LEFT JOIN iset_case c ON c.id = rw.case_id
LEFT JOIN iset_application a ON a.id = rw.application_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN canada_region region_from_address
  ON LOWER(region_from_address.code) = LOWER(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')))
LEFT JOIN staff_profiles assigned ON assigned.id = c.assigned_staff_profile_id
LEFT JOIN staff_profiles submitter ON submitter.id = rw.submitted_by_staff_profile_id
LEFT JOIN staff_profiles rm_reviewer ON rm_reviewer.id = rw.rm_reviewed_by_staff_profile_id
LEFT JOIN staff_profiles nwac_decider ON nwac_decider.id = rw.nwac_decided_by_staff_profile_id
WHERE rw.workflow_type = 'intervention_proposal'
  AND rw.archived_at IS NULL
ORDER BY rw.id;

SELECT
  'active_workflow_integrity_issue' AS section,
  issue,
  workflow_id,
  subject_key,
  current_stage,
  current_owner_role,
  case_id,
  case_number,
  proposal_id,
  proposal_kind,
  proposal_review_status,
  intervention_id,
  intervention_status,
  workflow_submitted_at,
  proposal_submitted_at,
  submitted_delta_seconds
FROM (
  SELECT
    CASE
      WHEN p.id IS NULL THEN 'workflow_missing_proposal_row'
      WHEN ci.id IS NULL THEN 'workflow_missing_intervention_row'
      WHEN c.id IS NULL THEN 'workflow_missing_case_row'
      WHEN rw.current_stage NOT IN ('rm_review','nwac_review','returned_to_rm','returned_to_submitter','final_decision_recorded','withdrawn') THEN 'invalid_workflow_stage'
      WHEN rw.current_stage IN ('rm_review','returned_to_rm') AND COALESCE(rw.current_owner_role, '') <> 'Regional Manager' THEN 'rm_stage_owner_role_not_regional_manager'
      WHEN rw.current_stage = 'nwac_review' AND COALESCE(rw.current_owner_role, '') <> 'NWAC Administrator' THEN 'nwac_stage_owner_role_not_decision_maker'
      WHEN rw.current_stage = 'returned_to_submitter' AND COALESCE(rw.current_owner_role, '') <> 'Submitter' THEN 'returned_to_submitter_owner_role_not_submitter'
      WHEN rw.current_stage = 'final_decision_recorded' AND rw.current_owner_role IS NOT NULL THEN 'final_stage_has_current_owner_role'
      WHEN COALESCE(p.proposal_kind, 'new') <> 'new' OR p.source_intervention_id IS NOT NULL THEN 'new_proposal_workflow_points_to_revision_proposal'
      WHEN rw.current_stage IN ('rm_review','nwac_review','returned_to_rm') AND COALESCE(p.review_status, '') NOT IN ('submitted','in_review') THEN 'active_review_stage_proposal_status_not_submitted_or_in_review'
      WHEN rw.current_stage = 'returned_to_submitter' AND COALESCE(p.review_status, '') <> 'changes_requested' THEN 'returned_to_submitter_proposal_status_not_changes_requested'
      WHEN rw.current_stage = 'final_decision_recorded' AND COALESCE(p.review_status, '') NOT IN ('approved','rejected') THEN 'final_stage_proposal_status_not_terminal'
      WHEN rw.current_stage IN ('nwac_review','returned_to_rm','returned_to_submitter','final_decision_recorded') AND (rw.rm_reviewed_by_staff_profile_id IS NULL OR rw.rm_reviewed_at IS NULL) THEN 'post_rm_stage_missing_rm_signoff'
      WHEN rw.current_stage = 'returned_to_rm' AND COALESCE(rw.nwac_decision, '') <> 'changes_requested' THEN 'returned_to_rm_missing_decision_maker_change_request'
      WHEN rw.current_stage = 'final_decision_recorded' AND (rw.nwac_decision IS NULL OR rw.nwac_decided_at IS NULL OR rw.nwac_decided_by_staff_profile_id IS NULL) THEN 'final_stage_missing_decision_maker_evidence'
      WHEN rw.submitted_at IS NULL THEN 'workflow_submitted_at_missing'
      WHEN p.review_status IN ('submitted','in_review','changes_requested','approved','rejected') AND p.submitted_at IS NULL THEN 'proposal_submitted_at_missing'
      WHEN rw.submitted_at IS NOT NULL AND p.submitted_at IS NOT NULL AND ABS(TIMESTAMPDIFF(SECOND, rw.submitted_at, p.submitted_at)) > 300 THEN 'proposal_submitted_at_drift_from_workflow'
      ELSE NULL
    END AS issue,
    rw.id AS workflow_id,
    rw.subject_key,
    rw.current_stage,
    rw.current_owner_role,
    rw.case_id,
    c.case_number,
    rw.proposal_id,
    p.proposal_kind,
    p.review_status AS proposal_review_status,
    rw.intervention_id,
    ci.status AS intervention_status,
    rw.submitted_at AS workflow_submitted_at,
    p.submitted_at AS proposal_submitted_at,
    TIMESTAMPDIFF(SECOND, rw.submitted_at, p.submitted_at) AS submitted_delta_seconds
  FROM iset_review_workflow rw
  LEFT JOIN iset_intervention_proposal p ON p.id = rw.proposal_id
  LEFT JOIN iset_case_intervention ci ON ci.id = COALESCE(rw.intervention_id, p.legacy_intervention_id)
  LEFT JOIN iset_case c ON c.id = rw.case_id
  WHERE rw.workflow_type = 'intervention_proposal'
    AND rw.archived_at IS NULL
) issues
WHERE issue IS NOT NULL
ORDER BY workflow_id, issue;

SELECT
  'legacy_or_stranded_proposal_candidate' AS section,
  p.id AS proposal_id,
  p.proposal_kind,
  p.review_status,
  p.case_id,
  c.case_number,
  p.application_id,
  s.reference_number,
  p.legacy_intervention_id,
  ci.status AS intervention_status,
  ci.delivery_status AS intervention_delivery_status,
  p.submitted_by_staff_profile_id,
  submitter.display_name AS submitted_by_name,
  submitter.primary_role AS submitted_by_role,
  p.submitted_at,
  p.created_at,
  CASE
    WHEN COALESCE(p.submitted_at, p.created_at) < '2026-06-20 00:00:00' THEN 'pre_two_step_activation_or_unknown'
    ELSE 'post_two_step_activation'
  END AS timing_bucket,
  active_rw.id AS active_workflow_id
FROM iset_intervention_proposal p
LEFT JOIN iset_review_workflow active_rw
  ON active_rw.workflow_type = 'intervention_proposal'
 AND active_rw.archived_at IS NULL
 AND (active_rw.proposal_id = p.id OR active_rw.intervention_id = p.legacy_intervention_id)
LEFT JOIN iset_case_intervention ci ON ci.id = p.legacy_intervention_id
LEFT JOIN iset_case c ON c.id = p.case_id
LEFT JOIN iset_application a ON a.id = p.application_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
LEFT JOIN staff_profiles submitter ON submitter.id = p.submitted_by_staff_profile_id
WHERE p.archived_at IS NULL
  AND COALESCE(p.proposal_kind, 'new') = 'new'
  AND p.source_intervention_id IS NULL
  AND p.review_status IN ('submitted','in_review','changes_requested')
  AND active_rw.id IS NULL
ORDER BY COALESCE(p.submitted_at, p.created_at), p.id;

SELECT
  'legacy_intervention_without_proposal_or_workflow' AS section,
  ci.id AS intervention_id,
  ci.case_id,
  c.case_number,
  ci.action_plan_id,
  ci.status,
  ci.delivery_status,
  ci.created_by_staff_profile_id,
  creator.display_name AS created_by_name,
  ci.created_at,
  ci.updated_at,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.revision.sourceInterventionId')) AS revision_source_intervention_id,
  p.id AS proposal_id,
  rw.id AS workflow_id
FROM iset_case_intervention ci
LEFT JOIN iset_intervention_proposal p
  ON p.legacy_intervention_id = ci.id
 AND p.archived_at IS NULL
LEFT JOIN iset_review_workflow rw
  ON rw.workflow_type = 'intervention_proposal'
 AND rw.archived_at IS NULL
 AND (rw.intervention_id = ci.id OR rw.proposal_id = p.id)
LEFT JOIN iset_case c ON c.id = ci.case_id
LEFT JOIN staff_profiles creator ON creator.id = ci.created_by_staff_profile_id
WHERE LOWER(COALESCE(ci.status, '')) IN ('submitted','in_review','changes_requested')
  AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.revision.sourceInterventionId')) IS NULL
  AND p.id IS NULL
  AND rw.id IS NULL
ORDER BY ci.updated_at, ci.id;

SELECT
  'active_duplicate_workflow_subject' AS section,
  subject_key,
  COUNT(*) AS active_workflow_count,
  GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS workflow_ids
FROM iset_review_workflow
WHERE workflow_type = 'intervention_proposal'
  AND archived_at IS NULL
GROUP BY subject_key
HAVING COUNT(*) > 1;

SELECT
  'missing_generated_packet_document_link' AS section,
  rw.id AS workflow_id,
  rw.current_stage,
  rw.case_id,
  rw.proposal_id,
  rw.intervention_id,
  d.id AS document_id,
  d.document_category,
  d.label,
  d.file_name,
  d.status AS document_status,
  d.source AS document_source,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS metadata_intervention_id,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.assessment_version_number')) AS metadata_version_number,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.assessment_variant')) AS metadata_variant,
  d.created_at,
  d.updated_at
FROM iset_review_workflow rw
JOIN iset_document d
  ON d.case_id = rw.case_id
 AND d.status = 'active'
 AND d.source = 'system_generated'
 AND d.document_category IN ('case_assessment', 'case_assessment_redline', 'case_assessment_approved')
 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS UNSIGNED) = rw.intervention_id
LEFT JOIN iset_document_intervention di
  ON di.document_id = d.id
 AND di.intervention_id = rw.intervention_id
WHERE rw.workflow_type = 'intervention_proposal'
  AND rw.archived_at IS NULL
  AND di.document_id IS NULL
ORDER BY rw.id, d.id;

SELECT
  'workflow_event_trace' AS section,
  rw.id AS workflow_id,
  rw.current_stage,
  rw.case_id,
  rw.proposal_id,
  rw.intervention_id,
  ee.event_type,
  COUNT(ee.id) AS event_count,
  GROUP_CONCAT(ee.id ORDER BY ee.captured_at SEPARATOR ',') AS event_ids,
  MIN(ee.captured_at) AS first_event_at,
  MAX(ee.captured_at) AS latest_event_at
FROM iset_review_workflow rw
LEFT JOIN iset_event_entry ee
  ON ee.subject_type = 'case'
 AND ee.subject_id = CAST(rw.case_id AS CHAR)
 AND ee.event_type IN (
   'rm_review_requested',
   'rm_review_submitted_to_nwac',
   'nwac_review_changes_requested',
   'rm_review_returned_to_submitter',
   'rm_review_changes_forwarded'
 )
 AND JSON_UNQUOTE(JSON_EXTRACT(ee.payload_json, '$.workflow_type')) = 'intervention_proposal'
 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ee.payload_json, '$.proposal_id')) AS UNSIGNED) = rw.proposal_id
WHERE rw.workflow_type = 'intervention_proposal'
  AND rw.archived_at IS NULL
GROUP BY rw.id, rw.current_stage, rw.case_id, rw.proposal_id, rw.intervention_id, ee.event_type
ORDER BY rw.id, ee.event_type;

SELECT
  'active_rm_review_routing_gap' AS section,
  rw.id AS workflow_id,
  rw.current_stage,
  rw.case_id,
  c.case_number,
  rw.proposal_id,
  rw.intervention_id,
  c.assigned_staff_profile_id,
  assigned.display_name AS assigned_staff_name,
  assigned.primary_role AS assigned_staff_role,
  assigned.region_id AS assigned_staff_primary_region_id,
  c.portfolio_region_id,
  JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')) AS client_address_province,
  address_region.region_id AS address_region_id,
  address_region.name_en AS address_region_name,
  (
    SELECT COUNT(*)
    FROM iset_event_entry ee
    WHERE ee.event_type = 'rm_review_requested'
      AND ee.subject_type = 'case'
      AND ee.subject_id = CAST(rw.case_id AS CHAR)
      AND JSON_UNQUOTE(JSON_EXTRACT(ee.payload_json, '$.workflow_type')) = 'intervention_proposal'
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ee.payload_json, '$.proposal_id')) AS UNSIGNED) = rw.proposal_id
  ) AS rm_review_requested_event_count,
  (
    SELECT COUNT(*)
    FROM iset_internal_notification n
    WHERE n.event_key = 'rm_review_requested'
      AND JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.caseId')) = CAST(rw.case_id AS CHAR)
      AND n.created_at >= DATE_SUB(rw.submitted_at, INTERVAL 10 MINUTE)
  ) AS rm_review_requested_notification_count_since_submit,
  CASE
    WHEN rw.current_stage NOT IN ('rm_review','returned_to_rm') THEN NULL
    WHEN COALESCE(c.portfolio_region_id, assigned.region_id) IS NULL THEN 'no_case_or_assigned_staff_region_for_rm_queue'
    WHEN (
      SELECT COUNT(*)
      FROM iset_event_entry ee
      WHERE ee.event_type = 'rm_review_requested'
        AND ee.subject_type = 'case'
        AND ee.subject_id = CAST(rw.case_id AS CHAR)
        AND JSON_UNQUOTE(JSON_EXTRACT(ee.payload_json, '$.workflow_type')) = 'intervention_proposal'
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ee.payload_json, '$.proposal_id')) AS UNSIGNED) = rw.proposal_id
    ) = 0 THEN 'rm_review_requested_event_missing'
    WHEN (
      SELECT COUNT(*)
      FROM iset_internal_notification n
      WHERE n.event_key = 'rm_review_requested'
        AND JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.caseId')) = CAST(rw.case_id AS CHAR)
        AND n.created_at >= DATE_SUB(rw.submitted_at, INTERVAL 10 MINUTE)
    ) = 0 THEN 'rm_review_requested_notification_missing'
    ELSE NULL
  END AS routing_issue
FROM iset_review_workflow rw
LEFT JOIN iset_case c ON c.id = rw.case_id
LEFT JOIN staff_profiles assigned ON assigned.id = c.assigned_staff_profile_id
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN canada_region address_region
  ON LOWER(address_region.code) = LOWER(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')))
WHERE rw.workflow_type = 'intervention_proposal'
  AND rw.archived_at IS NULL
  AND rw.current_stage IN ('rm_review','returned_to_rm')
HAVING routing_issue IS NOT NULL
ORDER BY rw.id;
