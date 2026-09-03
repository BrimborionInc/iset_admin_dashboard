-- Guarded post-deployment notes for feedback reports 199 and 200.
-- Reports remain Planned until Amanda completes the reporter-role journeys.

DROP PROCEDURE IF EXISTS prod_feedback_199_200_release_verify_20260903;

DELIMITER //

CREATE PROCEDURE prod_feedback_199_200_release_verify_20260903()
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
      SET MESSAGE_TEXT = 'feedback_199_200_release_verify_wrong_database';
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
      SET MESSAGE_TEXT = 'feedback_199_200_release_verify_actor_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_report
   WHERE admin_feedback_report.id IN (199, 200)
     AND admin_feedback_report.status = 'planned'
     AND admin_feedback_report.summary = 'Amend Current Intervention'
     AND admin_feedback_report.submitted_by_staff_profile_id = 54
     AND admin_feedback_report.submitted_by_email = 'acurtis@nwac.ca'
     AND admin_feedback_report.updated_at = '2026-09-03 17:46:58'
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_verify_report_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_note
   WHERE admin_feedback_note.report_id IN (199, 200)
     AND admin_feedback_note.note_text LIKE 'PROD_VERIFIED_20260903_FEEDBACK_199_200:%'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_verify_note_exists';
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
    'PROD_VERIFIED_20260903_FEEDBACK_199_200: Release 20260903-feedback-199-200-revision-hotfix-r1 deployed to PROD from exact clean commit 975446f840b26dae81955d107234fefd1fc7a057. Replacement instance i-0b75c16887a2b4046 passed local health, target-group health, exact provenance and deployed-file hash checks, and normal-routing /readyz returned 200. Report remains Planned until Amanda Curtis rechecks the amendment journey on case 40 using her Regional Manager access.'
  ),
  (
    200,
    1,
    'Bill Sillery',
    'bill@sillery.co.uk',
    'PROD_VERIFIED_20260903_FEEDBACK_199_200: Release 20260903-feedback-199-200-revision-hotfix-r1 deployed to PROD from exact clean commit 975446f840b26dae81955d107234fefd1fc7a057. Replacement instance i-0b75c16887a2b4046 passed local health, target-group health, exact provenance and deployed-file hash checks, and normal-routing /readyz returned 200. Report remains Planned until Amanda Curtis rechecks the revision journey on case 134 using her Regional Manager access.'
  );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_199_200_release_verify_note_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_199_200_release_verify_20260903();
DROP PROCEDURE prod_feedback_199_200_release_verify_20260903;
