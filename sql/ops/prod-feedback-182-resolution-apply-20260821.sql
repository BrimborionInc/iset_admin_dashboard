-- Guarded PROD closeout for canonical feedback report 182 after the verified
-- one-record approval-letter marker repair.

CREATE TEMPORARY TABLE tmp_feedback_182_resolution_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

SET @feedback_182_resolution_at := CURRENT_TIMESTAMP;
SET @feedback_182_resolution_note := 'Codex resolution 2026-08-21: Applied a guarded one-record PROD repair to application 27/case 109 after live-DDL and exact-evidence preflight. Added the application-scoped approval-letter-sent marker using the durable approval-letter artifact time 2026-08-11T15:08:14.000Z. Independent verification proved the repaired case-context hash is exact and that removing only the marker reproduces the complete original context hash. Application status remains approved, lifecycle remains decision_recorded, outcome remains approved, awaiting reason remains none, and closure reason remains null; only the required application concurrency version advanced from 81 to 82 with the repair timestamp. Message 2640, signed requests 187/188/189, and documents 10383/10632/10633/10634/10635 remain intact. Current code reads this marker to expose Funding forms and signatures and prevent a duplicate approval-letter send; both focused workflow suites passed, 21 tests total. The August 15 atomic persistence patch prevents this split-write condition on current sends, and the full live residual inventory found no other currently approved application missing every recognized approval marker. Resolved without using the reporter for trial-and-error acceptance. No message, signing request, document, notification, payment, schema, runtime configuration, or provider data was changed by the repair.';

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 182
 FOR UPDATE;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 182
 ORDER BY admin_feedback_status_history.id
 FOR UPDATE;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 182
 ORDER BY admin_feedback_note.id
 FOR UPDATE;

INSERT INTO tmp_feedback_182_resolution_guard (guard_key)
VALUES ('preconditions_match');

INSERT INTO tmp_feedback_182_resolution_guard (guard_key)
SELECT 'preconditions_match'
 WHERE NOT (
       EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 182
            AND admin_feedback_report.report_type = 'bug'
            AND admin_feedback_report.severity = 'medium'
            AND admin_feedback_report.status = 'in_progress'
            AND admin_feedback_report.summary = 'Alyssa''s Approval Letter'
            AND admin_feedback_report.submitted_at = '2026-08-10 18:10:36'
            AND admin_feedback_report.updated_at = '2026-08-10 21:02:05'
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.id = 588
            AND admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.previous_status IS NULL
            AND admin_feedback_status_history.new_status = 'submitted'
            AND admin_feedback_status_history.changed_by_staff_profile_id = 60
            AND admin_feedback_status_history.changed_at = '2026-08-10 18:10:36'
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.id = 589
            AND admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.previous_status = 'submitted'
            AND admin_feedback_status_history.new_status = 'in_progress'
            AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
            AND admin_feedback_status_history.changed_by_name = 'Codex'
            AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
            AND admin_feedback_status_history.changed_at = '2026-08-10 21:02:05'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.id NOT IN (588, 589)
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.id = 531
            AND admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.created_at = '2026-08-10 21:02:05'
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.id = 551
            AND admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.created_at = '2026-08-21 16:57:37'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.id NOT IN (531, 551)
       )
     );

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @feedback_182_resolution_at
 WHERE admin_feedback_report.id = 182
   AND admin_feedback_report.status = 'in_progress'
   AND admin_feedback_report.updated_at = '2026-08-10 21:02:05';

SET @feedback_182_resolution_report_rows := ROW_COUNT();

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
   'in_progress',
   'resolved',
   NULL,
   'Codex',
   'codex@openai.com',
   @feedback_182_resolution_at);

SET @feedback_182_resolution_history_rows := ROW_COUNT();

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
   @feedback_182_resolution_note,
   @feedback_182_resolution_at);

SET @feedback_182_resolution_note_rows := ROW_COUNT();

INSERT INTO tmp_feedback_182_resolution_guard (guard_key)
VALUES ('resolution_rows_match');

INSERT INTO tmp_feedback_182_resolution_guard (guard_key)
SELECT 'resolution_rows_match'
 WHERE NOT (
       @feedback_182_resolution_report_rows = 1
       AND @feedback_182_resolution_history_rows = 1
       AND @feedback_182_resolution_note_rows = 1
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 182
            AND admin_feedback_report.status = 'resolved'
            AND admin_feedback_report.updated_at = @feedback_182_resolution_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.previous_status = 'in_progress'
            AND admin_feedback_status_history.new_status = 'resolved'
            AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
            AND admin_feedback_status_history.changed_by_name = 'Codex'
            AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
            AND admin_feedback_status_history.changed_at = @feedback_182_resolution_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_182_resolution_note
            AND admin_feedback_note.created_at = @feedback_182_resolution_at
       )
     );

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 182;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_by_email,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 182
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.author_email,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 182
 ORDER BY admin_feedback_note.id;

DROP TEMPORARY TABLE tmp_feedback_182_resolution_guard;
