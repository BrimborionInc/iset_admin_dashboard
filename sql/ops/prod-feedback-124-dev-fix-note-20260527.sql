-- PROD feedback #124 DEV fix note for 2026-05-27.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status_124
  FROM admin_feedback_report
 WHERE id = 124
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 124
   AND @previous_status_124 IS NOT NULL
   AND @previous_status_124 <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 124, @previous_status_124, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_124 IS NOT NULL
   AND @previous_status_124 <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 124
        AND previous_status = @previous_status_124
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 124, NULL, @actor_name, @actor_email,
       'Codex DEV fix note 2026-05-27: Kelly supplied detail that the failure appeared while deleting a current living allowance and adding a residence fee during an intervention/client-assessment revision, with PATH asking for a number from 0-999. Root cause in DEV is the derived ILMP intervention duration field: long education schedules can calculate beyond the ILMP three-digit duration cap even though the real start/end dates are valid. Local fix prepared so frontend proposal/revision payloads and backend intervention create/edit/autoplan paths cap only stored/reportable duration at 999 days while preserving the real dates. Local evidence: focused Jest regression sweep passed 4 suites / 15 tests; node --check and git diff --check clean; local backend health 200 and protected intervention route returns expected 401 without token; ILMP participant-queue Puppeteer smoke also passes after the local Chrome dependency fallback. Keep report in_progress until deployed to PROD and Kelly/relevant case can be rechecked live.',
       @note_at
 WHERE @previous_status_124 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 124
        AND note_text LIKE 'Codex DEV fix note 2026-05-27: Kelly supplied detail%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 124;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 124
 ORDER BY id DESC
 LIMIT 3;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 124
 ORDER BY id DESC
 LIMIT 3;
