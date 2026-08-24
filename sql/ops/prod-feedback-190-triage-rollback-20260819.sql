-- Audit-preserving recovery for the feedback #190 triage metadata update.
-- Use only if the 2026-08-19 diagnosis must be withdrawn before any later
-- status transition. This does not touch message/case/application data and it
-- deliberately preserves the original triage rows as audit evidence.

CREATE TEMPORARY TABLE tmp_feedback_190_recovery_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
);

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 190
 FOR UPDATE;

INSERT INTO tmp_feedback_190_recovery_guard (guard_key)
VALUES ('feedback_190_recovery_ready');

-- Fail closed if the report has moved past the exact triage state or the
-- original Codex triage note/history is absent.
INSERT INTO tmp_feedback_190_recovery_guard (guard_key)
SELECT 'feedback_190_recovery_ready'
 WHERE NOT EXISTS (
       SELECT 1
         FROM admin_feedback_report
        WHERE admin_feedback_report.id = 190
          AND admin_feedback_report.status = 'triaging'
     )
    OR NOT EXISTS (
       SELECT 1
         FROM admin_feedback_status_history
        WHERE admin_feedback_status_history.report_id = 190
          AND admin_feedback_status_history.previous_status = 'submitted'
          AND admin_feedback_status_history.new_status = 'triaging'
          AND admin_feedback_status_history.changed_by_name = 'Codex'
     )
    OR NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 190
          AND admin_feedback_note.author_name = 'Codex'
          AND admin_feedback_note.note_text LIKE 'Codex triage 2026-08-19: Live PROD evidence proves there is no applicant-origin message%'
     );

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email)
VALUES
  (190, 'triaging', 'submitted', NULL, 'Codex', NULL);

UPDATE admin_feedback_report
   SET status = 'submitted'
 WHERE admin_feedback_report.id = 190
   AND admin_feedback_report.status = 'triaging';

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
    'Codex recovery 2026-08-19: The preceding triage status was returned to submitted for renewed investigation. The original diagnosis remains in the audit trail and must not be relied on without a new evidence review.'
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

DROP TEMPORARY TABLE tmp_feedback_190_recovery_guard;
