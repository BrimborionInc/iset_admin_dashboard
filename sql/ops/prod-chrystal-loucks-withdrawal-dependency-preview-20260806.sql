-- PROD read-only dependency proof for generated withdrawal plan 173 and
-- generated interventions 369/370. Every selected/filter column was verified
-- against live PROD DDL on 2026-08-06.

SELECT id, case_id, action_plan_id, application_id, readiness_status,
       submission_status, submitted_at, created_at, updated_at
  FROM esdc_participant_submission
 WHERE action_plan_id = 173
 ORDER BY id;

SELECT id, participant_submission_id, event_type, payload_checksum,
       actor_user_id, event_details, occurred_at
  FROM esdc_participant_submission_history
 WHERE participant_submission_id = 443
 ORDER BY occurred_at, id;

SELECT id, action_plan_id, case_id, status, deleted_at, created_at, updated_at
  FROM iset_case_action_item
 WHERE action_plan_id = 173
 ORDER BY id;

SELECT id, application_id, case_id, action_plan_id, source, status,
       created_at, updated_at
  FROM iset_document
 WHERE action_plan_id = 173
 ORDER BY id;

SELECT id, case_id, action_plan_id, application_id, legacy_intervention_id,
       source_intervention_id, proposal_kind, review_status, created_at,
       updated_at, archived_at
  FROM iset_intervention_proposal
 WHERE action_plan_id = 173
    OR legacy_intervention_id IN (369, 370)
    OR source_intervention_id IN (369, 370)
 ORDER BY id;

SELECT id, workflow_type, subject_key, case_id, application_id,
       action_plan_id, intervention_id, proposal_id, current_stage,
       archived_at, created_at, updated_at
  FROM iset_review_workflow
 WHERE action_plan_id = 173
    OR intervention_id IN (369, 370)
 ORDER BY id;

SELECT id, case_id, application_id, action_plan_id, intervention_id, title,
       status, created_at, updated_at, deleted_at
  FROM iset_case_reminder
 WHERE action_plan_id = 173
    OR intervention_id IN (369, 370)
 ORDER BY id;

SELECT id, case_id, case_intervention_id, amount, status, created_at,
       updated_at
  FROM finance_transaction
 WHERE case_intervention_id IN (369, 370)
 ORDER BY id;

SELECT document_id, intervention_id, created_at
  FROM iset_document_intervention
 WHERE intervention_id IN (369, 370)
 ORDER BY intervention_id, document_id;

SELECT id, case_id, client_id, intervention_id, status, created_at, updated_at
  FROM payment_packet
 WHERE intervention_id IN (369, 370)
 ORDER BY id;

SELECT id, payment_packet_id, intervention_id, status, created_at, updated_at
  FROM payment_packet_line
 WHERE intervention_id IN (369, 370)
 ORDER BY id;
