-- PROD feedback #128 local fix prepared note/status update for 2026-05-28.
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
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 128, NULL, @actor_name, @actor_email,
       'Codex progress 2026-05-28: Reproduced the reported Supporting Documents inline-label symptom in code path analysis. The table tick sends PUT /api/documents/:id with only a label, but the backend treated every document update as a full document type/attachment update and re-ran scope resolution. Older identity/status uploads that are visible through application-submission payload matching can lack modern case/application scope columns, so a harmless rename could fail with case_required_for_document and the refresh then restored the old label. Local fix prepared: label-only document updates now persist only label/metadata label and preserve existing attachment scope; full edit-modal saves still validate document type and scope. The widget now also rejects failed inline-save promises instead of closing as if the tick worked. Local verification: node --check isetadminserver.js passed; targeted Jest route guard src/lib/__tests__/supportingDocumentsUpdateRoute.test.js passed; local protected PUT /api/documents/1 route returned expected 401 Missing bearer token. Not deployed yet; keep in_progress until the next PROD admin release and a targeted live Supporting Documents recheck.',
       @progress_at
 WHERE @previous_status_128 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 128
        AND note_text LIKE 'Codex progress 2026-05-28: Reproduced the reported Supporting Documents inline-label symptom%'
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
