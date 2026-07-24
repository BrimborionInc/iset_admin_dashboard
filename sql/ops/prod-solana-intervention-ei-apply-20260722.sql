-- Guarded PROD repair for Solana Henderson's pending intervention revision.
-- Sets the blank approval-review EI status to the action plan's authoritative
-- EIClaimant=2 mapping ("EI Reach Back") on both compatibility metadata copies.
-- Does not record or imply Shelley's final decision.

DROP PROCEDURE IF EXISTS prod_solana_intervention_ei_repair_20260722;

DELIMITER //

CREATE PROCEDURE prod_solana_intervention_ei_repair_20260722()
BEGIN
  DECLARE v_target_count INT DEFAULT 0;
  DECLARE v_intervention_updates INT DEFAULT 0;
  DECLARE v_proposal_updates INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_target_count
    FROM iset_case c
    JOIN client cl ON cl.id = c.client_id
    JOIN iset_case_action_plan ap ON ap.case_id = c.id
    JOIN iset_case_intervention ci ON ci.case_id = c.id AND ci.action_plan_id = ap.id
    JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
    JOIN iset_review_workflow rw ON rw.proposal_id = p.id
   WHERE c.id = 41
     AND c.case_number = 'CASE-2026-0000041'
     AND cl.id = 41
     AND cl.first_name = 'Solana'
     AND cl.last_name = 'Henderson'
     AND ap.id = 23
     AND ap.status = 'active'
     AND ap.funding_stream = 'EI'
     AND ap.EIClaimant = 2
     AND ci.id = 301
     AND ci.status = 'submitted'
     AND NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.review.eiStatus'))), '') IS NULL
     AND p.id = 363
     AND p.proposal_kind = 'revision'
     AND p.review_status = 'submitted'
     AND NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.review.eiStatus'))), '') IS NULL
     AND rw.id = 40
     AND rw.workflow_type = 'intervention_revision'
     AND rw.current_stage = 'nwac_review'
     AND rw.nwac_decision IS NULL
     AND rw.nwac_decided_by_staff_profile_id IS NULL
   FOR UPDATE;

  IF v_target_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_intervention_ei_target';
  END IF;

  UPDATE iset_case_intervention
     SET metadata_json = JSON_SET(metadata_json, '$.review.eiStatus', 'EI Reach Back'),
         updated_at = NOW()
   WHERE id = 301
     AND case_id = 41
     AND action_plan_id = 23
     AND status = 'submitted'
     AND NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.review.eiStatus'))), '') IS NULL;

  SET v_intervention_updates = ROW_COUNT();
  IF v_intervention_updates <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_intervention_ei';
  END IF;

  UPDATE iset_intervention_proposal
     SET metadata_json = JSON_SET(metadata_json, '$.review.eiStatus', 'EI Reach Back'),
         updated_at = NOW()
   WHERE id = 363
     AND case_id = 41
     AND action_plan_id = 23
     AND legacy_intervention_id = 301
     AND proposal_kind = 'revision'
     AND review_status = 'submitted'
     AND NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.review.eiStatus'))), '') IS NULL;

  SET v_proposal_updates = ROW_COUNT();
  IF v_proposal_updates <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_proposal_ei';
  END IF;

  INSERT INTO iset_case_event
    (case_id, event_type, summary, payload_json, occurred_at, actor_staff_profile_id, actor_user_id, source_system)
  VALUES (
    41,
    'data_repair',
    'Prefilled EI Reach Back on pending intervention revision.',
    JSON_OBJECT(
      'actionPlanId', 23,
      'revisionInterventionId', 301,
      'proposalId', 363,
      'reviewWorkflowId', 40,
      'field', 'review.eiStatus',
      'previousValue', '',
      'newValue', 'EI Reach Back',
      'authoritativeSource', 'iset_case_action_plan.EIClaimant=2',
      'reason', 'Manual-import intervention review did not prefill the structured EI eligibility field.'
    ),
    NOW(3),
    NULL,
    NULL,
    'codex_prod_sql'
  );

  COMMIT;

  SELECT v_intervention_updates AS updated_intervention_count,
         v_proposal_updates AS updated_proposal_count;
END//

DELIMITER ;

CALL prod_solana_intervention_ei_repair_20260722();

DROP PROCEDURE IF EXISTS prod_solana_intervention_ei_repair_20260722;

SELECT
  ci.id AS revision_intervention_id,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.review.eiStatus')) AS intervention_ei_status,
  p.id AS proposal_id,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.review.eiStatus')) AS proposal_ei_status,
  rw.id AS review_workflow_id,
  rw.current_stage,
  rw.nwac_decision,
  rw.nwac_decided_by_staff_profile_id
FROM iset_case_intervention ci
JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
JOIN iset_review_workflow rw ON rw.proposal_id = p.id
WHERE ci.id = 301
  AND p.id = 363
  AND rw.id = 40;

SELECT
  id,
  case_id,
  event_type,
  summary,
  occurred_at,
  source_system
FROM iset_case_event
WHERE case_id = 41
  AND event_type = 'data_repair'
  AND summary = 'Prefilled EI Reach Back on pending intervention revision.'
ORDER BY id DESC
LIMIT 1;
