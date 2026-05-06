-- PROD guarded data repair for feedback report #83: Occupational Skills Intervention
-- Restore point: path-prod-feedback-83-case40-20260506123030
-- Purpose:
-- - Move future action plan 6 from active back to draft/non-active.
-- - Move intervention 11 (Occupational skills training - diploma) from in-progress delivery
--   to approved/planned so the approval-letter follow-up can open for the correct intervention.
-- - Leave intervention 37 unchanged because the requested repair scope is plan 6 + intervention 11 only.

DROP PROCEDURE IF EXISTS prod_fix_feedback_83_occupational_skills_letter_pending;

DELIMITER //

CREATE PROCEDURE prod_fix_feedback_83_occupational_skills_letter_pending()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case c
    JOIN iset_case_action_plan ap
      ON ap.id = 6
     AND ap.case_id = c.id
    JOIN iset_case_intervention occupational
      ON occupational.id = 11
     AND occupational.case_id = c.id
     AND occupational.action_plan_id = ap.id
     AND occupational.intervention_code = 10
    JOIN iset_case_intervention counselling
      ON counselling.id = 37
     AND counselling.case_id = c.id
     AND counselling.action_plan_id = ap.id
     AND counselling.intervention_code = 3
   WHERE c.id = 40
     AND c.case_number = 'CASE-2026-0000040'
     AND ap.status = 'active'
     AND ap.activated_at = '2026-05-06 11:22:34'
     AND occupational.status = 'in_progress'
     AND occupational.delivery_status = 'in_progress'
     AND JSON_UNQUOTE(JSON_EXTRACT(occupational.metadata_json, '$.review.decision')) = 'approved'
     AND counselling.status = 'approved'
     AND counselling.delivery_status = 'planned'
   FOR UPDATE;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for feedback #83 repair; expected case/plan/intervention state was not found.';
  END IF;

  UPDATE iset_case_action_plan
     SET status = 'draft',
         activated_at = NULL,
         updated_at = NOW()
   WHERE id = 6
     AND case_id = 40
     AND status = 'active'
     AND activated_at = '2026-05-06 11:22:34'
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Action plan update failed for feedback #83 repair.';
  END IF;

  UPDATE iset_case_intervention
     SET status = 'approved',
         delivery_status = 'planned',
         updated_at = NOW()
   WHERE id = 11
     AND case_id = 40
     AND action_plan_id = 6
     AND intervention_code = 10
     AND status = 'in_progress'
     AND delivery_status = 'in_progress'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.review.decision')) = 'approved'
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Occupational Skills intervention update failed for feedback #83 repair.';
  END IF;

  UPDATE iset_case
     SET updated_at = NOW()
   WHERE id = 40
     AND case_number = 'CASE-2026-0000040'
   LIMIT 1;

  INSERT INTO admin_feedback_note
    (report_id, author_name, author_email, note_text)
  SELECT
    83,
    'codex-prod-operator',
    'codex-prod-operator',
    'PROD data repair applied from restore point path-prod-feedback-83-case40-20260506123030. Case 40 action plan 6 was moved from active to draft/non-active; intervention 11 (Occupational skills training - diploma) was moved from in_progress/in_progress to approved/planned so approval-letter follow-up targets the Occupational Skills intervention. Intervention 37 was left unchanged pending business review.'
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = 83
       AND note_text LIKE 'PROD data repair applied from restore point path-prod-feedback-83-case40-20260506123030.%'
  );

  SELECT COUNT(*) INTO v_note_count
    FROM admin_feedback_note
   WHERE report_id = 83
     AND note_text LIKE 'PROD data repair applied from restore point path-prod-feedback-83-case40-20260506123030.%';

  IF v_note_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback note verification failed for feedback #83 repair.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_feedback_83_occupational_skills_letter_pending();

DROP PROCEDURE IF EXISTS prod_fix_feedback_83_occupational_skills_letter_pending;

SELECT
  ap.id,
  ap.case_id,
  ap.name,
  ap.status,
  ap.effective_date,
  ap.review_date,
  ap.activated_at,
  ap.updated_at
FROM iset_case_action_plan ap
WHERE ap.id = 6;

SELECT
  ci.id,
  ci.action_plan_id,
  ci.intervention_code,
  ec.label,
  ci.status,
  ci.delivery_status,
  ci.start_date,
  ci.end_date,
  ci.intervention_cost,
  ci.updated_at
FROM iset_case_intervention ci
LEFT JOIN esdc_intervention_code ec ON ec.code = ci.intervention_code
WHERE ci.id IN (11, 37)
ORDER BY ci.id;

SELECT
  id,
  report_id,
  author_name,
  note_text,
  created_at
FROM admin_feedback_note
WHERE report_id = 83
ORDER BY created_at DESC
LIMIT 3;
