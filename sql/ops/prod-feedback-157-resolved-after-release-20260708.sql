-- PROD feedback #157 closeout after 20260708 app release.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @expected_summary := 'Changing EI Status after it has been set and v1 of an assessment has already been submitted';

START TRANSACTION;

SELECT status
  INTO @previous_status
  FROM admin_feedback_report
 WHERE id = 157
   AND submitted_by_email = 'emarion@nwac.ca'
   AND summary = @expected_summary
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @note_at
 WHERE id = 157
   AND status = 'planned'
   AND submitted_by_email = 'emarion@nwac.ca'
   AND summary = @expected_summary;

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 157, @previous_status, 'resolved', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status = 'planned'
   AND EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 157
          AND status = 'resolved'
          AND submitted_by_email = 'emarion@nwac.ca'
          AND summary = @expected_summary
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 157
          AND previous_status = 'planned'
          AND new_status = 'resolved'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 157, NULL, @actor_name, @actor_email,
       'Codex closeout 2026-07-08: Released 20260708-admin-user-ei-notification-fix to PROD after the focused DEV Cognito/browser EI correction smoke passed, the TEST deploy passed normal-routing smoke and deployed-source checks, and the PROD deploy passed normal-routing smoke and deployed-source checks. PROD markers verified release ids in admin/portal, the EI dependency guard, the staff Cognito suppressed-create flow, and the shared applicant-name notification resolver on replacement instance i-02150848df7b6aca7. The prior PROD EI data correction for this report remains complete. Marking resolved.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 157
          AND status = 'resolved'
          AND submitted_by_email = 'emarion@nwac.ca'
          AND summary = @expected_summary
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 157
          AND note_text LIKE 'Codex closeout 2026-07-08: Released 20260708-admin-user-ei-notification-fix%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 157;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 157
 ORDER BY changed_at DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 157
 ORDER BY id DESC
 LIMIT 5;
