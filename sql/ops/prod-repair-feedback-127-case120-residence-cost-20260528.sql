-- Quiet PROD data repair for feedback #127 / case 120.
-- Purpose: change only the identified $11,370 residence/meal-plan line from
-- LivingAllowance to ResidenceCost after Kelly's UI save failed.
--
-- Scope:
-- - iset_case_intervention 114, line f17c3a41-703b-4c64-804a-0c0562d44d49
-- - iset_case_intervention 115, same line
-- - iset_intervention_proposal 178 metadata cost-line copies, same line
-- - admin_feedback_* internal notes/status only

DROP PROCEDURE IF EXISTS prod_repair_feedback_127_case120_residence_cost;

DELIMITER //

CREATE PROCEDURE prod_repair_feedback_127_case120_residence_cost()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_status_from VARCHAR(32) DEFAULT NULL;
  DECLARE v_status_history_count INT DEFAULT 0;
  DECLARE v_note_127_count INT DEFAULT 0;
  DECLARE v_note_124_count INT DEFAULT 0;
  DECLARE v_repair_at DATETIME DEFAULT NULL;
  DECLARE v_actor_name VARCHAR(255) DEFAULT 'Codex';
  DECLARE v_actor_email VARCHAR(255) DEFAULT 'codex@openai.local';
  DECLARE v_line_id VARCHAR(64) DEFAULT 'f17c3a41-703b-4c64-804a-0c0562d44d49';

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_repair_at = NOW();

  START TRANSACTION;

  SELECT r127.status
    INTO v_status_from
    FROM admin_feedback_report r127
   WHERE r127.id = 127
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case c
    JOIN iset_case_intervention ci114
      ON ci114.id = 114
     AND ci114.case_id = c.id
     AND ci114.action_plan_id = 56
     AND ci114.status = 'approved'
     AND ci114.delivery_status = 'planned'
     AND ci114.intervention_code = 10
    JOIN iset_case_intervention ci115
      ON ci115.id = 115
     AND ci115.case_id = c.id
     AND ci115.action_plan_id = 56
     AND ci115.status = 'draft'
     AND ci115.intervention_code = 10
    JOIN iset_intervention_proposal p
      ON p.id = 178
     AND p.case_id = c.id
     AND p.action_plan_id = 56
     AND p.legacy_intervention_id = 115
     AND p.source_intervention_id = 114
     AND p.proposal_kind = 'revision'
     AND p.review_status = 'draft'
    JOIN admin_feedback_report r127
      ON r127.id = 127
     AND r127.submitted_by_email = 'k.hyde@keepersofthecircle.com'
   WHERE c.id = 120
     AND c.case_number = 'ISET-20260423-D2200B'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci114.metadata_json, '$.costLines[2].id')) = v_line_id
     AND JSON_UNQUOTE(JSON_EXTRACT(ci114.metadata_json, '$.costLines[2].type')) = 'LivingAllowance'
     AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ci114.metadata_json, '$.costLines[2].amount')) AS DECIMAL(14,2)) = 11370.00
     AND JSON_UNQUOTE(JSON_EXTRACT(ci115.metadata_json, '$.costLines[2].id')) = v_line_id
     AND JSON_UNQUOTE(JSON_EXTRACT(ci115.metadata_json, '$.costLines[2].type')) = 'LivingAllowance'
     AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ci115.metadata_json, '$.costLines[2].amount')) AS DECIMAL(14,2)) = 11370.00
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].id')) = v_line_id
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].type')) = 'LivingAllowance'
     AND CAST(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].amount')) AS DECIMAL(14,2)) = 11370.00
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].id')) = v_line_id
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].type')) = 'LivingAllowance'
     AND CAST(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].amount')) AS DECIMAL(14,2)) = 11370.00;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for feedback #127 case 120 residence-cost repair.';
  END IF;

  UPDATE iset_case_intervention
     SET metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.costLines[2].type', 'ResidenceCost',
           '$.costLines[2].payee.type', 'AccreditedEducationalTrainingInstitution',
           '$.costLines[2].payee.name', 'St. Laurence College',
           '$.costLines[2].payee.reference', '',
           '$.costLines[2].recurrence', JSON_OBJECT(
             'enabled', JSON_EXTRACT('false', '$'),
             'startDate', '',
             'endDate', '',
             'occurrences', '',
             'amountPerPeriod', ''
           ),
           '$.prodDataRepairFeedback127ResidenceCost20260528', JSON_OBJECT(
             'feedbackReportId', 127,
             'relatedFeedbackReportId', 124,
             'caseId', 120,
             'lineId', v_line_id,
             'previousType', 'LivingAllowance',
             'newType', 'ResidenceCost',
             'reason', 'Kelly Hyde could not save the UI correction for the residence/meal-plan line.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         updated_at = v_repair_at
   WHERE id IN (114, 115)
     AND case_id = 120
     AND action_plan_id = 56
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.costLines[2].id')) = v_line_id
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.costLines[2].type')) = 'LivingAllowance'
     AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.costLines[2].amount')) AS DECIMAL(14,2)) = 11370.00;

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Intervention metadata update failed for feedback #127 repair.';
  END IF;

  UPDATE iset_intervention_proposal
     SET metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.costLines[2].type', 'ResidenceCost',
           '$.costLines[2].payee.type', 'AccreditedEducationalTrainingInstitution',
           '$.costLines[2].payee.name', 'St. Laurence College',
           '$.costLines[2].payee.reference', '',
           '$.costLines[2].recurrence', JSON_OBJECT(
             'enabled', JSON_EXTRACT('false', '$'),
             'startDate', '',
             'endDate', '',
             'occurrences', '',
             'amountPerPeriod', ''
           ),
           '$.proposedInterventions[0].costLines[2].type', 'ResidenceCost',
           '$.proposedInterventions[0].costLines[2].payee.type', 'AccreditedEducationalTrainingInstitution',
           '$.proposedInterventions[0].costLines[2].payee.name', 'St. Laurence College',
           '$.proposedInterventions[0].costLines[2].payee.reference', '',
           '$.proposedInterventions[0].costLines[2].recurrence', JSON_OBJECT(
             'enabled', JSON_EXTRACT('false', '$'),
             'startDate', '',
             'endDate', '',
             'occurrences', '',
             'amountPerPeriod', ''
           ),
           '$.prodDataRepairFeedback127ResidenceCost20260528', JSON_OBJECT(
             'feedbackReportId', 127,
             'relatedFeedbackReportId', 124,
             'caseId', 120,
             'lineId', v_line_id,
             'previousType', 'LivingAllowance',
             'newType', 'ResidenceCost',
             'reason', 'Kelly Hyde could not save the UI correction for the residence/meal-plan line.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         updated_at = v_repair_at
   WHERE id = 178
     AND case_id = 120
     AND action_plan_id = 56
     AND legacy_intervention_id = 115
     AND source_intervention_id = 114
     AND proposal_kind = 'revision'
     AND review_status = 'draft'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.costLines[2].id')) = v_line_id
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.costLines[2].type')) = 'LivingAllowance'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.proposedInterventions[0].costLines[2].id')) = v_line_id
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.proposedInterventions[0].costLines[2].type')) = 'LivingAllowance';

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proposal metadata update failed for feedback #127 repair.';
  END IF;

  IF v_status_from <> 'resolved' THEN
    UPDATE admin_feedback_report
       SET status = 'resolved',
           updated_at = v_repair_at
     WHERE id = 127;

    INSERT INTO admin_feedback_status_history
      (report_id, previous_status, new_status, changed_by_name, changed_by_email, changed_at)
    SELECT 127, v_status_from, 'resolved', v_actor_name, v_actor_email, v_repair_at
     WHERE NOT EXISTS (
       SELECT 1
         FROM admin_feedback_status_history
        WHERE report_id = 127
          AND previous_status = v_status_from
          AND new_status = 'resolved'
     );

    SELECT COUNT(*)
      INTO v_status_history_count
      FROM admin_feedback_status_history
     WHERE report_id = 127
       AND new_status = 'resolved';

    IF v_status_history_count < 1 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Feedback #127 status-history update failed.';
    END IF;
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
  SELECT 127, NULL, v_actor_name, v_actor_email,
         CONCAT(
           'Codex quiet data repair 2026-05-28: Per Bill approval, changed case 120 line ',
           v_line_id,
           ' from LivingAllowance to ResidenceCost in interventions 114/115 and proposal 178. ',
           'The line amount remains 11370.00, recurrence/installments were cleared, and the payee was aligned to St. Laurence College. ',
           'No client-facing message or notification was sent from PATH.'
         ),
         v_repair_at
   WHERE NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 127
        AND note_text LIKE 'Codex quiet data repair 2026-05-28: Per Bill approval, changed case 120 line f17c3a41-703b-4c64-804a-0c0562d44d49%'
   );

  SELECT COUNT(*)
    INTO v_note_127_count
    FROM admin_feedback_note
   WHERE report_id = 127
     AND note_text LIKE 'Codex quiet data repair 2026-05-28: Per Bill approval, changed case 120 line f17c3a41-703b-4c64-804a-0c0562d44d49%';

  IF v_note_127_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback #127 repair note was not recorded.';
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
  SELECT 124, NULL, v_actor_name, v_actor_email,
         CONCAT(
           'Codex follow-up 2026-05-28: Kelly submitted report #127 because case 120 still would not save the Residence Costs correction. ',
           'Bill approved a quiet PROD data repair for the specific 11370.00 residence/meal-plan line. ',
           'The durable UI save bug remains under #124 and should stay in_progress until the save path is fixed and rechecked.'
         ),
         v_repair_at
   WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 124)
     AND NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE report_id = 124
          AND note_text LIKE 'Codex follow-up 2026-05-28: Kelly submitted report #127 because case 120 still would not save the Residence Costs correction%'
     );

  SELECT COUNT(*)
    INTO v_note_124_count
    FROM admin_feedback_note
   WHERE report_id = 124
     AND note_text LIKE 'Codex follow-up 2026-05-28: Kelly submitted report #127 because case 120 still would not save the Residence Costs correction%';

  IF v_note_124_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback #124 follow-up note was not recorded.';
  END IF;

  COMMIT;
END //

DELIMITER ;

CALL prod_repair_feedback_127_case120_residence_cost();

DROP PROCEDURE IF EXISTS prod_repair_feedback_127_case120_residence_cost;

SELECT 'intervention_costLines' AS source,
       ci.id AS record_id,
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.costLines[2].id')) AS line_id,
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.costLines[2].type')) AS type,
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.costLines[2].amount')) AS amount,
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.costLines[2].recurrence.enabled')) AS recurrence_enabled,
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.costLines[2].payee.type')) AS payee_type,
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.costLines[2].payee.name')) AS payee_name,
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.prodDataRepairFeedback127ResidenceCost20260528.feedbackReportId')) AS repair_feedback_id
  FROM iset_case_intervention ci
 WHERE ci.id IN (114, 115)
 ORDER BY ci.id;

SELECT 'proposal_costLines' AS source,
       p.id AS record_id,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].id')) AS line_id,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].type')) AS type,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].amount')) AS amount,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].recurrence.enabled')) AS recurrence_enabled,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].payee.type')) AS payee_type,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.costLines[2].payee.name')) AS payee_name,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.prodDataRepairFeedback127ResidenceCost20260528.feedbackReportId')) AS repair_feedback_id
  FROM iset_intervention_proposal p
 WHERE p.id = 178;

SELECT 'proposal_nested_costLines' AS source,
       p.id AS record_id,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].id')) AS line_id,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].type')) AS type,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].amount')) AS amount,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].recurrence.enabled')) AS recurrence_enabled,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].payee.type')) AS payee_type,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[0].costLines[2].payee.name')) AS payee_name,
       JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.prodDataRepairFeedback127ResidenceCost20260528.feedbackReportId')) AS repair_feedback_id
  FROM iset_intervention_proposal p
 WHERE p.id = 178;

SELECT id, status, updated_at
  FROM admin_feedback_report
 WHERE id IN (124, 127)
 ORDER BY id;

SELECT id, report_id, created_at, note_text
  FROM admin_feedback_note
 WHERE report_id IN (124, 127)
 ORDER BY created_at DESC, id DESC
 LIMIT 4;
