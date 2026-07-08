-- PROD feedback #156 EI gate triage.
-- Scope: admin_feedback_* tables only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status_156
  FROM admin_feedback_report
 WHERE id = 156
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = CASE WHEN @previous_status_156 = 'submitted' THEN 'triaging' ELSE status END,
       updated_at = @note_at
 WHERE id = 156
   AND @previous_status_156 IS NOT NULL;

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 156, @previous_status_156, 'triaging', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_156 = 'submitted'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 156
        AND previous_status = @previous_status_156
        AND new_status = 'triaging'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 156, NULL, @actor_name, @actor_email,
       'Codex triage 2026-07-06: Live case 199 / application 133 has the EI verification document present (document 5326, document_type ei_verification) and the structured EI eligibility value saved as CRF in iset_application_assessment. No active application lock remains. The reported lockout is a workflow/UX issue: assessment editability is gated by the structured EI status, while Kelly is an ISET Coordinator and cannot set that field; if the assessment panel has stale case data or the value is missing on another file, the coordinator sees EI as not checked and cannot clear the gate despite an EI report being uploaded. Immediate case data repair is not required for this file. Product fix should refresh/reconcile the assessment EI state after eligibility/document changes and avoid trapping coordinators behind an admin/RM-only EI gate; wording should distinguish EI report uploaded from EI status recorded.',
       @note_at
 WHERE @previous_status_156 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 156
        AND note_text LIKE 'Codex triage 2026-07-06: Live case 199 / application 133 has the EI verification document present%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 156;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 156
 ORDER BY changed_at DESC, id DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 156
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
