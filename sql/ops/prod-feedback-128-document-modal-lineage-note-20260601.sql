-- PROD feedback #128 follow-up note/status update for 2026-06-01.
-- Scope: admin_feedback_* tables only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @progress_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status_128
  FROM admin_feedback_report
 WHERE id = 128
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @progress_at
 WHERE id = 128
   AND @previous_status_128 IS NOT NULL
   AND @previous_status_128 <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 128, @previous_status_128, 'in_progress', NULL, @actor_name, @actor_email, @progress_at
 WHERE @previous_status_128 IS NOT NULL
   AND @previous_status_128 <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 128
        AND previous_status = @previous_status_128
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
        AND changed_at >= TIMESTAMP(DATE(@progress_at))
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 128, NULL, @actor_name, @actor_email,
       'Codex follow-up 2026-06-01: Reopened after Danielle reported that Edit document details still fails when changing a Status or Treaty Card label in PROD. Live read-only triage found Danielle is an ISET Coordinator assigned to the affected case, so this is not a simple role/assignment denial. The affected status_card rows are current application_submission documents with client_id, case_id, application_id, and applicant_user_id populated. The remaining bug is in the full edit-modal backend path: after resolving the client-scoped document type, PUT /api/documents/:id cleared application_id, which violates PROD check constraint chk_iset_document_application_submission_scope for application_submission rows. Local fix prepared: modal/duplicate updates now preserve source-required application-submission lineage before target access validation while still treating the document type as client-scoped. Local verification: node --check isetadminserver.js passed and targeted Jest route guard src/lib/__tests__/supportingDocumentsUpdateRoute.test.js passed. Not deployed yet; keep in_progress until PROD deploy and targeted Supporting Documents modal recheck pass.',
       @progress_at
 WHERE @previous_status_128 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 128
        AND note_text LIKE 'Codex follow-up 2026-06-01: Reopened after Danielle reported%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 128;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 128
 ORDER BY id DESC
 LIMIT 3;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 128
 ORDER BY id DESC
 LIMIT 3;
