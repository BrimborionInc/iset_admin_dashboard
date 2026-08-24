-- Guarded PROD feedback-log triage for reports #182 and #193.
--
-- Scope: feedback metadata only. This closes #193 as a duplicate/continuation
-- of #182, records the evidence on both reports, and leaves canonical #182 in
-- progress. No case, application, message, signing-request, document, schema,
-- runtime-configuration, notification, or provider data is changed.
--
-- Required before execution:
--   * exact PROD identity proved in the current task;
--   * current full live DDL/columns/indexes captured for
--     admin_feedback_report, admin_feedback_status_history, and
--     admin_feedback_note;
--   * the current-task read-only preview still matches every guarded row below;
--   * the finished SQL is checked identifier by identifier against that live
--     evidence immediately before execution.

CREATE TEMPORARY TABLE tmp_feedback_182_193_triage_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

SET @feedback_182_193_triage_at := CURRENT_TIMESTAMP;
SET @feedback_182_triage_note := 'Codex continuation triage 2026-08-21 from duplicate feedback 193: The reporter follow-up and live evidence confirm the August 10 hotfix allowed the real approval letter to send on August 11 and all attached forms to be signed. Message 2640 was sent for case 109/application 27; signing requests 187 (approval letter), 188 (Client Funding Agreement), and 189 (EFT form) are signed, and their durable documents exist. However, both the application-scoped applicationDecisionLetters["27"].decisionLetterSent.approval marker and the legacy root decisionLetterSent.approval marker are absent. The current assessment UI derives the Funding forms and signatures step from that marker, so this already-sent record remains on Step 14. Keep in progress. The next bounded work is a guarded one-record marker repair plus a targeted assigned-Coordinator recheck of Step 15 and application completion; the current PROD build already contains the newer atomic send-path persistence, but that does not repair this August 11 record retroactively. No case, application, message, signing-request, document, schema, runtime-configuration, notification, or provider data changed during this triage.';
SET @feedback_193_triage_note := 'Codex triage 2026-08-21: This is a continuation and duplicate of feedback 182, not a second independent issue. Live PROD evidence confirms the approval-letter send succeeded: message 2640 was created on 2026-08-11 for case 109/application 27, the applicant replied in message 2718, signing requests 187 (approval letter), 188 (Client Funding Agreement), and 189 (EFT form) are signed, and the corresponding documents exist. The remaining Step 14 block is real: both the application-scoped applicationDecisionLetters["27"].decisionLetterSent.approval marker and the legacy root decisionLetterSent.approval marker are absent, so the current UI cannot surface the Funding forms and signatures step for this historical send. Closed this duplicate; canonical feedback 182 remains in progress for a guarded one-record repair and complete live workflow recheck. No case, application, message, signing-request, document, schema, runtime-configuration, notification, or provider data changed during this triage.';

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
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id IN (182, 193)
 ORDER BY admin_feedback_note.report_id,
          admin_feedback_note.id
 FOR UPDATE;

INSERT INTO tmp_feedback_182_193_triage_guard (guard_key)
VALUES ('preconditions_match');

-- Fail closed through a duplicate primary key if either report or its audit
-- trail changed after the reviewed preview.
INSERT INTO tmp_feedback_182_193_triage_guard (guard_key)
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
            AND admin_feedback_report.description = 'Hi Bill. I am trying to send Alyssa her approval letter but I am receiving 2-error bugs.'
            AND admin_feedback_report.submitted_by_staff_profile_id = 60
            AND admin_feedback_report.submitted_by_email = 'iset@mmvi.ca'
            AND admin_feedback_report.page_path = '/application-case/109?entry=approval&approvalType=application&step=communication&applicationId=27'
            AND admin_feedback_report.submitted_at = '2026-08-10 18:10:36'
            AND admin_feedback_report.updated_at = '2026-08-10 21:02:05'
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_report
          WHERE admin_feedback_report.id = 193
            AND admin_feedback_report.report_type = 'bug'
            AND admin_feedback_report.severity = 'medium'
            AND admin_feedback_report.status = 'submitted'
            AND admin_feedback_report.summary = 'Alyssa''s File'
            AND admin_feedback_report.description = 'Hi Bill,\r\n\r\nI invitationally submitted a bug on August 11th because the approval letter wasn''t sending to Alyssa. Going back into her file now, it looks like it sent to her but I want to ensure because i am still stuck at step 14 on the assessment which is the letter'
            AND admin_feedback_report.submitted_by_staff_profile_id = 60
            AND admin_feedback_report.submitted_by_email = 'iset@mmvi.ca'
            AND admin_feedback_report.page_path = '/application-case/109?entry=approval&approvalType=application&step=communication&applicationId=27'
            AND admin_feedback_report.submitted_at = '2026-08-21 15:15:54'
            AND admin_feedback_report.updated_at = '2026-08-21 15:15:54'
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
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.id = 619
            AND admin_feedback_status_history.report_id = 193
            AND admin_feedback_status_history.previous_status IS NULL
            AND admin_feedback_status_history.new_status = 'submitted'
            AND admin_feedback_status_history.changed_by_staff_profile_id = 60
            AND admin_feedback_status_history.changed_at = '2026-08-21 15:15:54'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id IN (182, 193)
            AND admin_feedback_status_history.id NOT IN (588, 589, 619)
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.id = 531
            AND admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.created_at = '2026-08-10 21:02:05'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.id <> 531
       )
       AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 193
       )
     );

UPDATE admin_feedback_report
   SET status = 'closed',
       updated_at = @feedback_182_193_triage_at
 WHERE admin_feedback_report.id = 193
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.updated_at = '2026-08-21 15:15:54';

INSERT INTO tmp_feedback_182_193_triage_guard (guard_key)
VALUES ('report_193_closed');

INSERT INTO tmp_feedback_182_193_triage_guard (guard_key)
SELECT 'report_193_closed'
 WHERE NOT EXISTS (
       SELECT 1
         FROM admin_feedback_report
        WHERE admin_feedback_report.id = 193
          AND admin_feedback_report.status = 'closed'
          AND admin_feedback_report.updated_at = @feedback_182_193_triage_at
     );

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
   'submitted',
   'closed',
   NULL,
   'Codex',
   'codex@openai.com',
   @feedback_182_193_triage_at);

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
   @feedback_182_triage_note,
   @feedback_182_193_triage_at),
  (193,
   NULL,
   'Codex',
   'codex@openai.com',
   @feedback_193_triage_note,
   @feedback_182_193_triage_at);

INSERT INTO tmp_feedback_182_193_triage_guard (guard_key)
VALUES ('audit_rows_written');

INSERT INTO tmp_feedback_182_193_triage_guard (guard_key)
SELECT 'audit_rows_written'
 WHERE NOT (
       EXISTS (
         SELECT 1
           FROM admin_feedback_status_history
          WHERE admin_feedback_status_history.report_id = 193
            AND admin_feedback_status_history.previous_status = 'submitted'
            AND admin_feedback_status_history.new_status = 'closed'
            AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
            AND admin_feedback_status_history.changed_by_name = 'Codex'
            AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
            AND admin_feedback_status_history.changed_at = @feedback_182_193_triage_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 182
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_182_triage_note
            AND admin_feedback_note.created_at = @feedback_182_193_triage_at
       )
       AND EXISTS (
         SELECT 1
           FROM admin_feedback_note
          WHERE admin_feedback_note.report_id = 193
            AND admin_feedback_note.author_staff_profile_id IS NULL
            AND admin_feedback_note.author_name = 'Codex'
            AND admin_feedback_note.author_email = 'codex@openai.com'
            AND admin_feedback_note.note_text = @feedback_193_triage_note
            AND admin_feedback_note.created_at = @feedback_182_193_triage_at
       )
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

DROP TEMPORARY TABLE tmp_feedback_182_193_triage_guard;
