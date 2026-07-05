START TRANSACTION;

SET @report_id := 148;
SET @expected_status := 'in_progress';
SET @new_status := 'resolved';
SET @changed := 0;

UPDATE admin_feedback_report
   SET status = @new_status,
       updated_at = NOW()
 WHERE id = @report_id
   AND status = @expected_status
   AND submitted_by_email = 'emarion@nwac.ca'
   AND page_url LIKE '%/cases/16';

SET @changed := ROW_COUNT();

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email)
SELECT @report_id, @expected_status, @new_status, NULL, 'Codex', 'codex@openai.com'
 WHERE @changed = 1
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = @report_id
        AND previous_status = @expected_status
        AND new_status = @new_status
        AND changed_by_email = 'codex@openai.com'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text)
SELECT
  @report_id,
  NULL,
  'Codex',
  'codex@openai.com',
  'Codex resolution 2026-06-26: Deployed admin hotfix release 20260626-rm-two-step-role-matrix-prod. Fixed the two-step submit-start role matrix so Regional Managers can submit supported application assessments, intervention proposals, and intervention revisions for RM review while NWAC/System Admin remain decision-only. Repaired Case 16 intervention revision 198 / proposal 320 by creating review workflow 9 (rm_review, owner Regional Manager) and generating Case manager assessment v2 document 4913 plus redline v2 document 4914 from the deployed PDF helper.'
 WHERE @changed = 1
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = @report_id
        AND author_email = 'codex@openai.com'
        AND note_text LIKE '%20260626-rm-two-step-role-matrix-prod%'
   );

SELECT id, status, updated_at
  FROM admin_feedback_report
 WHERE id = @report_id;

SELECT id, report_id, previous_status, new_status, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 5;

SELECT id, report_id, author_name, created_at, note_text
  FROM admin_feedback_note
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 3;

COMMIT;
