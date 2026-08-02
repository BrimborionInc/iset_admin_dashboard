-- PROD discovery/preview for database-only repairs requested for feedback
-- #169, #172, and #175 (#176 is a duplicate of #175).
--
-- Read-only. Live DDL/full columns/indexes/FKs for every referenced table were
-- inspected in PROD before this artifact was written.

SELECT DATABASE() AS db, @@hostname AS host, @@port AS port, CURRENT_USER() AS mysql_user;

SELECT id, name, display_name, email, primary_role, status, region_id
  FROM staff_profiles
 WHERE id IN (50, 51, 55, 60, 5697, 995581)
 ORDER BY id;

SELECT id, report_type, severity, status, submitted_by_name, submitted_by_email,
       summary, submitted_at, updated_at
  FROM admin_feedback_report
 WHERE id IN (169, 172, 175, 176)
 ORDER BY id;

SELECT c.id AS case_id, c.case_number, c.status, c.lifecycle_status,
       c.closure_reason, c.stage, c.sub_stage, c.closed_at,
       c.assigned_staff_profile_id, c.open_intervention_count,
       c.total_intervention_count, c.updated_at
  FROM iset_case c
 WHERE c.id IN (30, 109, 160)
 ORDER BY c.id;

SELECT a.id AS application_id, a.case_id, a.status, a.lifecycle_status,
       a.decision_outcome, a.awaiting_reason, a.closure_reason, a.row_version,
       a.updated_at
  FROM iset_application a
 WHERE a.id IN (27, 90)
 ORDER BY a.id;

SELECT ca.id AS assessment_id, ca.case_id, ca.application_id,
       ca.recommendation, ca.nwac_review, ca.nwac_reason, ca.updated_at
  FROM iset_application_assessment ca
 WHERE ca.application_id IN (27, 90)
 ORDER BY ca.application_id;

SELECT rw.id, rw.workflow_type, rw.subject_key, rw.case_id, rw.application_id,
       rw.action_plan_id, rw.intervention_id, rw.proposal_id,
       rw.current_stage, rw.current_owner_role, rw.current_owner_staff_profile_id,
       rw.submitted_by_staff_profile_id, rw.submitted_at,
       rw.rm_reviewed_by_staff_profile_id, rw.rm_reviewed_at, rw.rm_review_note,
       rw.nwac_decided_by_staff_profile_id, rw.nwac_decided_at,
       rw.nwac_decision, rw.nwac_decision_note, rw.metadata_json,
       rw.archived_at, rw.updated_at
  FROM iset_review_workflow rw
 WHERE rw.id IN (11, 26)
 ORDER BY rw.id;

SELECT e.id, e.review_workflow_id, e.action, e.from_stage, e.to_stage,
       e.actor_staff_profile_id, e.actor_role, e.note, e.payload_json, e.created_at
  FROM iset_review_workflow_event e
 WHERE e.review_workflow_id IN (11, 26)
 ORDER BY e.review_workflow_id, e.id;

SELECT ap.id, ap.case_id, ap.application_id, ap.name, ap.status,
       ap.effective_date, ap.activated_at, ap.closed_at, ap.result_code,
       ap.result_date, ap.notes, ap.metadata_json, ap.archived_at,
       ap.created_at, ap.updated_at
  FROM iset_case_action_plan ap
 WHERE ap.id IN (145, 146, 147)
 ORDER BY ap.id;

SELECT i.id, i.case_id, i.action_plan_id, i.intervention_code, i.status,
       i.delivery_status, i.start_date, i.end_date, i.duration_days,
       i.intervention_cost, i.budget_amount, i.approved_amount, i.actual_amount,
       i.outcome_code, i.notes, i.metadata_json, i.esdc_intervention_json,
       i.created_by_staff_profile_id, i.closed_at, i.created_at, i.updated_at
  FROM iset_case_intervention i
 WHERE i.id IN (314, 315, 316, 319, 320)
 ORDER BY i.id;

SELECT eps.id, eps.case_id, eps.action_plan_id, eps.application_id,
       eps.readiness_status, eps.submission_status, eps.submitted_at,
       eps.payload_storage_key, eps.payload_checksum, eps.created_at, eps.updated_at
  FROM esdc_participant_submission eps
 WHERE eps.case_id IN (30, 109, 160)
    OR eps.action_plan_id IN (145, 146, 147)
    OR eps.application_id IN (27, 90)
 ORDER BY eps.case_id, eps.id;

SELECT ai.id, ai.case_id, ai.action_plan_id, ai.sequence, ai.title,
       ai.status, ai.completed_at, ai.deleted_at, ai.created_at, ai.updated_at
  FROM iset_case_action_item ai
 WHERE ai.action_plan_id IN (145, 146, 147)
 ORDER BY ai.action_plan_id, ai.id;

SELECT r.id, r.case_id, r.application_id, r.action_plan_id, r.intervention_id,
       r.title, r.category, r.status, r.due_at, r.deleted_at,
       r.created_at, r.updated_at
  FROM iset_case_reminder r
 WHERE r.case_id IN (30, 109, 160)
    OR r.application_id IN (27, 90)
    OR r.action_plan_id IN (145, 146, 147)
    OR r.intervention_id IN (314, 315, 316, 319, 320)
 ORDER BY r.case_id, r.id;

SELECT d.id, d.application_id, d.case_id, d.action_plan_id, d.source,
       d.file_name, d.label, d.status, d.document_category,
       d.signing_request_id, d.created_at, d.updated_at
  FROM iset_document d
 WHERE d.case_id IN (30, 109, 160)
    OR d.application_id IN (27, 90)
    OR d.action_plan_id IN (145, 146, 147)
 ORDER BY d.case_id, d.id;

SELECT di.document_id, di.intervention_id, di.created_at
  FROM iset_document_intervention di
 WHERE di.intervention_id IN (314, 315, 316, 319, 320)
 ORDER BY di.intervention_id, di.document_id;

SELECT p.id, p.case_id, p.action_plan_id, p.application_id,
       p.legacy_intervention_id, p.source_intervention_id,
       p.proposal_kind, p.review_status, p.title, p.intervention_code,
       p.proposed_cost, p.archived_at, p.created_at, p.updated_at
  FROM iset_intervention_proposal p
 WHERE p.case_id IN (30, 109, 160)
    OR p.action_plan_id IN (145, 146, 147)
    OR p.application_id IN (27, 90)
    OR p.legacy_intervention_id IN (314, 315, 316, 319, 320)
    OR p.source_intervention_id IN (314, 315, 316, 319, 320)
 ORDER BY p.case_id, p.id;

SELECT ft.id, ft.case_id, ft.case_intervention_id, ft.amount, ft.status,
       ft.transaction_date, ft.posted_at, ft.description, ft.created_at, ft.updated_at
  FROM finance_transaction ft
 WHERE ft.case_id IN (30, 109, 160)
    OR ft.case_intervention_id IN (314, 315, 316, 319, 320)
 ORDER BY ft.case_id, ft.id;

SELECT pp.id, pp.case_id, pp.intervention_id, pp.status, pp.follow_up_status,
       pp.submitted_at, pp.sent_at, pp.confirmed_at, pp.created_at, pp.updated_at
  FROM payment_packet pp
 WHERE pp.case_id IN (30, 109, 160)
    OR pp.intervention_id IN (314, 315, 316, 319, 320)
 ORDER BY pp.case_id, pp.id;

SELECT ppl.id, ppl.payment_packet_id, ppl.intervention_id, ppl.payment_type,
       ppl.amount, ppl.status, ppl.paid_at, ppl.created_at, ppl.updated_at
  FROM payment_packet_line ppl
 WHERE ppl.intervention_id IN (314, 315, 316, 319, 320)
    OR ppl.payment_packet_id IN (
      SELECT pp.id
        FROM payment_packet pp
       WHERE pp.case_id IN (30, 109, 160)
          OR pp.intervention_id IN (314, 315, 316, 319, 320)
    )
 ORDER BY ppl.payment_packet_id, ppl.id;

SELECT cs.id AS series_id, cs.case_id, cs.template_key, cs.created_at,
       cv.id AS version_id, cv.version_number, cv.status AS version_status,
       cv.sent_at, cv.signed_at, cv.effective_date, cv.created_at AS version_created_at
  FROM cfa_series cs
  LEFT JOIN cfa_version cv ON cv.series_id = cs.id
 WHERE cs.case_id IN (30, 109, 160)
 ORDER BY cs.case_id, cs.id, cv.version_number;

SELECT e.id, e.case_id, e.event_type, e.summary, e.payload_json,
       e.occurred_at, e.actor_staff_profile_id, e.source_system
  FROM iset_case_event e
 WHERE e.case_id IN (30, 109, 160)
 ORDER BY e.case_id, e.id DESC;

-- Avoid emitting the full case-context payload because it contains personal data.
-- Show only the known workflow/reporting paths relevant to these repairs.
SELECT c.id AS case_id,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.reportingTrigger')) AS reporting_trigger,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.reportingSeedSource')) AS reporting_seed_source,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.reportingDeniedAt')) AS reporting_denied_at,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.reportingOnlyDenied')) AS reporting_only_denied,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.reportingOnlyDeniedIneligible')) AS reporting_only_denied_ineligible,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.excludeFromCaseworkQueues')) AS exclude_from_casework_queues,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.fundingDecisionReasonCode')) AS root_funding_decision_reason_code,
       JSON_EXTRACT(c.case_context_json, '$.applicationReportingArtifacts.\"27\"') AS application_27_reporting_artifact,
       JSON_EXTRACT(c.case_context_json, '$.applicationReportingArtifacts.\"90\"') AS application_90_reporting_artifact,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAssessmentContexts.\"27\".assessment_nwac_review_status')) AS application_27_review_status,
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAssessmentContexts.\"90\".assessment_nwac_review_status')) AS application_90_review_status,
       JSON_KEYS(c.case_context_json) AS root_context_keys
  FROM iset_case c
 WHERE c.id IN (109, 160)
 ORDER BY c.id;
