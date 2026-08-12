-- Guarded PROD feedback-log update for feedback #180 only.
-- Scope: admin_feedback_report, admin_feedback_status_history, and
-- admin_feedback_note. No case/application/assessment/document/workflow,
-- schema, code, runtime configuration, or provider mutation occurs.

DROP PROCEDURE IF EXISTS prod_feedback_180_ei_in_progress_20260810;

DELIMITER //

CREATE PROCEDURE prod_feedback_180_ei_in_progress_20260810()
BEGIN
  DECLARE v_previous_status VARCHAR(32) DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status
    INTO v_previous_status
    FROM admin_feedback_report
   WHERE id = 180
     AND report_type = 'bug'
     AND severity = 'medium'
     AND summary = 'Failing to load EI Verification Document'
     AND submitted_by_email = 'acurtis@nwac.ca'
     AND submitted_by_role = 'Regional Manager'
     AND page_path = '/application-case/291'
   FOR UPDATE;

  IF v_previous_status IS NULL OR v_previous_status <> 'submitted' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_180_state';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = 180
       AND author_email = 'codex@openai.com'
       AND note_text LIKE 'Codex incident update 2026-08-10 feedback 180:%'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_180_duplicate_note';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'in_progress'
   WHERE id = 180
     AND status = 'submitted';

  INSERT INTO admin_feedback_status_history (
    report_id,
    previous_status,
    new_status,
    changed_by_staff_profile_id,
    changed_by_name,
    changed_by_email
  ) VALUES (
    180,
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
    180,
    NULL,
    'Codex',
    'codex@openai.com',
    CONCAT(
      'Codex incident update 2026-08-10 feedback 180: ',
      'Amanda Curtis confirmed that the separate general Supporting Documents upload issue is fixed after the production S3 IAM repair. ',
      'The EI Verification Document report remains in progress pending Amanda''s confirmation that the Case 291 EI upload completes and she can continue past the EI step. ',
      'No case, application, assessment, document, workflow, schema, code, or runtime configuration was changed by this feedback-log update.'
    )
  );

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_180_ei_in_progress_20260810();
DROP PROCEDURE IF EXISTS prod_feedback_180_ei_in_progress_20260810;

SELECT id,
       report_type,
       severity,
       status,
       summary,
       updated_at
  FROM admin_feedback_report
 WHERE id = 180;

SELECT id,
       report_id,
       previous_status,
       new_status,
       changed_by_name,
       changed_by_email,
       changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 180
 ORDER BY id DESC
 LIMIT 3;

SELECT id,
       report_id,
       author_name,
       author_email,
       note_text,
       created_at
  FROM admin_feedback_note
 WHERE report_id = 180
 ORDER BY id DESC
 LIMIT 3;
