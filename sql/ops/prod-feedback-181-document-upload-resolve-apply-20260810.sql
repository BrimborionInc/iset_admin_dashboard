-- Guarded PROD closeout for feedback #181 only.
-- Scope: admin_feedback_report, admin_feedback_status_history, and
-- admin_feedback_note. No case/application/document, schema, code, runtime
-- configuration, object, or other provider mutation occurs.

DROP PROCEDURE IF EXISTS prod_feedback_181_document_upload_resolve_20260810;

DELIMITER //

CREATE PROCEDURE prod_feedback_181_document_upload_resolve_20260810()
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
   WHERE id = 181
     AND report_type = 'bug'
     AND severity = 'critical'
     AND summary = 'Failed to upload documents'
     AND submitted_by_email = 'acurtis@nwac.ca'
     AND submitted_by_role = 'Regional Manager'
     AND page_path = '/application-case/258'
   FOR UPDATE;

  IF v_previous_status IS NULL OR v_previous_status <> 'submitted' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_181_state';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = 181
       AND author_email = 'codex@openai.com'
       AND note_text LIKE 'Codex resolved 2026-08-10 feedback 181:%'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_181_duplicate_note';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'resolved'
   WHERE id = 181
     AND status = 'submitted';

  INSERT INTO admin_feedback_status_history (
    report_id,
    previous_status,
    new_status,
    changed_by_staff_profile_id,
    changed_by_name,
    changed_by_email
  ) VALUES (
    181,
    'submitted',
    'resolved',
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
    181,
    NULL,
    'Codex',
    'codex@openai.com',
    CONCAT(
      'Codex resolved 2026-08-10 feedback 181: ',
      'Production logs proved the document upload failed after S3 accepted the file because the application role could not read or delete the exact object version. ',
      'The production app role now has narrowly scoped s3:GetObjectVersion, s3:DeleteObject, and s3:DeleteObjectVersion access on the uploads prefix. ',
      'Live verification from the production app role passed exact-version read, ordinary delete, exact-version delete, and zero-residue marker cleanup. ',
      'Amanda Curtis subsequently confirmed that document uploading works again. ',
      'The separately reported EI Verification journey remains tracked under feedback 180 as in progress pending confirmation that she can continue past its EI-specific step. ',
      'The earlier unlinked object-version inventory remains separate operational cleanup and does not change the verified outcome of this reported workflow.'
    )
  );

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_181_document_upload_resolve_20260810();
DROP PROCEDURE IF EXISTS prod_feedback_181_document_upload_resolve_20260810;

SELECT id,
       report_type,
       severity,
       status,
       summary,
       updated_at
  FROM admin_feedback_report
 WHERE id = 181;

SELECT id,
       report_id,
       previous_status,
       new_status,
       changed_by_name,
       changed_by_email,
       changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 181
 ORDER BY id DESC
 LIMIT 3;

SELECT id,
       report_id,
       author_name,
       author_email,
       note_text,
       created_at
  FROM admin_feedback_note
 WHERE report_id = 181
 ORDER BY id DESC
 LIMIT 3;
