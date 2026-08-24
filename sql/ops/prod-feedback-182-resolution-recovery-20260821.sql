-- Audit-preserving recovery for the feedback 182 resolution closeout. Run only
-- if the exact resolution rows remain current and the technical repair must be
-- recovered for a verified reason.

CREATE TEMPORARY TABLE tmp_feedback_182_resolution_recovery_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

SET @feedback_182_resolution_recovery_at := CURRENT_TIMESTAMP;
SET @feedback_182_resolution_recovery_note := 'Codex recovery: Reopened feedback 182 because the 2026-08-21 technical resolution closeout was recovered. The original resolution status-history row and note were retained as audit evidence.';
SET @feedback_182_resolution_at := NULL;

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 182
 FOR UPDATE;

SELECT admin_feedback_status_history.changed_at
  INTO @feedback_182_resolution_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 182
   AND admin_feedback_status_history.previous_status = 'in_progress'
   AND admin_feedback_status_history.new_status = 'resolved'
   AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
   AND admin_feedback_status_history.changed_by_name = 'Codex'
   AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
 ORDER BY admin_feedback_status_history.id DESC
 LIMIT 1
 FOR UPDATE;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 182
 ORDER BY admin_feedback_note.id
 FOR UPDATE;

INSERT INTO tmp_feedback_182_resolution_recovery_guard (guard_key)
VALUES ('recovery_preconditions_match');

INSERT INTO tmp_feedback_182_resolution_recovery_guard (guard_key)
SELECT 'recovery_preconditions_match'
 WHERE NOT (
       @feedback_182_resolution_at IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 182
            AND admin_feedback_report.status = 'resolved'
            AND admin_feedback_report.updated_at = @feedback_182_resolution_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text LIKE 'Codex resolution 2026-08-21:%'
            AND admin_feedback_note.created_at = @feedback_182_resolution_at
       )
       AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.changed_at > @feedback_182_resolution_at
       )
       AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.created_at > @feedback_182_resolution_at
       )
     );

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @feedback_182_resolution_recovery_at
 WHERE admin_feedback_report.id = 182
   AND admin_feedback_report.status = 'resolved'
   AND admin_feedback_report.updated_at = @feedback_182_resolution_at;

SET @feedback_182_recovery_report_rows := ROW_COUNT();

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email,
   changed_at)
VALUES
  (182,
   'resolved',
   'in_progress',
   NULL,
   'Codex',
   'codex@openai.com',
   @feedback_182_resolution_recovery_at);

SET @feedback_182_recovery_history_rows := ROW_COUNT();

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text,
   created_at)
VALUES
  (182,
   NULL,
   'Codex',
   'codex@openai.com',
   @feedback_182_resolution_recovery_note,
   @feedback_182_resolution_recovery_at);

SET @feedback_182_recovery_note_rows := ROW_COUNT();

INSERT INTO tmp_feedback_182_resolution_recovery_guard (guard_key)
VALUES ('recovery_rows_match');

INSERT INTO tmp_feedback_182_resolution_recovery_guard (guard_key)
SELECT 'recovery_rows_match'
 WHERE NOT (
       @feedback_182_recovery_report_rows = 1
       AND @feedback_182_recovery_history_rows = 1
       AND @feedback_182_recovery_note_rows = 1
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 182
            AND admin_feedback_report.status = 'in_progress'
            AND admin_feedback_report.updated_at = @feedback_182_resolution_recovery_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.previous_status = 'resolved'
            AND admin_feedback_status_history.new_status = 'in_progress'
            AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
            AND admin_feedback_status_history.changed_by_name = 'Codex'
            AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
            AND admin_feedback_status_history.changed_at = @feedback_182_resolution_recovery_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_182_resolution_recovery_note
            AND admin_feedback_note.created_at = @feedback_182_resolution_recovery_at
       )
     );

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 182;

DROP TEMPORARY TABLE tmp_feedback_182_resolution_recovery_guard;
