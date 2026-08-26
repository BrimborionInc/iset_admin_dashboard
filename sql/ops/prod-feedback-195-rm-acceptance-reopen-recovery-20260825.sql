-- Emergency recovery for the feedback #195 RM-acceptance reopen.
-- Do not execute unless Bill retracts the role correction or the reopen is
-- otherwise proven factually wrong.

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'resolved'
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.status = 'triaging';

DELETE FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 195
   AND admin_feedback_status_history.previous_status = 'resolved'
   AND admin_feedback_status_history.new_status = 'triaging'
   AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
   AND admin_feedback_status_history.changed_by_name = 'Codex'
   AND admin_feedback_status_history.changed_by_email IS NULL;

DELETE FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 195
   AND admin_feedback_note.author_staff_profile_id IS NULL
   AND admin_feedback_note.author_name = 'Codex'
   AND admin_feedback_note.author_email IS NULL
   AND admin_feedback_note.note_text = 'Codex acceptance retraction 2026-08-25: The immediately preceding live-acceptance note incorrectly treated Bill''s successful edit as proof of the reported Regional Manager journey. Bill has clarified that he was signed into PROD as System Administrator. That result proves the current deployed Participant Details path can work for System Administrator only; it does not prove that Emilie can perform the same correction under Regional Manager authorization and scope. Feedback #195 is therefore reopened to triaging. Do not resolve it until the exact deployed Regional Manager role, case 279 / application 218 scope, request, response, persistence, and reload behavior have been reproduced and verified.';

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195;
