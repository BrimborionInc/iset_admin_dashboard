-- PROD feedback #128 modal-path follow-up note for 2026-05-28.
-- Scope: admin_feedback_note only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 128, NULL, @actor_name, @actor_email,
       'Codex follow-up 2026-05-28: Broadened the local Supporting Documents fix after Bill asked whether the Edit document details modal could be used as a workaround before PROD deploy. Code audit found the modal and Duplicate document paths share the same scope edge for client-scoped document types such as identity_document/status_card: they sent label + documentType but no case/application context, so the current PROD endpoint can still fail scope validation on older visible upload rows. Local patch now sends hidden case/application context for client-scoped edit-modal and duplicate-modal saves while keeping those documents stored as client-scoped and not asking staff to attach them to an application. Upload already sends case context when available, and the label-only backend fix covers inline rename. Added regression coverage for the label-only backend branch plus modal/duplicate client-scope context. Keep #128 in_progress until deployed and rechecked in PROD.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 128)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 128
        AND note_text LIKE 'Codex follow-up 2026-05-28: Broadened the local Supporting Documents fix%'
   );

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 128;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 128
 ORDER BY id DESC
 LIMIT 3;
