-- PROD guarded follow-up data repair for feedback report #83.
-- Restore point: path-prod-feedback-83-case40-20260506123030
-- Purpose:
-- - Intervention 11 already has an approved proposal link and approved/planned status.
-- - Its metadata still marks it as manual_backload / existing, which the UI intentionally
--   excludes from approval-letter follow-up.
-- - Reclassify only intervention 11 metadata so the UI can show "Approved - letter pending"
--   for Occupational skills training - diploma.

DROP PROCEDURE IF EXISTS prod_fix_feedback_83_occupational_skills_letter_pending_metadata;

DELIMITER //

CREATE PROCEDURE prod_fix_feedback_83_occupational_skills_letter_pending_metadata()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_intervention ci
    JOIN iset_intervention_proposal p
      ON p.legacy_intervention_id = ci.id
     AND p.review_status = 'approved'
   WHERE ci.id = 11
     AND ci.case_id = 40
     AND ci.action_plan_id = 6
     AND ci.intervention_code = 10
     AND ci.status = 'approved'
     AND ci.delivery_status = 'planned'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'manual_backload'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) = 'existing'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.review.decision')) = 'approved'
   FOR UPDATE;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for feedback #83 metadata repair; expected intervention/proposal state was not found.';
  END IF;

  UPDATE iset_case_intervention
     SET metadata_json = JSON_SET(
           metadata_json,
           '$.source', 'intervention_proposal',
           '$.entryMode', 'proposal',
           '$.dataRepair.feedback83.restorePoint', 'path-prod-feedback-83-case40-20260506123030',
           '$.dataRepair.feedback83.previousSource', 'manual_backload',
           '$.dataRepair.feedback83.previousEntryMode', 'existing',
           '$.dataRepair.feedback83.reason', 'Reclassify approved proposal so approval-letter follow-up targets Occupational Skills intervention.'
         ),
         updated_at = NOW()
   WHERE id = 11
     AND case_id = 40
     AND action_plan_id = 6
     AND intervention_code = 10
     AND status = 'approved'
     AND delivery_status = 'planned'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.entryMode')) = 'existing'
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Intervention metadata update failed for feedback #83 metadata repair.';
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
    'PROD data repair follow-up applied from restore point path-prod-feedback-83-case40-20260506123030. Intervention 11 metadata was reclassified from manual_backload/existing to intervention_proposal/proposal so the approved proposal is eligible for approval-letter follow-up and should display as Approved - letter pending.'
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = 83
       AND note_text LIKE 'PROD data repair follow-up applied from restore point path-prod-feedback-83-case40-20260506123030.%'
  );

  SELECT COUNT(*) INTO v_note_count
    FROM admin_feedback_note
   WHERE report_id = 83
     AND note_text LIKE 'PROD data repair follow-up applied from restore point path-prod-feedback-83-case40-20260506123030.%';

  IF v_note_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback note verification failed for feedback #83 metadata repair.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_feedback_83_occupational_skills_letter_pending_metadata();

DROP PROCEDURE IF EXISTS prod_fix_feedback_83_occupational_skills_letter_pending_metadata;

SELECT
  ci.id,
  ci.status,
  ci.delivery_status,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) AS metadata_source,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) AS metadata_entry_mode,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.dataRepair.feedback83.previousSource')) AS previous_source,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.dataRepair.feedback83.previousEntryMode')) AS previous_entry_mode,
  p.id AS proposal_id,
  p.review_status AS proposal_review_status
FROM iset_case_intervention ci
LEFT JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
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
LIMIT 4;
