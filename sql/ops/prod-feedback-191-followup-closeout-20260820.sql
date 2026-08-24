-- Guarded PROD feedback-log closeout for report #191.
-- Bill confirmed that Kelly's message is a successful follow-up to an earlier
-- fix, not a permission request or a new defect.
--
-- Scope is limited to admin_feedback_report, admin_feedback_status_history,
-- and admin_feedback_note. No client, case, application, document, message,
-- schema, runtime configuration, code, or external-provider data is changed.

CREATE TEMPORARY TABLE tmp_feedback_191_closeout_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
);

SET @feedback_191_closeout_at := UTC_TIMESTAMP();
SET @feedback_191_actor_name := 'Codex';
SET @feedback_191_actor_email := 'codex@openai.com';
SET @feedback_191_note := 'Codex queue closeout 2026-08-20: Bill confirmed this message was Kelly''s follow-up on an earlier fix. Kelly reported that she can now delete duplicate documents from the referenced file, so this is a successful confirmation rather than a permission request or new defect. Closed as a non-actionable follow-up. No client, case, application, document, message, schema, runtime configuration, code, or external-provider data changed in this closeout.';

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_email,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 191
 FOR UPDATE;

SET @feedback_191_report_count := (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE admin_feedback_report.id = 191
     AND admin_feedback_report.report_type = 'bug'
     AND admin_feedback_report.severity = 'medium'
     AND admin_feedback_report.status = 'submitted'
     AND admin_feedback_report.summary = 'Delete'
     AND admin_feedback_report.submitted_by_staff_profile_id = 58
     AND admin_feedback_report.submitted_by_email = 'k.hyde@keepersofthecircle.com'
     AND admin_feedback_report.submitted_at = '2026-08-20 16:07:43'
     AND admin_feedback_report.updated_at = '2026-08-20 16:07:43'
);

SET @feedback_191_initial_history_count := (
  SELECT COUNT(*)
    FROM admin_feedback_status_history
   WHERE admin_feedback_status_history.id = 615
     AND admin_feedback_status_history.report_id = 191
     AND admin_feedback_status_history.previous_status IS NULL
     AND admin_feedback_status_history.new_status = 'submitted'
     AND admin_feedback_status_history.changed_by_staff_profile_id = 58
     AND admin_feedback_status_history.changed_by_email = 'k.hyde@keepersofthecircle.com'
     AND admin_feedback_status_history.changed_at = '2026-08-20 16:07:43'
);

SET @feedback_191_existing_note_count := (
  SELECT COUNT(*)
    FROM admin_feedback_note
   WHERE admin_feedback_note.report_id = 191
);

SET @feedback_191_existing_closeout_history_count := (
  SELECT COUNT(*)
    FROM admin_feedback_status_history
   WHERE admin_feedback_status_history.report_id = 191
     AND admin_feedback_status_history.previous_status = 'submitted'
     AND admin_feedback_status_history.new_status = 'closed'
);

SET @feedback_191_closeout_ready := (
  @feedback_191_report_count = 1
  AND @feedback_191_initial_history_count = 1
  AND @feedback_191_existing_note_count = 0
  AND @feedback_191_existing_closeout_history_count = 0
);

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
VALUES ('closeout_ready');

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
SELECT 'closeout_ready'
 WHERE @feedback_191_closeout_ready <> 1;

UPDATE admin_feedback_report
   SET status = 'closed',
       updated_at = @feedback_191_closeout_at
 WHERE admin_feedback_report.id = 191
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.updated_at = '2026-08-20 16:07:43';

SET @feedback_191_updated_report_count := ROW_COUNT();

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
VALUES ('one_report_updated');

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
SELECT 'one_report_updated'
 WHERE @feedback_191_updated_report_count <> 1;

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email,
   changed_at)
VALUES
  (191,
   'submitted',
   'closed',
   NULL,
   @feedback_191_actor_name,
   @feedback_191_actor_email,
   @feedback_191_closeout_at);

SET @feedback_191_inserted_history_count := ROW_COUNT();

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
VALUES ('one_history_inserted');

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
SELECT 'one_history_inserted'
 WHERE @feedback_191_inserted_history_count <> 1;

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text,
   created_at)
VALUES
  (191,
   NULL,
   @feedback_191_actor_name,
   @feedback_191_actor_email,
   @feedback_191_note,
   @feedback_191_closeout_at);

SET @feedback_191_inserted_note_count := ROW_COUNT();

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
VALUES ('one_note_inserted');

INSERT INTO tmp_feedback_191_closeout_guard (guard_key)
SELECT 'one_note_inserted'
 WHERE @feedback_191_inserted_note_count <> 1;

SELECT @feedback_191_report_count,
       @feedback_191_initial_history_count,
       @feedback_191_existing_note_count,
       @feedback_191_existing_closeout_history_count,
       @feedback_191_updated_report_count,
       @feedback_191_inserted_history_count,
       @feedback_191_inserted_note_count;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 191;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_by_email,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 191
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.author_email,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 191
 ORDER BY admin_feedback_note.id;

COMMIT;

DROP TEMPORARY TABLE tmp_feedback_191_closeout_guard;
