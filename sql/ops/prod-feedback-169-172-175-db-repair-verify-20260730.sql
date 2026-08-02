-- Independent post-apply verification for
-- prod-feedback-169-172-175-db-repair-20260730.

SELECT DATABASE() AS db, @@hostname AS host, @@port AS port, CURRENT_USER() AS mysql_user;

SELECT id, status, lifecycle_status, closure_reason, closed_at,
       JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingTrigger')) AS reporting_trigger,
       JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingSeedSource')) AS reporting_seed_source,
       JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingOnlyDenied')) AS reporting_only_denied,
       JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.excludeFromCaseworkQueues')) AS excluded_from_casework,
       JSON_LENGTH(JSON_EXTRACT(case_context_json, '$.applicationReportingArtifacts')) AS reporting_artifact_count,
       CASE
         WHEN id = 109 THEN JSON_UNQUOTE(JSON_EXTRACT(
           case_context_json,
           '$.applicationDecisionLetters."27".assessment_nwac_review_status'))
         WHEN id = 160 THEN JSON_UNQUOTE(JSON_EXTRACT(
           case_context_json,
           '$.applicationDecisionLetters."90".assessment_nwac_review_status'))
         ELSE NULL
       END AS assessment_review_status
  FROM iset_case
 WHERE id IN (30, 109, 160)
 ORDER BY id;

SELECT id, case_id, status, lifecycle_status, decision_outcome,
       awaiting_reason, closure_reason, row_version
  FROM iset_application
 WHERE id IN (27, 90)
 ORDER BY id;

SELECT id, current_stage, current_owner_role, current_owner_staff_profile_id,
       submitted_by_staff_profile_id, rm_reviewed_by_staff_profile_id,
       nwac_decided_by_staff_profile_id, nwac_decided_at, nwac_decision,
       nwac_decision_note,
       JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.dataRepair.repairId')) AS repair_id
  FROM iset_review_workflow
 WHERE id IN (11, 26)
 ORDER BY id;

SELECT review_workflow_id, action, from_stage, to_stage, actor_staff_profile_id,
       actor_role,
       JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) AS repair_id,
       JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.feedbackReportId')) AS feedback_report_id,
       created_at
  FROM iset_review_workflow_event
 WHERE review_workflow_id IN (11, 26)
   AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) =
       'prod-feedback-169-172-175-db-repair-20260730'
 ORDER BY review_workflow_id, id;

SELECT 'removed_action_plans' AS check_name, COUNT(*) AS unexpected_rows
  FROM iset_case_action_plan
 WHERE id IN (145, 147)
UNION ALL
SELECT 'removed_interventions', COUNT(*)
  FROM iset_case_intervention
 WHERE id IN (314, 315, 316, 319, 320)
UNION ALL
SELECT 'removed_esdc_rows', COUNT(*)
  FROM esdc_participant_submission
 WHERE id IN (390, 406)
UNION ALL
SELECT 'removed_compatibility_proposal', COUNT(*)
  FROM iset_intervention_proposal
 WHERE id = 389
UNION ALL
SELECT 'remaining_denial_plans', COUNT(*)
  FROM iset_case_action_plan
 WHERE case_id IN (109, 160)
   AND name = 'Actions leading to denial'
   AND archived_at IS NULL;

SELECT ap.id, ap.case_id, ap.name, ap.status, ap.archived_at,
       ap.updated_at, COUNT(i.id) AS intervention_count
  FROM iset_case_action_plan ap
  LEFT JOIN iset_case_intervention i ON i.action_plan_id = ap.id
 WHERE ap.id = 146
 GROUP BY ap.id, ap.case_id, ap.name, ap.status, ap.archived_at, ap.updated_at;

SELECT id, case_id, event_type, summary,
       JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) AS repair_id,
       JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.feedbackReportId')) AS feedback_report_id,
       occurred_at, source_system
  FROM iset_case_event
 WHERE case_id IN (30, 109, 160)
   AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) =
       'prod-feedback-169-172-175-db-repair-20260730'
 ORDER BY case_id, id;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (169, 172, 175, 176)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name,
       changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (169, 172, 175)
   AND previous_status = 'triaging'
   AND new_status = 'closed'
 ORDER BY report_id, id;

SELECT report_id, author_name, author_email, created_at,
       LEFT(note_text, 240) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (169, 172, 175, 176)
   AND note_text LIKE '[prod-feedback-169-172-175-db-repair-20260730]%'
 ORDER BY report_id, id;

SELECT run_id, entity_type, COUNT(*) AS row_count,
       SUM(before_json IS NOT NULL) AS before_count,
       SUM(after_json IS NOT NULL) AS after_count
  FROM prod_feedback_169_172_175_repair_audit_20260730
 WHERE run_id = 'prod-feedback-169-172-175-db-repair-20260730'
 GROUP BY run_id, entity_type
 ORDER BY entity_type;
