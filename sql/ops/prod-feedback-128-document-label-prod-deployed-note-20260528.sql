-- PROD feedback #128 deployed note for 2026-05-28.
-- Scope: admin_feedback_* tables only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 128;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 128, NULL, @actor_name, @actor_email,
       'Codex deploy note 2026-05-28: Admin release 20260528-prod-evening-batch is live in PROD. The release includes the Supporting Documents inline label rename fix plus the Edit document details and Duplicate document modal context fix for client-scoped identity/status documents. PROD deploy evidence: admin-only rollout, schema/data/portal/shared skipped, ASG refresh 70388e81-c030-4234-a65c-a552f6e04925 completed successfully on instance i-03ab1b7f6a30c6fb6, normal-routing admin health smoke returned 200, and deployed-source marker checks found release notes, PATH follow-up state, Supporting Documents applyClientScopeContext, and the ILMP mixed-separator barrier mapping. Keep this report in_progress until the reporter/staff recheck confirms document label edits now stick in the live Supporting Documents widget.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 128)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 128
        AND note_text LIKE 'Codex deploy note 2026-05-28: Admin release 20260528-prod-evening-batch is live in PROD%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 128;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 128
 ORDER BY id DESC
 LIMIT 3;
