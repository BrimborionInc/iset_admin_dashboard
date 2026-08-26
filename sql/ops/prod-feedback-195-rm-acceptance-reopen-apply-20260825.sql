-- Reopen PROD feedback #195 because System Administrator verification did not
-- prove the reported Regional Manager journey.
-- Scope: feedback report status, one status-history row, and one corrective note.
-- No client, case, application, participant, or workflow data is mutated.

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text)
SELECT 195,
       NULL,
       'Codex',
       NULL,
       'Codex acceptance retraction 2026-08-25: The immediately preceding live-acceptance note incorrectly treated Bill''s successful edit as proof of the reported Regional Manager journey. Bill has clarified that he was signed into PROD as System Administrator. That result proves the current deployed Participant Details path can work for System Administrator only; it does not prove that Emilie can perform the same correction under Regional Manager authorization and scope. Feedback #195 is therefore reopened to triaging. Do not resolve it until the exact deployed Regional Manager role, case 279 / application 218 scope, request, response, persistence, and reload behavior have been reproduced and verified.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.status = 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE admin_feedback_note.report_id = 195
        AND admin_feedback_note.note_text = 'Codex acceptance retraction 2026-08-25: The immediately preceding live-acceptance note incorrectly treated Bill''s successful edit as proof of the reported Regional Manager journey. Bill has clarified that he was signed into PROD as System Administrator. That result proves the current deployed Participant Details path can work for System Administrator only; it does not prove that Emilie can perform the same correction under Regional Manager authorization and scope. Feedback #195 is therefore reopened to triaging. Do not resolve it until the exact deployed Regional Manager role, case 279 / application 218 scope, request, response, persistence, and reload behavior have been reproduced and verified.'
   );

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email)
SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       'triaging',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.status = 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE admin_feedback_status_history.report_id = 195
        AND admin_feedback_status_history.previous_status = 'resolved'
        AND admin_feedback_status_history.new_status = 'triaging'
        AND admin_feedback_status_history.changed_by_name = 'Codex'
   );

UPDATE admin_feedback_report
   SET status = 'triaging'
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.status = 'resolved';

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 195
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 195
 ORDER BY admin_feedback_note.id;
