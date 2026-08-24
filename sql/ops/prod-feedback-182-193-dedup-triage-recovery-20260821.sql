-- Audit-preserving recovery for the feedback #182/#193 triage transaction.
-- Use only if the duplicate classification must be withdrawn before any later
-- feedback activity. This reopens #193 while preserving the original triage
-- history and notes. It never touches case, application, message, signing,
-- document, schema, runtime-configuration, notification, or provider data.

CREATE TEMPORARY TABLE tmp_feedback_182_193_recovery_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

SET @feedback_182_triage_note := 'Codex continuation triage 2026-08-21 from duplicate feedback 193: The reporter follow-up and live evidence confirm the August 10 hotfix allowed the real approval letter to send on August 11 and all attached forms to be signed. Message 2640 was sent for case 109/application 27; signing requests 187 (approval letter), 188 (Client Funding Agreement), and 189 (EFT form) are signed, and their durable documents exist. However, both the application-scoped applicationDecisionLetters["27"].decisionLetterSent.approval marker and the legacy root decisionLetterSent.approval marker are absent. The current assessment UI derives the Funding forms and signatures step from that marker, so this already-sent record remains on Step 14. Keep in progress. The next bounded work is a guarded one-record marker repair plus a targeted assigned-Coordinator recheck of Step 15 and application completion; the current PROD build already contains the newer atomic send-path persistence, but that does not repair this August 11 record retroactively. No case, application, message, signing-request, document, schema, runtime-configuration, notification, or provider data changed during this triage.';
SET @feedback_193_triage_note := 'Codex triage 2026-08-21: This is a continuation and duplicate of feedback 182, not a second independent issue. Live PROD evidence confirms the approval-letter send succeeded: message 2640 was created on 2026-08-11 for case 109/application 27, the applicant replied in message 2718, signing requests 187 (approval letter), 188 (Client Funding Agreement), and 189 (EFT form) are signed, and the corresponding documents exist. The remaining Step 14 block is real: both the application-scoped applicationDecisionLetters["27"].decisionLetterSent.approval marker and the legacy root decisionLetterSent.approval marker are absent, so the current UI cannot surface the Funding forms and signatures step for this historical send. Closed this duplicate; canonical feedback 182 remains in progress for a guarded one-record repair and complete live workflow recheck. No case, application, message, signing-request, document, schema, runtime-configuration, notification, or provider data changed during this triage.';
SET @feedback_182_recovery_note := 'Codex recovery 2026-08-21: The preceding note linking feedback 193 as a duplicate was withdrawn for renewed investigation, and feedback 193 was returned to submitted. The original triage evidence remains in the audit trail and must be reassessed; feedback 182 remains in progress. This recovery changed feedback metadata only.';
SET @feedback_193_recovery_note := 'Codex recovery 2026-08-21: Feedback 193 was returned from closed to submitted for renewed investigation. The preceding duplicate classification and evidence remain in the audit trail and must be reassessed before any later status change. This recovery changed feedback metadata only.';

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id IN (182, 193)
 ORDER BY admin_feedback_report.id
 FOR UPDATE;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_staff_profile_id,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_by_email,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id IN (182, 193)
 ORDER BY admin_feedback_status_history.report_id,
          admin_feedback_status_history.id
 FOR UPDATE;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_staff_profile_id,
       admin_feedback_note.author_name,
       admin_feedback_note.author_email,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id IN (182, 193)
 ORDER BY admin_feedback_note.report_id,
          admin_feedback_note.id
 FOR UPDATE;

SET @feedback_182_193_apply_at := NULL;

SELECT admin_feedback_report.updated_at
  INTO @feedback_182_193_apply_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 193
   AND admin_feedback_report.status = 'closed'
 FOR UPDATE;

INSERT INTO tmp_feedback_182_193_recovery_guard (guard_key)
VALUES ('recovery_preconditions_match');

-- Fail closed unless the exact post-apply state remains intact. The common
-- timestamp ties the report transition and both evidence notes to one apply.
INSERT INTO tmp_feedback_182_193_recovery_guard (guard_key)
SELECT 'recovery_preconditions_match'
 WHERE NOT (
       @feedback_182_193_apply_at IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 182
            AND admin_feedback_report.status = 'in_progress'
            AND admin_feedback_report.updated_at = '2026-08-10 21:02:05'
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 193
            AND admin_feedback_report.report_type = 'bug'
            AND admin_feedback_report.severity = 'medium'
            AND admin_feedback_report.status = 'closed'
            AND admin_feedback_report.summary = 'Alyssa''s File'
            AND admin_feedback_report.submitted_by_staff_profile_id = 60
            AND admin_feedback_report.submitted_at = '2026-08-21 15:15:54'
            AND admin_feedback_report.updated_at = @feedback_182_193_apply_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.id = 588
            AND admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.previous_status IS NULL
            AND admin_feedback_status_history.new_status = 'submitted'
            AND admin_feedback_status_history.changed_at = '2026-08-10 18:10:36'
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.id = 589
            AND admin_feedback_status_history.report_id = 182
            AND admin_feedback_status_history.previous_status = 'submitted'
            AND admin_feedback_status_history.new_status = 'in_progress'
            AND admin_feedback_status_history.changed_at = '2026-08-10 21:02:05'
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.id = 619
            AND admin_feedback_status_history.report_id = 193
            AND admin_feedback_status_history.previous_status IS NULL
            AND admin_feedback_status_history.new_status = 'submitted'
            AND admin_feedback_status_history.changed_at = '2026-08-21 15:15:54'
       )
       AND (
         SELECT COUNT(*)
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id = 193
            AND admin_feedback_status_history.previous_status = 'submitted'
            AND admin_feedback_status_history.new_status = 'closed'
            AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
            AND admin_feedback_status_history.changed_by_name = 'Codex'
            AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
            AND admin_feedback_status_history.changed_at = @feedback_182_193_apply_at
       ) = 1
       AND (
         SELECT COUNT(*)
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id IN (182, 193)
       ) = 4
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.id = 531
            AND admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.created_at = '2026-08-10 21:02:05'
       )
       AND (
         SELECT COUNT(*)
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_182_triage_note
            AND admin_feedback_note.created_at = @feedback_182_193_apply_at
       ) = 1
       AND (
         SELECT COUNT(*)
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 193
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_193_triage_note
            AND admin_feedback_note.created_at = @feedback_182_193_apply_at
       ) = 1
       AND (
         SELECT COUNT(*)
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id IN (182, 193)
       ) = 3
     );

SET @feedback_182_193_recovery_at := CURRENT_TIMESTAMP;

UPDATE admin_feedback_report
   SET status = 'submitted',
       updated_at = @feedback_182_193_recovery_at
 WHERE admin_feedback_report.id = 193
   AND admin_feedback_report.status = 'closed'
   AND admin_feedback_report.updated_at = @feedback_182_193_apply_at;

SET @feedback_182_193_recovery_report_rows := ROW_COUNT();

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email,
   changed_at)
VALUES
  (193,
   'closed',
   'submitted',
   NULL,
   'Codex',
   'codex@openai.com',
   @feedback_182_193_recovery_at);

SET @feedback_182_193_recovery_history_rows := ROW_COUNT();

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
   @feedback_182_recovery_note,
   @feedback_182_193_recovery_at),
  (193,
   NULL,
   'Codex',
   'codex@openai.com',
   @feedback_193_recovery_note,
   @feedback_182_193_recovery_at);

SET @feedback_182_193_recovery_note_rows := ROW_COUNT();

INSERT INTO tmp_feedback_182_193_recovery_guard (guard_key)
VALUES ('recovery_rows_written');

INSERT INTO tmp_feedback_182_193_recovery_guard (guard_key)
SELECT 'recovery_rows_written'
 WHERE NOT (
       @feedback_182_193_recovery_report_rows = 1
       AND @feedback_182_193_recovery_history_rows = 1
       AND @feedback_182_193_recovery_note_rows = 2
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 193
            AND admin_feedback_report.status = 'submitted'
            AND admin_feedback_report.updated_at = @feedback_182_193_recovery_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_182_recovery_note
            AND admin_feedback_note.created_at = @feedback_182_193_recovery_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id = 193
            AND admin_feedback_status_history.previous_status = 'closed'
            AND admin_feedback_status_history.new_status = 'submitted'
            AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
            AND admin_feedback_status_history.changed_by_name = 'Codex'
            AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
            AND admin_feedback_status_history.changed_at = @feedback_182_193_recovery_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 193
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_193_recovery_note
            AND admin_feedback_note.created_at = @feedback_182_193_recovery_at
       )
       AND (
         SELECT COUNT(*)
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id IN (182, 193)
       ) = 5
       AND (
         SELECT COUNT(*)
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id IN (182, 193)
       ) = 5
     );

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id IN (182, 193)
 ORDER BY admin_feedback_report.id;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_by_email,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id IN (182, 193)
 ORDER BY admin_feedback_status_history.report_id,
          admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.author_email,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id IN (182, 193)
 ORDER BY admin_feedback_note.report_id,
          admin_feedback_note.id;

DROP TEMPORARY TABLE tmp_feedback_182_193_recovery_guard;
