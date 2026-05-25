-- PROD feedback notes for post-deploy TEST validation of release 20260525-test-bugcr-batch.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260525-test-bugcr-batch';
SET @ssm_validation_command := '9708a1da-aa78-41cc-a64f-6557c23f73ea';
SET @test_matrix_command := 'cab10290-c7c1-46d8-8bcf-6587a889f4cd';

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT report_id, NULL, @actor_name, @actor_email, note_text, @note_at
  FROM (
    SELECT 118 AS report_id,
           CONCAT(
             'Codex TEST validation 2026-05-25: Completed focused validation after TEST release ', @release_id, '. ',
             'Local Jest run passed 3 suites / 16 tests, including new Other Funding behavior coverage across Application Assessment, Case Workspace intervention assessment, and server PDF formatting. ',
             'Deployed TEST source assertions also passed on both admin instances under SSM command ', @ssm_validation_command, ', confirming status/optional amount/confirmed-only co-funder-letter rules are present in the running TEST code. ',
             'No shared TEST workflow data was mutated. Keep report #118 in_progress until the planned PROD deploy and live Other Funding workflow recheck.'
           ) AS note_text
    UNION ALL
    SELECT 120 AS report_id,
           CONCAT(
             'Codex TEST validation 2026-05-25: Completed focused validation after TEST release ', @release_id, '. ',
             'Local Jest run passed 3 suites / 16 tests, including the funding-revision letter-body/schema tests that prove the signing request schema is built from the reviewed secure-message body and does not retain stale template tokens. ',
             'Deployed TEST source assertions passed on both admin instances under SSM command ', @ssm_validation_command, ', confirming the workflow 46 signing-schema override is present in the running TEST backend. ',
             'No real client email/signing send was performed in TEST. Keep report #120 in_progress until the planned PROD deploy and live packet recheck/corrected-resend handling.'
           ) AS note_text
    UNION ALL
    SELECT 121 AS report_id,
           CONCAT(
             'Codex TEST validation 2026-05-25: Completed focused validation after TEST release ', @release_id, '. ',
             'Local Jest run passed 3 suites / 16 tests, including notification/template access-control coverage proving the backend uses route-matrix checks instead of hardcoded System/NWAC admin role checks. ',
             'Deployed TEST source assertions passed on both admin instances under SSM command ', @ssm_validation_command, '. ',
             'Read-only TEST DB check under SSM command ', @test_matrix_command, ' confirmed /template-editor and /manage-notifications currently resolve to System Administrator and NWAC Administrator in the runtime accessControlMatrix. ',
             'Keep report #121 in_progress until the planned PROD deploy and live Access Control dashboard/API recheck.'
           ) AS note_text
  ) AS notes
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note existing
    WHERE existing.report_id = notes.report_id
      AND existing.note_text LIKE CONCAT('Codex TEST validation 2026-05-25: Completed focused validation after TEST release ', @release_id, '%')
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (118, 120, 121)
 ORDER BY id;

SELECT report_id, author_name, created_at, LEFT(note_text, 360) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (118, 120, 121)
 ORDER BY created_at DESC, id DESC
 LIMIT 12;
