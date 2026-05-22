-- PROD guarded audit-metadata follow-up for feedback report #113.
-- Restore point: path-prod-fb113-erica-backload-20260522142039
-- Purpose:
-- - The primary repair marked intervention 15 and proposal 30 as manual_backload/existing.
-- - MySQL did not create the nested $.dataRepair.feedback113 object from the original JSON_SET paths.
-- - Add the restore-point metadata to the repaired rows themselves.

DROP PROCEDURE IF EXISTS prod_fix_feedback_113_erica_backload_audit_metadata;

DELIMITER //

CREATE PROCEDURE prod_fix_feedback_113_erica_backload_audit_metadata()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case c
    JOIN iset_case_action_plan ap
      ON ap.id = 9
     AND ap.case_id = c.id
    JOIN iset_case_intervention ci
      ON ci.id = 15
     AND ci.case_id = c.id
     AND ci.action_plan_id = ap.id
    JOIN iset_intervention_proposal p
      ON p.id = 30
     AND p.legacy_intervention_id = ci.id
    JOIN admin_feedback_report r
      ON r.id = 113
   WHERE c.id = 107
     AND c.case_number = 'ISET-20260416-5490A4'
     AND ap.status = 'active'
     AND ci.status = 'in_progress'
     AND ci.delivery_status = 'in_progress'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'manual_backload'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) = 'existing'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.dataRepair.feedback113.restorePoint')) IS NULL
     AND p.proposal_kind = 'new'
     AND p.review_status = 'approved'
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.source')) = 'manual_backload'
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.entryMode')) = 'existing'
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.dataRepair.feedback113.restorePoint')) IS NULL
     AND r.status = 'resolved'
   FOR UPDATE;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for feedback #113 audit metadata repair; expected repaired state was not found.';
  END IF;

  UPDATE iset_case_intervention
     SET metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.feedback113',
           JSON_OBJECT(
             'restorePoint', 'path-prod-fb113-erica-backload-20260522142039',
             'previousSource', 'NULL',
             'previousEntryMode', 'NULL',
             'reason', 'Historical active caseload intervention entered through the proposal path; suppress approval-letter follow-up.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ'),
             'auditFollowup', 'Added after primary repair because nested JSON_SET did not create the missing dataRepair parent.'
           )
         ),
         updated_at = NOW()
   WHERE id = 15
     AND case_id = 107
     AND action_plan_id = 9
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.entryMode')) = 'existing'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.dataRepair.feedback113.restorePoint')) IS NULL
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Intervention audit metadata update failed for feedback #113.';
  END IF;

  UPDATE iset_intervention_proposal
     SET metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.feedback113',
           JSON_OBJECT(
             'restorePoint', 'path-prod-fb113-erica-backload-20260522142039',
             'previousSource', 'NULL',
             'previousEntryMode', 'NULL',
             'reason', 'Compatibility proposal retained for audit but marked historical/existing with source intervention.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ'),
             'auditFollowup', 'Added after primary repair because nested JSON_SET did not create the missing dataRepair parent.'
           )
         ),
         updated_at = NOW()
   WHERE id = 30
     AND case_id = 107
     AND action_plan_id = 9
     AND legacy_intervention_id = 15
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.entryMode')) = 'existing'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.dataRepair.feedback113.restorePoint')) IS NULL
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proposal audit metadata update failed for feedback #113.';
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_name, author_email, note_text)
  VALUES
    (
      113,
      'codex-prod-operator',
      'codex-prod-operator',
      'PROD data repair audit metadata follow-up: restored path-prod-fb113-erica-backload-20260522142039 metadata onto intervention 15 and proposal 30 after verifying the primary repair had marked both rows manual_backload/existing and resolved the report.'
    );

  SELECT COUNT(*) INTO v_note_count
    FROM admin_feedback_note
   WHERE report_id = 113
     AND note_text LIKE 'PROD data repair audit metadata follow-up: restored path-prod-fb113-erica-backload-20260522142039 metadata onto intervention 15 and proposal 30%';

  IF v_note_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback note verification failed for feedback #113 audit metadata repair.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_feedback_113_erica_backload_audit_metadata();

DROP PROCEDURE IF EXISTS prod_fix_feedback_113_erica_backload_audit_metadata;

SELECT
  ci.id AS intervention_id,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) AS intervention_source,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) AS intervention_entry_mode,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.dataRepair.feedback113.restorePoint')) AS intervention_restore_point,
  p.id AS proposal_id,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.source')) AS proposal_source,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.entryMode')) AS proposal_entry_mode,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.dataRepair.feedback113.restorePoint')) AS proposal_restore_point
FROM iset_case_intervention ci
JOIN iset_intervention_proposal p ON p.id = 30 AND p.legacy_intervention_id = ci.id
WHERE ci.id = 15;

SELECT
  id,
  report_id,
  author_name,
  note_text,
  created_at
FROM admin_feedback_note
WHERE report_id = 113
ORDER BY created_at DESC, id DESC
LIMIT 3;
