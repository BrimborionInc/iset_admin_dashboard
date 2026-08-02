-- Guarded PROD feedback-log update for DEV-qualified reports #168 and #170.
-- Scope is admin_feedback_report, admin_feedback_status_history, and
-- admin_feedback_note only. No application, assessment, workflow, case,
-- schema, runtime configuration, deployment, or provider operation occurs.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @qualified_at := UTC_TIMESTAMP();

DROP PROCEDURE IF EXISTS prod_feedback_168_170_planned_20260801;

DELIMITER //

CREATE PROCEDURE prod_feedback_168_170_planned_20260801()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_evidence_count INT DEFAULT 0;
  DECLARE v_duplicate_count INT DEFAULT 0;
  DECLARE v_note_text TEXT;

  SET v_note_text =
    'Codex implementation and qualification update 2026-08-01: Confirmed #168 and #170 are the same dual-role frontend edit-access defect. A Regional Manager who is also the assessment workflow submitter was kept read-only after the assessment reached returned_to_submitter because the old gate allowed Regional Manager editing only when no review workflow existed. Clean branch codex/feedback-168-170-dual-role-edit commit a8debef now preserves unsubmitted in-review Regional Manager drafts and permits a returned assessment only when the signed-in staff_profile_id exactly matches the workflow submitted_by_staff_profile_id. Different Regional Managers, missing submitter lineage, every other workflow stage, other roles, and non-in_review applications remain denied. The server already supplies the required submitter lineage and accepts the legitimate returned-draft update, so no schema or data repair is needed. Qualification passed focused policy/wiring coverage (13 tests), the complete admin aggregate (93 suites / 427 tests), changed-file lint with zero warnings, full lint with zero errors and only 25 pre-existing unrelated warnings, production compilation, and diff checks. Status moved to planned because the fix is complete and tested but not deployed to TEST or PROD. No case, application, assessment, workflow, runtime, or deployed code changed in this log update.';

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_report_count
    FROM admin_feedback_report
   WHERE (id = 168 AND report_type = 'bug' AND status = 'triaging' AND summary = 'Stepanie Ewasiuk File')
      OR (id = 170 AND report_type = 'bug' AND status = 'triaging' AND summary = 'Not able to edit assessment after Admin requested changes');

  IF v_report_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_reports';
  END IF;

  SELECT COUNT(*)
    INTO v_evidence_count
    FROM admin_feedback_note
   WHERE (id = 492 AND report_id = 168 AND author_email = @actor_email)
      OR (id = 494 AND report_id = 170 AND author_email = @actor_email);

  IF v_evidence_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_evidence';
  END IF;

  SELECT COUNT(*)
    INTO v_duplicate_count
    FROM admin_feedback_note
   WHERE report_id IN (168, 170)
     AND author_email = @actor_email
     AND note_text LIKE 'Codex implementation and qualification update 2026-08-01:%';

  IF v_duplicate_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_duplicate';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'planned', updated_at = @qualified_at
   WHERE id = 168 AND status = 'triaging';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_update';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'planned', updated_at = @qualified_at
   WHERE id = 170 AND status = 'triaging';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_170_update';
  END IF;

  INSERT INTO admin_feedback_status_history (
    report_id, previous_status, new_status, changed_by_staff_profile_id,
    changed_by_name, changed_by_email, changed_at
  ) VALUES
    (168, 'triaging', 'planned', NULL, @actor_name, @actor_email, @qualified_at),
    (170, 'triaging', 'planned', NULL, @actor_name, @actor_email, @qualified_at);

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_history';
  END IF;

  INSERT INTO admin_feedback_note (
    report_id, author_staff_profile_id, author_name, author_email,
    note_text, created_at
  ) VALUES
    (168, NULL, @actor_name, @actor_email, CONCAT(v_note_text, ' This report is paired with #170 and will be resolved only after deployment and targeted verification.'), @qualified_at),
    (170, NULL, @actor_name, @actor_email, CONCAT(v_note_text, ' This report is paired with #168 and will be resolved only after deployment and targeted verification.'), @qualified_at);

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_notes';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_168_170_planned_20260801();

DROP PROCEDURE IF EXISTS prod_feedback_168_170_planned_20260801;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (168, 170)
 ORDER BY id;

SELECT id, report_id, previous_status, new_status,
       changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (168, 170)
 ORDER BY id DESC
 LIMIT 8;

SELECT id, report_id, author_name, author_email, created_at,
       LEFT(note_text, 1400) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (168, 170)
 ORDER BY id DESC
 LIMIT 8;
