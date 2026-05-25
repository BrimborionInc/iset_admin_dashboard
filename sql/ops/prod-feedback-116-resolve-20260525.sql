-- PROD feedback #116 resolution update for 2026-05-25.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'resolved', updated_at = @resolved_at
 WHERE id = 116
   AND status IN ('planned', 'in_progress', 'triaging', 'submitted');

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 116, 'planned', 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 116 AND status = 'resolved')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 116
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 116, NULL, @actor_name, @actor_email,
       'Codex correction 2026-05-25: Report should not have remained planned. Live admin bundle is release 20260524-finance-reports-support and includes the planned-cost cents fix/release note. Rechecked deployed bundle evidence and current code path: intervention amount validation now accepts valid dollars-and-cents values up to two decimal places, with backend validation copy aligned to decimal currency instead of whole-number-only wording. Marking resolved; if a new cents rejection is seen after this release, open it as a fresh regression with the exact field/value.',
       @resolved_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 116 AND note_text LIKE 'Codex correction 2026-05-25:%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 116;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 116
 ORDER BY changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 220) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 116
 ORDER BY created_at DESC, id DESC
 LIMIT 6;
