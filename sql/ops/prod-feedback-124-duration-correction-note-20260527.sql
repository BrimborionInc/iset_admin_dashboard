-- PROD feedback #124 correction note for 2026-05-27.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 124, NULL, @actor_name, @actor_email,
       'Codex correction 2026-05-27: Follow-up PROD inspection shows case 120 does not currently contain a >999-day saved intervention. The relevant hairstyling intervention/revision is dated 2026-09-01 to 2027-08-31 (365 inclusive days; stored duration currently 364 from the legacy calculation), and the living-allowance recurrence rows show 12 installments. The DEV duration-cap fix remains useful for the hidden-duration validation class, but it should not be treated as proven root cause for Kelly''s exact report without reproducing her unsaved edit. Current likely workaround to try before deploy: edit the existing residence-related Living allowance cost line to Residence Costs instead of delete/add, set the intended total, and leave installments disabled/blank. If that still blocks, stop and capture the highlighted field/error screenshot; a controlled PROD draft repair can be prepared if Bill confirms the intended final cost lines.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 124)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 124
        AND note_text LIKE 'Codex correction 2026-05-27: Follow-up PROD inspection shows case 120 does not currently contain a >999-day saved intervention%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 124;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 600) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 124
 ORDER BY id DESC
 LIMIT 4;
