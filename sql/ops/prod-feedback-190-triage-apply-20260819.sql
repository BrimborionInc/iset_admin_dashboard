-- Guarded PROD feedback-log triage update for feedback #190.
-- Scope: feedback metadata only. No message, mailbox, case, application,
-- applicant, document, event, notification, or runtime row is mutated.
--
-- Required preconditions:
--   * exact PROD identity has been proved in the current task;
--   * current full DDL/columns/indexes are captured for
--     admin_feedback_report, admin_feedback_status_history, and
--     admin_feedback_note;
--   * the read-only preview still shows report 190 in submitted state with the
--     exact reporter, type, severity, summary, and original timestamps below.

CREATE TEMPORARY TABLE tmp_feedback_190_triage_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
);

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 190
 FOR UPDATE;

INSERT INTO tmp_feedback_190_triage_guard (guard_key)
VALUES ('feedback_190_ready');

-- Fail closed through a duplicate primary key if the reviewed report identity
-- or state changed after preview.
INSERT INTO tmp_feedback_190_triage_guard (guard_key)
SELECT 'feedback_190_ready'
 WHERE NOT EXISTS (
       SELECT 1
         FROM admin_feedback_report
        WHERE admin_feedback_report.id = 190
          AND admin_feedback_report.report_type = 'bug'
          AND admin_feedback_report.severity = 'medium'
          AND admin_feedback_report.status = 'submitted'
          AND admin_feedback_report.summary = 'Applicant replied message'
          AND admin_feedback_report.submitted_by_staff_profile_id = 55
          AND admin_feedback_report.submitted_at = '2026-08-19 13:23:49'
          AND admin_feedback_report.updated_at = '2026-08-19 13:23:49'
     );

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email)
VALUES
  (190, 'submitted', 'triaging', NULL, 'Codex', NULL);

UPDATE admin_feedback_report
   SET status = 'triaging'
 WHERE admin_feedback_report.id = 190
   AND admin_feedback_report.status = 'submitted';

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text)
VALUES
  (
    190,
    NULL,
    'Codex',
    NULL,
    'Codex triage 2026-08-19: Live PROD evidence proves there is no applicant-origin message on case 229 / application 168. Messages 2396, 2590, and 3046 are all staff_profile 55 to applicant_user 383. Event evidence shows message 3046 was sent on 2026-08-18 with reply_to_message_id 2590. The admin reply writer then set outbound message 2590 status to replied, and the Sent UI translated that generic value to Applicant replied even though the reply was another staff follow-up. All three applicant mailbox rows remain in inbox, unread, and not deleted or purged. This is a false direction/status label, not a missing applicant message. Keep triaging pending a direction-aware reply-status fix and complete TEST validation covering staff follow-up to an outbound message and a real applicant reply.'
  );

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 190;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 190
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 190
 ORDER BY admin_feedback_note.id;

DROP TEMPORARY TABLE tmp_feedback_190_triage_guard;
