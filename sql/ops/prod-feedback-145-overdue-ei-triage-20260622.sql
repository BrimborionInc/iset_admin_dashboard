-- PROD feedback #145 Overdue/EI validation triage for 2026-06-22.
-- Scope: admin_feedback_note only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 145, NULL, @actor_name, @actor_email,
       'Codex triage 2026-06-22: The homepage Work Queue Overdue bucket is derived from application workflow timing, not a stored Overdue status. Application rows enter Overdue when the active SLA stage due date has passed. The active stage is derived from application status, assignment, and iset_application_assessment.esdc_eligibility: unassigned files use Assignment; assigned files with blank esdc_eligibility use EI Status Verification; files with eligibility recorded use Assessment; pending approval uses Program decision. Current PROD targets are Assignment 48h, EI Status Verification 72h, Assessment 504h, Program decision 576h. Live check found one current overdue EI-validation row, case 173 / application 104, assigned to mcoppola@nwac.ca, submitted 2026-06-16 17:37:03, due 2026-06-19 17:37:03, with required EI consent document present but no application assessment esdc_eligibility value/row. So the practical cause is that EI may have been completed/uploaded/documented outside the structured EI eligibility field; the queue clears only after the eligibility value is saved via Set Eligibility/Application Assessment. No client/case/application/document data changed during triage. Keep triaging pending Bill response to Shelley.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 145
          AND note_text LIKE 'Codex triage 2026-06-22: The homepage Work Queue Overdue bucket is derived from application workflow timing%'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 145, NULL, @actor_name, @actor_email,
       'Codex clarification 2026-06-22: Product diagnosis for Shelley/Bill: this is not a confirmed bad-overdue-calculation bug, and it should not be framed as staff fault. It is a workflow/UX gap. PATH currently treats EI verification as two separate things: the evidence/document may exist, but the file only leaves Awaiting EI Validation once the EI eligibility outcome is recorded in the structured field. If staff complete EI verification outside the Set Eligibility/Application Assessment step, PATH still sees the file as waiting for EI and, after the target date, shows it as overdue. Recommended staff answer: record the EI eligibility result in PATH for any file that has already been verified. Recommended product follow-up: make the queue/action wording clearer and consider reconciling EI verification uploads with the structured eligibility result.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 145
          AND note_text LIKE 'Codex clarification 2026-06-22: Product diagnosis for Shelley/Bill%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 145;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 145
 ORDER BY id DESC
 LIMIT 3;
