DROP PROCEDURE IF EXISTS repair_katrina_woodgate_intervention_amount_20260526;

DELIMITER //

CREATE PROCEDURE repair_katrina_woodgate_intervention_amount_20260526()
BEGIN
  DECLARE expected_amount DECIMAL(14,2) DEFAULT 10005.28;
  DECLARE ci_guard_count INT DEFAULT 0;
  DECLARE proposal_guard_count INT DEFAULT 0;
  DECLARE ci_updated_count INT DEFAULT 0;
  DECLARE proposal_updated_count INT DEFAULT 0;

  SELECT COUNT(*)
    INTO ci_guard_count
    FROM iset_case_intervention ci
    JOIN iset_case c ON c.id = ci.case_id
   WHERE ci.id = 21
     AND ci.case_id = 88
     AND c.client_id = 97
     AND c.case_number = 'MI-MNT3JPF0-5BFEF1'
     AND ci.intervention_code = 11
     AND ci.status = 'in_progress'
     AND ci.delivery_status = 'in_progress'
     AND ci.intervention_cost IS NULL
     AND ci.budget_amount IS NULL
     AND ci.approved_amount IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'auto_assessment'
     AND (
       SELECT ROUND(COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(j.line, '$.amount')) AS DECIMAL(14,2))), 0), 2)
       FROM JSON_TABLE(
         COALESCE(JSON_EXTRACT(ci.metadata_json, '$.costLines'), JSON_ARRAY()),
         '$[*]' COLUMNS (line JSON PATH '$')
       ) AS j
     ) = expected_amount;

  IF ci_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina Woodgate intervention row did not match expected pre-repair state.';
  END IF;

  SELECT COUNT(*)
    INTO proposal_guard_count
    FROM iset_intervention_proposal p
   WHERE p.id = 127
     AND p.case_id = 88
     AND p.legacy_intervention_id = 21
     AND p.proposal_kind = 'new'
     AND p.review_status = 'approved'
     AND p.intervention_code = 11
     AND p.proposed_cost = 0.00;

  IF proposal_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina Woodgate compatibility proposal did not match expected pre-repair state.';
  END IF;

  START TRANSACTION;

  UPDATE iset_case_intervention ci
     SET ci.budget_amount = expected_amount,
         ci.intervention_cost = expected_amount,
         ci.metadata_json = JSON_SET(COALESCE(ci.metadata_json, JSON_OBJECT()), '$.cost', expected_amount),
         ci.esdc_intervention_json = JSON_SET(COALESCE(ci.esdc_intervention_json, JSON_OBJECT()), '$.interventionCost', expected_amount),
         ci.updated_at = NOW()
   WHERE ci.id = 21
     AND ci.case_id = 88
     AND ci.intervention_code = 11
     AND ci.intervention_cost IS NULL
     AND ci.budget_amount IS NULL
     AND ci.approved_amount IS NULL;

  SET ci_updated_count = ROW_COUNT();

  IF ci_updated_count <> 1 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: intervention update did not update exactly one row.';
  END IF;

  UPDATE iset_intervention_proposal p
     SET p.proposed_cost = expected_amount,
         p.payload_json = JSON_SET(COALESCE(p.payload_json, JSON_OBJECT()), '$.proposedCost', expected_amount),
         p.metadata_json = JSON_SET(COALESCE(p.metadata_json, JSON_OBJECT()), '$.cost', expected_amount),
         p.updated_at = NOW()
   WHERE p.id = 127
     AND p.case_id = 88
     AND p.legacy_intervention_id = 21
     AND p.intervention_code = 11
     AND p.proposed_cost = 0.00;

  SET proposal_updated_count = ROW_COUNT();

  IF proposal_updated_count <> 1 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: proposal update did not update exactly one row.';
  END IF;

  COMMIT;

  SELECT
    ci_updated_count AS intervention_rows_updated,
    proposal_updated_count AS proposal_rows_updated,
    expected_amount AS repaired_amount;
END//

DELIMITER ;

CALL repair_katrina_woodgate_intervention_amount_20260526();

DROP PROCEDURE repair_katrina_woodgate_intervention_amount_20260526;
