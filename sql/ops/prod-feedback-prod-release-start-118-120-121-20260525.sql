-- PROD feedback notes before PROD release 20260525-prod-bugcr-batch.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260525-prod-bugcr-batch';

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT report_id, NULL, @actor_name, @actor_email, note_text, @note_at
  FROM (
    SELECT 118 AS report_id,
           CONCAT(
             'Codex PROD deploy start 2026-05-25: Report #118 Other Funding fix is included in planned admin-only PROD release ', @release_id, '. ',
             'The fix was validated in TEST release 20260525-test-bugcr-batch. Keep this report in_progress until PROD smoke and live Other Funding workflow recheck are complete.'
           ) AS note_text
    UNION ALL
    SELECT 120 AS report_id,
           CONCAT(
             'Codex PROD deploy start 2026-05-25: Report #120 funding revision letter/signing-request fix is included in planned admin-only PROD release ', @release_id, '. ',
             'The fix was validated in TEST release 20260525-test-bugcr-batch. Keep this report in_progress until PROD smoke and live funding-revision packet recheck/corrected-resend handling are complete.'
           ) AS note_text
    UNION ALL
    SELECT 121 AS report_id,
           CONCAT(
             'Codex PROD deploy start 2026-05-25: Report #121 Access Control source-of-truth fix is included in planned admin-only PROD release ', @release_id, '. ',
             'The fix was validated in TEST release 20260525-test-bugcr-batch. Keep this report in_progress until PROD smoke and live Template Editor / Manage Notifications route-matrix recheck are complete.'
           ) AS note_text
  ) AS notes
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note existing
    WHERE existing.report_id = notes.report_id
      AND existing.note_text LIKE CONCAT('Codex PROD deploy start 2026-05-25:%', @release_id, '%')
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (118, 120, 121)
 ORDER BY id;

SELECT report_id, author_name, created_at, LEFT(note_text, 320) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (118, 120, 121)
 ORDER BY created_at DESC, id DESC
 LIMIT 9;
