-- Guarded pre-release reconciliation for feedback reports 199 and 200.
-- This records the approved PROD release without claiming either reporter
-- journey is resolved before Amanda rechecks it.

DROP PROCEDURE IF EXISTS prod_feedback_199_200_release_plan_20260903;

DELIMITER //

CREATE PROCEDURE prod_feedback_199_200_release_plan_20260903()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  IF BINARY DATABASE() <> BINARY 'iset_intake' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_plan_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM staff_profiles
   WHERE staff_profiles.id = 1
     AND staff_profiles.email = 'bill@sillery.co.uk'
     AND staff_profiles.primary_role = 'System Administrator'
     AND staff_profiles.status = 'active'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_plan_actor_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_report
   WHERE admin_feedback_report.id IN (199, 200)
     AND admin_feedback_report.report_type = 'bug'
     AND admin_feedback_report.severity = 'medium'
     AND admin_feedback_report.status = 'triaging'
     AND admin_feedback_report.summary = 'Amend Current Intervention'
     AND admin_feedback_report.submitted_by_staff_profile_id = 54
     AND admin_feedback_report.submitted_by_email = 'acurtis@nwac.ca'
     AND (
       (admin_feedback_report.id = 199
        AND admin_feedback_report.page_path = '/cases/40'
        AND admin_feedback_report.updated_at = '2026-09-03 12:03:41')
       OR
       (admin_feedback_report.id = 200
        AND admin_feedback_report.page_path = '/cases/134?applicationId=56'
        AND admin_feedback_report.updated_at = '2026-09-03 12:02:29')
     )
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_plan_report_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_note
   WHERE admin_feedback_note.report_id IN (199, 200)
     AND admin_feedback_note.note_text LIKE 'PROD_RELEASE_20260903_FEEDBACK_199_200:%'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_plan_note_exists';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'planned',
         updated_at = CURRENT_TIMESTAMP
   WHERE admin_feedback_report.id IN (199, 200)
     AND admin_feedback_report.status = 'triaging';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_plan_update_failed';
  END IF;

  INSERT INTO admin_feedback_status_history (
    report_id,
    previous_status,
    new_status,
    changed_by_staff_profile_id,
    changed_by_name,
    changed_by_email
  ) VALUES
  (199, 'triaging', 'planned', 1, 'Bill Sillery', 'bill@sillery.co.uk'),
  (200, 'triaging', 'planned', 1, 'Bill Sillery', 'bill@sillery.co.uk');
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_plan_history_failed';
  END IF;

  INSERT INTO admin_feedback_note (
    report_id,
    author_staff_profile_id,
    author_name,
    author_email,
    note_text
  ) VALUES
  (
    199,
    1,
    'Bill Sillery',
    'bill@sillery.co.uk',
    'PROD_RELEASE_20260903_FEEDBACK_199_200: Approved for PROD release 20260903-feedback-199-200-revision-hotfix-r1. The release restores the existing amendment workflow for explicitly historical, manually entered cases that have no application record while retaining exact case, Action Plan, source intervention, revision, and review lineage controls. Report remains open pending normal-routing smoke and Amanda Curtis''s reporter-role recheck on case 40.'
  ),
  (
    200,
    1,
    'Bill Sillery',
    'bill@sillery.co.uk',
    'PROD_RELEASE_20260903_FEEDBACK_199_200: Approved for PROD release 20260903-feedback-199-200-revision-hotfix-r1. The release restores the revision action for approved interventions, including older approved proposal records that predate a two-step review-workflow row, while preserving approved facts as read-only and routing revisions through reapproval. Report remains open pending normal-routing smoke and Amanda Curtis''s reporter-role recheck on case 134.'
  );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_plan_note_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_199_200_release_plan_20260903();
DROP PROCEDURE prod_feedback_199_200_release_plan_20260903;
