-- PROD read-only inventory for Chrystal Loucks' two application records.
--
-- Live schema evidence captured 2026-08-06 from PROD iset_intake:
-- - client c: id, first_name, last_name
-- - iset_application a: id, submission_id, client_id, case_id, status,
--   lifecycle_status, decision_outcome, awaiting_reason, closure_reason,
--   version, row_version, created_at, updated_at
-- - iset_case k: id, case_number, client_id, status, lifecycle_status,
--   closure_reason, case_context_json
-- - iset_application_assessment aa: application_id, case_id,
--   esdc_eligibility
-- - iset_case_event e: id, case_id, event_type, summary, payload_json,
--   occurred_at, actor_staff_profile_id, actor_user_id, source_system
-- - iset_application_version av: id, application_id, version, change_summary,
--   created_by_staff_profile_id, created_by_user_id, created_by_name,
--   restored_from_version, created_at
-- - iset_case_action_plan p: id, case_id, application_id, name, status,
--   funding_stream, effective_date, closed_at, result_code, EIClaimant,
--   result_date, metadata_json, created_at, updated_at, archived_at
-- - iset_case_intervention i: id, case_id, action_plan_id,
--   intervention_code, status, delivery_status, start_date, end_date,
--   outcome_code, notes, metadata_json, created_at, updated_at, closed_at
-- - iset_case_reminder r: id, case_id, application_id, title, description,
--   category, status, due_at, completed_at, assigned_staff_profile_id,
--   metadata_json, created_at, updated_at, deleted_at
-- - iset_application_escalation x: id, application_id, case_id, state,
--   current_owner_role, current_owner_user_id, reason, disposition,
--   last_action_note, created_at, updated_at, resolved_at,
--   resolved_by_user_id, resolved_by_role
--
-- Join proof:
-- - a.client_id -> c.id (fk_iset_application_client_id)
-- - a.case_id -> k.id (fk_iset_application_case_id)
-- - k.client_id -> c.id (fk_iset_case_client_id)
-- - aa.application_id -> a.id (fk_iset_application_assessment_application)
-- - aa.case_id -> k.id (fk_iset_application_assessment_case)

SELECT
  c.id AS client_id,
  c.first_name,
  c.last_name,
  k.id AS case_id,
  k.case_number,
  k.status AS case_status,
  k.lifecycle_status AS case_lifecycle_status,
  k.closure_reason AS case_closure_reason,
  k.case_context_json,
  a.id AS application_id,
  a.submission_id,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  a.decision_outcome,
  a.awaiting_reason,
  a.closure_reason AS application_closure_reason,
  a.version AS application_version,
  a.row_version,
  a.created_at AS application_created_at,
  a.updated_at AS application_updated_at,
  aa.esdc_eligibility
FROM client AS c
JOIN iset_application AS a
  ON a.client_id = c.id
JOIN iset_case AS k
  ON k.id = a.case_id
 AND k.client_id = c.id
LEFT JOIN iset_application_assessment AS aa
  ON aa.application_id = a.id
 AND aa.case_id = k.id
WHERE c.first_name = 'Chrystal'
  AND c.last_name = 'Loucks'
ORDER BY a.created_at, a.id;

SELECT
  e.id AS event_id,
  e.case_id,
  e.event_type,
  e.summary,
  e.payload_json,
  e.occurred_at,
  e.actor_staff_profile_id,
  e.actor_user_id,
  e.source_system
FROM iset_case_event AS e
WHERE e.case_id = 69
ORDER BY e.occurred_at, e.id;

SELECT
  av.id AS application_version_id,
  av.application_id,
  av.version,
  av.change_summary,
  av.created_by_staff_profile_id,
  av.created_by_user_id,
  av.created_by_name,
  av.restored_from_version,
  av.created_at
FROM iset_application_version AS av
WHERE av.application_id IN (117, 140)
ORDER BY av.application_id, av.version, av.id;

SELECT
  p.id AS action_plan_id,
  p.case_id,
  p.application_id,
  p.name,
  p.status,
  p.funding_stream,
  p.effective_date,
  p.closed_at,
  p.result_code,
  p.EIClaimant,
  p.result_date,
  p.metadata_json,
  p.created_at,
  p.updated_at,
  p.archived_at
FROM iset_case_action_plan AS p
WHERE p.case_id = 69
ORDER BY p.created_at, p.id;

SELECT
  i.id AS intervention_id,
  i.case_id,
  i.action_plan_id,
  i.intervention_code,
  i.status,
  i.delivery_status,
  i.start_date,
  i.end_date,
  i.outcome_code,
  i.notes,
  i.metadata_json,
  i.created_at,
  i.updated_at,
  i.closed_at
FROM iset_case_intervention AS i
WHERE i.case_id = 69
ORDER BY i.created_at, i.id;

SELECT
  r.id AS reminder_id,
  r.case_id,
  r.application_id,
  r.title,
  r.description,
  r.category,
  r.status,
  r.due_at,
  r.completed_at,
  r.assigned_staff_profile_id,
  r.metadata_json,
  r.created_at,
  r.updated_at,
  r.deleted_at
FROM iset_case_reminder AS r
WHERE r.case_id = 69
ORDER BY r.created_at, r.id;

SELECT
  x.id AS escalation_id,
  x.application_id,
  x.case_id,
  x.state,
  x.current_owner_role,
  x.current_owner_user_id,
  x.reason,
  x.disposition,
  x.last_action_note,
  x.created_at,
  x.updated_at,
  x.resolved_at,
  x.resolved_by_user_id,
  x.resolved_by_role
FROM iset_application_escalation AS x
WHERE x.case_id = 69
ORDER BY x.created_at, x.id;
