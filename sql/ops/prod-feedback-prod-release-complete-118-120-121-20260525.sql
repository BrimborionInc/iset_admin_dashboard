-- PROD feedback reconciliation after PROD release 20260525-prod-bugcr-batch.
-- Scope: admin_feedback_* only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260525-prod-bugcr-batch';
SET @refresh_id := '17fab762-1f74-4a57-8e1d-6148cd9c9be4';
SET @manifest_path := 'tmp/path-deploy/prod/20260525-prod-bugcr-batch--2026-05-25T22-34-32-147Z.json';
SET @prod_validation_command := '464f2b43-bd77-47f6-bcd4-86743bf2f3b3';
SET @prod_matrix_command := 'ca56659b-b1cd-406e-9a67-3d4e61f4f7a5';

START TRANSACTION;

SELECT status INTO @previous_status_118
  FROM admin_feedback_report
 WHERE id = 118
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @note_at
 WHERE id = 118
   AND COALESCE(@previous_status_118, '') <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 118, @previous_status_118, 'resolved', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_118 IS NOT NULL
   AND @previous_status_118 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 118
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
        AND changed_at >= DATE_SUB(@note_at, INTERVAL 10 MINUTE)
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 118, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD closeout 2026-05-25: Admin-only PROD release ', @release_id,
         ' completed successfully; ASG refresh ', @refresh_id, ' finished Successful, normal-routing admin smoke returned 200/health OK, and manifest is ', @manifest_path, '. ',
         'Live deployed-source validation under SSM command ', @prod_validation_command,
         ' confirmed the Other Funding status, optional amount, confirmed-only coverage requirement, confirmed-only co-funder-letter generation, and server PDF fallback text are present in the running PROD code. ',
         'Report #118 marked resolved. No client email/signing send was involved.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 118
      AND note_text LIKE CONCAT('Codex PROD closeout 2026-05-25: Admin-only PROD release ', @release_id, '%')
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 120, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD closeout 2026-05-25: Admin-only PROD release ', @release_id,
         ' completed successfully; ASG refresh ', @refresh_id, ' finished Successful, normal-routing admin smoke returned 200/health OK, and manifest is ', @manifest_path, '. ',
         'Live deployed-source validation under SSM command ', @prod_validation_command,
         ' confirmed the workflow 46 funding-revision signing-request override is present in the running PROD backend and builds the signable artifact from the reviewed secure-message letter body. ',
         'Report #120 remains in_progress because no real client email/signing resend was performed during deploy; close it only after the affected funding-revision packet is regenerated/sent deliberately and the client-facing packet is rechecked.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 120
      AND note_text LIKE CONCAT('Codex PROD closeout 2026-05-25: Admin-only PROD release ', @release_id, '%')
 );

SELECT status INTO @previous_status_121
  FROM admin_feedback_report
 WHERE id = 121
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @note_at
 WHERE id = 121
   AND COALESCE(@previous_status_121, '') <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 121, @previous_status_121, 'resolved', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_121 IS NOT NULL
   AND @previous_status_121 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 121
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
        AND changed_at >= DATE_SUB(@note_at, INTERVAL 10 MINUTE)
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 121, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD closeout 2026-05-25: Admin-only PROD release ', @release_id,
         ' completed successfully; ASG refresh ', @refresh_id, ' finished Successful, normal-routing admin smoke returned 200/health OK, and manifest is ', @manifest_path, '. ',
         'Live deployed-source validation under SSM command ', @prod_validation_command,
         ' confirmed notification template/settings APIs now use route-matrix checks instead of hardcoded System/NWAC role checks. ',
         'Read-only PROD matrix check under SSM command ', @prod_matrix_command,
         ' confirmed /template-editor and /manage-notifications currently grant System Administrator and NWAC Administrator. Future role changes should be made through the Access Control dashboard/matrix. Report #121 marked resolved.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 121
      AND note_text LIKE CONCAT('Codex PROD closeout 2026-05-25: Admin-only PROD release ', @release_id, '%')
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (118, 120, 121)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (118, 120, 121)
 ORDER BY changed_at DESC, id DESC
 LIMIT 12;

SELECT report_id, author_name, created_at, LEFT(note_text, 420) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (118, 120, 121)
 ORDER BY created_at DESC, id DESC
 LIMIT 12;
