-- PROD feedback #157 planned status after local EI correction fix.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'planned'
 WHERE id = 157
   AND status = 'in_progress'
   AND submitted_by_email = 'emarion@nwac.ca'
   AND summary = 'Changing EI Status after it has been set and v1 of an assessment has already been submitted';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 157, 'in_progress', 'planned', NULL, @actor_name, @actor_email, @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 157
          AND status = 'planned'
          AND submitted_by_email = 'emarion@nwac.ca'
          AND summary = 'Changing EI Status after it has been set and v1 of an assessment has already been submitted'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 157
          AND previous_status = 'in_progress'
          AND new_status = 'planned'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 157, NULL, @actor_name, @actor_email,
       'Codex status update 2026-07-07: Moved report #157 to planned because the local UI/API fix is complete and pending release. The prior PROD data correction remains complete; the product fix still needs deployment and targeted live recheck before this report should move to resolved.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 157
          AND status = 'planned'
          AND submitted_by_email = 'emarion@nwac.ca'
          AND summary = 'Changing EI Status after it has been set and v1 of an assessment has already been submitted'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 157
          AND note_text LIKE 'Codex status update 2026-07-07: Moved report #157 to planned%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 157;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 157
 ORDER BY changed_at DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 157
 ORDER BY id DESC
 LIMIT 5;
