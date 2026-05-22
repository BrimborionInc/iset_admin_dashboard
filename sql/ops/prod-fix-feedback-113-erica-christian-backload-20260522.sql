-- PROD guarded data repair for feedback report #113: Erica Christian Pending Completion.
-- Restore point: path-prod-fb113-erica-backload-20260522142039
-- Purpose:
-- - Case 107 / action plan 9 / intervention 15 represents historical active caseload work.
-- - It was persisted with an approved "new" intervention proposal compatibility row, so
--   Pending Completion expects the client approval-letter follow-up.
-- - Mark the intervention and its compatibility proposal as manual_backload/existing so
--   the historical intervention remains silent and leaves the approval-letter queue.

DROP PROCEDURE IF EXISTS prod_fix_feedback_113_erica_christian_backload;

DELIMITER //

CREATE PROCEDURE prod_fix_feedback_113_erica_christian_backload()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;
  DECLARE v_status_history_count INT DEFAULT 0;

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
     AND ci.intervention_code = 10
    JOIN iset_intervention_proposal p
      ON p.id = 30
     AND p.case_id = c.id
     AND p.action_plan_id = ap.id
     AND p.legacy_intervention_id = ci.id
     AND p.proposal_kind = 'new'
     AND p.review_status = 'approved'
    JOIN admin_feedback_report r
      ON r.id = 113
   WHERE c.id = 107
     AND c.case_number = 'ISET-20260416-5490A4'
     AND c.status = 'active'
     AND c.lifecycle_status = 'active'
     AND ap.status = 'active'
     AND ap.name = 'Skills Development'
     AND ci.status = 'in_progress'
     AND ci.delivery_status = 'in_progress'
     AND ci.start_date = '2026-01-05'
     AND ci.created_by_staff_profile_id = 54
     AND ci.reviewed_by_staff_profile_id = 54
     AND ci.reviewed_at = '2026-04-20 17:48:09'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.review.decision')) = 'approved'
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) IS NULL
     AND p.application_id = 25
     AND p.submitted_by_staff_profile_id = 54
     AND p.reviewed_by_staff_profile_id = 54
     AND p.submitted_at = '2026-04-20 17:47:29'
     AND p.reviewed_at = '2026-04-20 17:48:09'
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.source')) IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.entryMode')) IS NULL
     AND r.status = 'planned'
   FOR UPDATE;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for feedback #113 repair; expected case/intervention/proposal/report state was not found.';
  END IF;

  UPDATE iset_case_intervention
     SET metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.source', 'manual_backload',
           '$.entryMode', 'existing',
           '$.dataRepair.feedback113.restorePoint', 'path-prod-fb113-erica-backload-20260522142039',
           '$.dataRepair.feedback113.previousSource', 'NULL',
           '$.dataRepair.feedback113.previousEntryMode', 'NULL',
           '$.dataRepair.feedback113.reason', 'Historical active caseload intervention entered through the proposal path; suppress approval-letter follow-up.',
           '$.dataRepair.feedback113.repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
         ),
         updated_at = NOW()
   WHERE id = 15
     AND case_id = 107
     AND action_plan_id = 9
     AND intervention_code = 10
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.entryMode')) IS NULL
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Intervention metadata update failed for feedback #113 repair.';
  END IF;

  UPDATE iset_intervention_proposal
     SET metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.source', 'manual_backload',
           '$.entryMode', 'existing',
           '$.dataRepair.feedback113.restorePoint', 'path-prod-fb113-erica-backload-20260522142039',
           '$.dataRepair.feedback113.previousSource', 'NULL',
           '$.dataRepair.feedback113.previousEntryMode', 'NULL',
           '$.dataRepair.feedback113.reason', 'Compatibility proposal retained for audit but marked historical/existing with source intervention.',
           '$.dataRepair.feedback113.repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
         ),
         updated_at = NOW()
   WHERE id = 30
     AND case_id = 107
     AND action_plan_id = 9
     AND legacy_intervention_id = 15
     AND proposal_kind = 'new'
     AND review_status = 'approved'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.entryMode')) IS NULL
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proposal metadata update failed for feedback #113 repair.';
  END IF;

  UPDATE iset_case
     SET updated_at = NOW()
   WHERE id = 107
     AND case_number = 'ISET-20260416-5490A4'
   LIMIT 1;

  UPDATE admin_feedback_report
     SET status = 'resolved',
         updated_at = NOW()
   WHERE id = 113
     AND status = 'planned'
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback report status update failed for feedback #113 repair.';
  END IF;

  INSERT INTO admin_feedback_status_history
    (report_id, previous_status, new_status, changed_by_name, changed_by_email)
  VALUES
    (113, 'planned', 'resolved', 'codex-prod-operator', 'codex-prod-operator');

  SELECT COUNT(*) INTO v_status_history_count
    FROM admin_feedback_status_history
   WHERE report_id = 113
     AND previous_status = 'planned'
     AND new_status = 'resolved'
     AND changed_by_name = 'codex-prod-operator'
     AND changed_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE);

  IF v_status_history_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback status history verification failed for feedback #113 repair.';
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_name, author_email, note_text)
  VALUES
    (
      113,
      'codex-prod-operator',
      'codex-prod-operator',
      'PROD data repair applied from restore point path-prod-fb113-erica-backload-20260522142039. Erica Christian case 107/action plan 9/intervention 15 was persisted as approved new intervention proposal 30, which made Pending Completion expect a client approval letter. Amanda reported this is historical active caseload work. Intervention 15 and proposal 30 metadata were marked source=manual_backload and entryMode=existing so the record is excluded from approval-letter follow-up. No client communication was sent.'
    );

  SELECT COUNT(*) INTO v_note_count
    FROM admin_feedback_note
   WHERE report_id = 113
     AND note_text LIKE 'PROD data repair applied from restore point path-prod-fb113-erica-backload-20260522142039.%';

  IF v_note_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback note verification failed for feedback #113 repair.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_feedback_113_erica_christian_backload();

DROP PROCEDURE IF EXISTS prod_fix_feedback_113_erica_christian_backload;

SELECT
  c.id AS case_id,
  c.case_number,
  ap.id AS action_plan_id,
  ap.status AS action_plan_status,
  ci.id AS intervention_id,
  ci.status AS intervention_status,
  ci.delivery_status,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) AS intervention_source,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) AS intervention_entry_mode,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.dataRepair.feedback113.restorePoint')) AS intervention_restore_point,
  p.id AS proposal_id,
  p.proposal_kind,
  p.review_status AS proposal_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.source')) AS proposal_source,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.entryMode')) AS proposal_entry_mode,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.dataRepair.feedback113.restorePoint')) AS proposal_restore_point
FROM iset_case c
JOIN iset_case_action_plan ap ON ap.id = 9 AND ap.case_id = c.id
JOIN iset_case_intervention ci ON ci.id = 15 AND ci.case_id = c.id AND ci.action_plan_id = ap.id
LEFT JOIN iset_intervention_proposal p ON p.id = 30 AND p.legacy_intervention_id = ci.id
WHERE c.id = 107;

SELECT
  r.id,
  r.status,
  r.summary,
  r.updated_at
FROM admin_feedback_report r
WHERE r.id = 113;

SELECT
  id,
  report_id,
  previous_status,
  new_status,
  changed_by_name,
  changed_at
FROM admin_feedback_status_history
WHERE report_id = 113
ORDER BY changed_at DESC, id DESC
LIMIT 3;

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
