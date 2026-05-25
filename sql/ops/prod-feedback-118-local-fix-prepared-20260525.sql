-- PROD feedback #118 local fix prepared note/status update for 2026-05-25.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @progress_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status
  FROM admin_feedback_report
 WHERE id = 118
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @progress_at
 WHERE id = 118
   AND COALESCE(@previous_status, '') <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 118, @previous_status, 'in_progress', NULL, @actor_name, @actor_email, @progress_at
 WHERE @previous_status IS NOT NULL
   AND @previous_status <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 118
        AND previous_status = @previous_status
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 118, NULL, @actor_name, @actor_email,
       'Codex progress 2026-05-25: Local fix prepared and tested for the Other Funding issue reported from case 120. Root cause was that the structured Other Funding flow treated each other-funder row as confirmed coverage, so staff could not record pending, denied, or unknown outside funding without describing confirmed coverage. The patch adds funding status per other-funder row (Confirmed, Pending, Denied, Unknown / not confirmed), optional amount, notes, and coverage validation only for Confirmed funding. Pending/denied/unknown funders are retained for context but do not generate other-funder approval letters. Case Workspace intervention revisions also seed missing other-funding context from the current application assessment where available. Local verification passed: node --check isetadminserver.js; CI=false npm run build. Build completed with the repo''s existing warnings only. Not deployed yet; report remains open pending the planned PROD maintenance release and targeted live recheck.',
       @progress_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 118
      AND note_text LIKE 'Codex progress 2026-05-25: Local fix prepared and tested for the Other Funding issue%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 118;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 118
 ORDER BY changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 260) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 118
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
