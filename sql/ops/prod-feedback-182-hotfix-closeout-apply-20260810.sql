-- Guarded PROD feedback-log update for feedback #182 only.
-- Scope: admin_feedback_report, admin_feedback_status_history, and
-- admin_feedback_note. No case/application/assessment/letter/message,
-- participant, schema, runtime configuration, code, or provider mutation occurs.
-- Live DDL and current report state were re-proved immediately before use.

DROP PROCEDURE IF EXISTS prod_feedback_182_hotfix_update_20260810;

DELIMITER //

CREATE PROCEDURE prod_feedback_182_hotfix_update_20260810()
BEGIN
  DECLARE v_previous_status VARCHAR(32) DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT r.status
    INTO v_previous_status
    FROM admin_feedback_report AS r
   WHERE r.id = 182
     AND r.report_type = 'bug'
     AND r.severity = 'medium'
     AND r.status = 'submitted'
     AND r.summary = 'Alyssa''s Approval Letter'
     AND r.submitted_by_staff_profile_id = 60
     AND r.submitted_by_name = 'iset@mmvi.ca'
     AND r.submitted_by_email = 'iset@mmvi.ca'
     AND r.submitted_by_role = 'ISET Coordinator'
     AND r.page_path = '/application-case/109?entry=approval&approvalType=application&step=communication&applicationId=27'
     AND r.submitted_at = '2026-08-10 18:10:36'
   FOR UPDATE;

  IF v_previous_status IS NULL OR v_previous_status <> 'submitted' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_182_state';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM admin_feedback_note AS n
     WHERE n.report_id = 182
       AND n.author_email = 'codex@openai.com'
       AND n.note_text LIKE 'Codex deployment update 2026-08-10 feedback 182:%'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_182_duplicate_note';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'in_progress'
   WHERE id = 182
     AND status = 'submitted';

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_182_update';
  END IF;

  INSERT INTO admin_feedback_status_history (
    report_id,
    previous_status,
    new_status,
    changed_by_staff_profile_id,
    changed_by_name,
    changed_by_email
  ) VALUES (
    182,
    'submitted',
    'in_progress',
    NULL,
    'Codex',
    'codex@openai.com'
  );

  INSERT INTO admin_feedback_note (
    report_id,
    author_staff_profile_id,
    author_name,
    author_email,
    note_text
  ) VALUES (
    182,
    NULL,
    'Codex',
    'codex@openai.com',
    CONCAT(
      'Codex deployment update 2026-08-10 feedback 182: ',
      'Reproduced the approval-letter failure and traced it to post-decision letter draft persistence being incorrectly classified as a Decision Maker outcome mutation. ',
      'Deployed admin-only emergency hotfix 20260810-feedback-182-letter-hotfix-r1 from exact clean admin commit aa1148094fa8a8ab917857ddd26dd955ecb9062d. ',
      'The release passed all 850 tests, quiet lint, privacy-route smoke, the production build, immutable artifact checks, successful ASG refresh 2385610f-2759-45b1-a260-9359db35fbc5, exact deployed provenance/build verification, healthy target status, and normal-routing readiness checks. ',
      'The assigned Coordinator may now save post-decision letter communication while Decision Maker outcomes and active review stages remain protected. ',
      'Status remains in progress pending the ISET Coordinator''s confirmation that the real approval-letter save and send complete successfully. ',
      'No case, application, assessment, letter, message, participant, schema, runtime configuration, or provider data was changed by this feedback-log update.'
    )
  );

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_182_hotfix_update_20260810();
DROP PROCEDURE IF EXISTS prod_feedback_182_hotfix_update_20260810;

SELECT
  r.id,
  r.report_type,
  r.severity,
  r.status,
  r.summary,
  r.updated_at
FROM admin_feedback_report AS r
WHERE r.id = 182;

SELECT
  h.id,
  h.report_id,
  h.previous_status,
  h.new_status,
  h.changed_by_name,
  h.changed_by_email,
  h.changed_at
FROM admin_feedback_status_history AS h
WHERE h.report_id = 182
ORDER BY h.id DESC
LIMIT 3;

SELECT
  n.id,
  n.report_id,
  n.author_name,
  n.author_email,
  n.note_text,
  n.created_at
FROM admin_feedback_note AS n
WHERE n.report_id = 182
ORDER BY n.id DESC
LIMIT 3;
