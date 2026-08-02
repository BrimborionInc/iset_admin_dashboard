-- Guarded feedback closeout for release 20260801-returned-assessment-edit.
-- Run only after PROD deployment, normal-routing readiness, deployed-source
-- verification, and the targeted returned-assessment edit-access check pass.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := UTC_TIMESTAMP();
SET @note_prefix := 'Codex PROD closeout 2026-08-02: Release 20260801-returned-assessment-edit';

DROP PROCEDURE IF EXISTS prod_feedback_168_170_resolve_20260802;

DELIMITER //

CREATE PROCEDURE prod_feedback_168_170_resolve_20260802()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_duplicate_note_count INT DEFAULT 0;

  SELECT COUNT(*)
    INTO v_report_count
    FROM admin_feedback_report
   WHERE (id = 168 AND report_type = 'bug' AND severity = 'medium' AND status = 'planned' AND summary = 'Stepanie Ewasiuk File')
      OR (id = 170 AND report_type = 'bug' AND severity = 'medium' AND status = 'planned' AND summary = 'Not able to edit assessment after Admin requested changes');

  IF v_report_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_planned_reports';
  END IF;

  SELECT COUNT(*)
    INTO v_duplicate_note_count
    FROM admin_feedback_note
   WHERE report_id IN (168, 170)
     AND author_email = @actor_email
     AND note_text LIKE CONCAT(@note_prefix, '%');

  IF v_duplicate_note_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_existing_closeout';
  END IF;

  START TRANSACTION;

  UPDATE admin_feedback_report
     SET status = 'resolved', updated_at = @resolved_at
   WHERE id IN (168, 170)
     AND status = 'planned';

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_report_update';
  END IF;

  INSERT INTO admin_feedback_status_history (
    report_id, previous_status, new_status, changed_by_staff_profile_id,
    changed_by_name, changed_by_email, changed_at
  ) VALUES
    (168, 'planned', 'resolved', NULL, @actor_name, @actor_email, @resolved_at),
    (170, 'planned', 'resolved', NULL, @actor_name, @actor_email, @resolved_at);

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_history_insert';
  END IF;

  INSERT INTO admin_feedback_note (
    report_id, author_staff_profile_id, author_name, author_email,
    note_text, created_at
  ) VALUES
    (
      168, NULL, @actor_name, @actor_email,
      CONCAT(
        @note_prefix,
        ' deployed exact admin commit 6bd87e02f7d7456bfa5b5441884597a5b3b9efc1 after exact-source DEV and TEST GO evidence. Normal-routing readiness, deployed source/compiled-bundle markers, and the returned_to_submitter submitter-identity access policy were verified after deployment. The complete TEST browser journey and Bill''s manual DEV check both proved that the exact workflow submitter can edit, save, reopen, and resubmit while other Regional Managers and active review stages remain read-only. Report resolved; no application, assessment, workflow, case, schema, runtime configuration, or provider data was changed by this closeout.'
      ),
      @resolved_at
    ),
    (
      170, NULL, @actor_name, @actor_email,
      CONCAT(
        @note_prefix,
        ' deployed exact admin commit 6bd87e02f7d7456bfa5b5441884597a5b3b9efc1 after exact-source DEV and TEST GO evidence. Normal-routing readiness, deployed source/compiled-bundle markers, and the returned_to_submitter submitter-identity access policy were verified after deployment. The complete TEST browser journey and Bill''s manual DEV check both proved that the exact workflow submitter can edit, save, reopen, and resubmit while other Regional Managers and active review stages remain read-only. Report resolved; no application, assessment, workflow, case, schema, runtime configuration, or provider data was changed by this closeout.'
      ),
      @resolved_at
    );

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_note_insert';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_168_170_resolve_20260802();
DROP PROCEDURE IF EXISTS prod_feedback_168_170_resolve_20260802;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (168, 170)
 ORDER BY id;

SELECT id, report_id, previous_status, new_status,
       changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (168, 170)
   AND changed_by_email = @actor_email
   AND changed_at = @resolved_at
 ORDER BY report_id, id;

SELECT id, report_id, author_name, author_email, note_text, created_at
  FROM admin_feedback_note
 WHERE report_id IN (168, 170)
   AND author_email = @actor_email
   AND created_at = @resolved_at
 ORDER BY report_id, id;
