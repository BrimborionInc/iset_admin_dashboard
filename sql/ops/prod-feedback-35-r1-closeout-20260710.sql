-- PROD feedback #35 closeout for R1 intake completion integrity.
-- Scope: one guarded admin_feedback_report timestamp update and one internal note.
-- Report status remains closed; no client, submission, application, case, schema,
-- runtime, or historical-record mutation is performed.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260710-r1-intake-completion-prod';

DROP PROCEDURE IF EXISTS prod_feedback_35_r1_closeout_20260710;

DELIMITER //

CREATE PROCEDURE prod_feedback_35_r1_closeout_20260710()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_status VARCHAR(32) DEFAULT NULL;
  DECLARE v_prerelease_note_count INT DEFAULT 0;
  DECLARE v_note_text TEXT;

  SET v_note_text = CONCAT(
    'Codex PROD release closeout 2026-07-10: Portal-only release ',
    @release_id,
    ' deployed successfully from clean commit 1b4734b7f3001db6255fc7bff4a39c1cbb54f540. ',
    'ASG refresh 4f1fdc39-0de0-40ca-8db8-c22be38c9dee completed on replacement instance i-08d327a3ad96c6b77. ',
    'Normal-routing portal smoke returned 200 for iset.nwac.ca and nwac-public.awentech.ca. ',
    'Deployed-source SSM 5c64b682-60cc-4439-82aa-ef2ec9b67eb3 confirmed the production release/commit, intake router, published-workflow validator call, single-transaction markers, syntax, local health, and online processes. ',
    'Read-only postflight SQL b43bda4e-2582-4055-bc70-5a8ef0911178 found zero orphan submissions, duplicate submission links, or active/non-terminal ownership conflicts and confirmed published workflow 21 with 26 steps. ',
    'The one raw historical ownership mismatch is the documented archived duplicate from the May account merge, with its old user suspended and merge marker present; it is terminal and non-blocking. ',
    'Report #35 remains closed: the original file-level response was completed previously, and this release closes the systemic server-side recurrence boundary without rewriting historical data or creating a synthetic PROD submission. ',
    'No external owner message is required for this systemic-only follow-up; communication is parked in the PROD repair-notification log.'
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
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_35_closeout';
  END IF;

  SELECT COUNT(*)
    INTO v_prerelease_note_count
    FROM admin_feedback_note
   WHERE report_id = 35
     AND note_text LIKE CONCAT('Codex PROD prerelease note 2026-07-10:%', @release_id, '%');

  IF v_prerelease_note_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_35_prerelease_note';
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
        AND note_text LIKE CONCAT('Codex PROD release closeout 2026-07-10:%', @release_id, '%')
   );

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_35_r1_closeout_20260710();

DROP PROCEDURE IF EXISTS prod_feedback_35_r1_closeout_20260710;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 35;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 35
 ORDER BY changed_at DESC, id DESC
 LIMIT 5;

SELECT report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 35
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
