-- PROD feedback #35 prerelease reconciliation for R1 intake completion integrity.
-- Scope: one guarded admin_feedback_report timestamp update and one internal note.
-- No client, submission, application, case, schema, runtime, or status mutation.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260710-r1-intake-completion-prod';

DROP PROCEDURE IF EXISTS prod_feedback_35_r1_prerelease_20260710;

DELIMITER //

CREATE PROCEDURE prod_feedback_35_r1_prerelease_20260710()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_status VARCHAR(32) DEFAULT NULL;
  DECLARE v_note_text TEXT;

  SET v_note_text = CONCAT(
    'Codex PROD prerelease note 2026-07-10: The systemic prevention fix related to this historical consent-signature report is scheduled for portal-only release ',
    @release_id,
    '. R1 passed local request/failure-injection tests and an authenticated deployed TEST rehearsal against published workflow 21 and real MySQL. ',
    'The release makes final completion revalidate all applicable published-workflow requirements before writes and commits client/case/submission/application ownership atomically with coherent retry replay. ',
    'Report #35 remains closed because its original file-level response was completed previously; this release prevents recurrence and does not rewrite the historical submission. ',
    'No schema, data/runtime/workflow promotion, admin/shared artifact, synthetic PROD submission, or historical repair is included.'
  );

  START TRANSACTION;

  SELECT COUNT(*), MAX(status)
    INTO v_report_count, v_status
    FROM admin_feedback_report
   WHERE id = 35
     AND report_type = 'bug'
     AND summary = 'Client submitted without signing main Consent'
   FOR UPDATE;

  IF v_report_count <> 1 OR v_status <> 'closed' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_35_prerelease';
  END IF;

  UPDATE admin_feedback_report
     SET updated_at = @note_at
   WHERE id = 35
     AND status = 'closed';

  INSERT INTO admin_feedback_note
    (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
  SELECT 35, NULL, @actor_name, @actor_email, v_note_text, @note_at
   WHERE NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 35
        AND note_text LIKE CONCAT('Codex PROD prerelease note 2026-07-10:%', @release_id, '%')
   );

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_35_r1_prerelease_20260710();

DROP PROCEDURE IF EXISTS prod_feedback_35_r1_prerelease_20260710;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 35;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 35
 ORDER BY changed_at DESC, id DESC
 LIMIT 5;

SELECT report_id, author_name, created_at, LEFT(note_text, 600) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 35
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
