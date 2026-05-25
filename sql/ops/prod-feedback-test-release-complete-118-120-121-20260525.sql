-- PROD feedback notes after TEST release 20260525-test-bugcr-batch completed.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260525-test-bugcr-batch';

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT report_id, NULL, @actor_name, @actor_email, note_text, @note_at
  FROM (
    SELECT 118 AS report_id,
           CONCAT(
             'Codex TEST deploy complete 2026-05-25: TEST release ', @release_id,
             ' deployed successfully to the admin app. Schema/data/portal were skipped; both TEST admin instances completed SSM deploy successfully and normal-routing admin target-group smoke passed healthy on i-0a8be782ed8604211:5001 and i-09fe8c219a4564040:5001. Report #118 remains in_progress pending PROD release and live Other Funding workflow recheck.'
           ) AS note_text
    UNION ALL
    SELECT 120 AS report_id,
           CONCAT(
             'Codex TEST deploy complete 2026-05-25: TEST release ', @release_id,
             ' deployed successfully to the admin app. Schema/data/portal were skipped; both TEST admin instances completed SSM deploy successfully and normal-routing admin target-group smoke passed healthy on i-0a8be782ed8604211:5001 and i-09fe8c219a4564040:5001. Report #120 remains in_progress pending PROD release and live funding-revision letter/signing-request packet recheck.'
           ) AS note_text
    UNION ALL
    SELECT 121 AS report_id,
           CONCAT(
             'Codex TEST deploy complete 2026-05-25: TEST release ', @release_id,
             ' deployed successfully to the admin app. Schema/data/portal were skipped; both TEST admin instances completed SSM deploy successfully and normal-routing admin target-group smoke passed healthy on i-0a8be782ed8604211:5001 and i-09fe8c219a4564040:5001. Report #121 remains in_progress pending PROD release and live Access Control route-matrix recheck.'
           ) AS note_text
  ) AS notes
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note existing
    WHERE existing.report_id = notes.report_id
      AND existing.note_text LIKE CONCAT('Codex TEST deploy complete 2026-05-25: TEST release ', @release_id, '%')
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
