-- PROD feedback #141 CFA draft gap note for 2026-06-11.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @previous_status_141 := NULL;

START TRANSACTION;

SELECT status
  INTO @previous_status_141
  FROM admin_feedback_report
 WHERE id = 141
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 141
   AND @previous_status_141 IS NOT NULL
   AND @previous_status_141 <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 141, @previous_status_141, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_141 IS NOT NULL
   AND @previous_status_141 <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 141
        AND previous_status = @previous_status_141
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 141, NULL, @actor_name, @actor_email,
       'Codex update 2026-06-11: Amanda''s question is about the missing Client Funding Agreement draft/signing artifact after a renewable/intervention amendment approval. Root cause appears to be the case/intervention being manually created/backloaded: PATH treated the intervention as historical data and skipped the automatic revised funding-agreement draft step that normally runs for system-created approvals. DEV/local fix is prepared so an explicit approved intervention/revision letter send that needs a funding agreement first creates the missing CFA draft from the selected intervention action plan, then falls back to the older assessment-based draft path if needed. Current workaround until this is deployed and verified in PROD: manually send a secure message with the CFA/funding agreement selected as an attachment; that send path will generate the missing CFA draft. Keep this report in_progress until the fix is deployed and the live workflow/artifacts are rechecked.',
       @note_at
 WHERE @previous_status_141 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 141
        AND note_text LIKE 'Codex update 2026-06-11: Amanda''s question is about the missing Client Funding Agreement draft%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 141;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 141
 ORDER BY id DESC
 LIMIT 3;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 141
 ORDER BY id DESC
 LIMIT 3;
