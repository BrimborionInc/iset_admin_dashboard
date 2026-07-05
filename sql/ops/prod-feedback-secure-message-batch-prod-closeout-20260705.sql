-- PROD feedback closeout notes for secure-message batch 20260705-secure-message-batch.
-- Scope: admin_feedback_* tables only. No client/case/application/message data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260705-secure-message-batch';

START TRANSACTION;

SELECT status
  INTO @previous_status_154
  FROM admin_feedback_report
 WHERE id = 154
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET updated_at = @note_at
 WHERE id = 154
   AND @previous_status_154 IS NOT NULL;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 154, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD release note 2026-07-05: Released secure-message withdrawal safeguards in ', @release_id, '. ',
         'PROD deploy manifest /home/bill/ISET/admin-dashboard/tmp/path-deploy/prod/20260705-secure-message-batch--2026-07-05T13-34-06-602Z.json completed successfully. ',
         'Normal-routing smoke returned 200 for admin and both portal hosts. Deployed-source marker SSM bd63dd80-c45b-4267-857d-9ac2014a137b passed. ',
         'Read-only live validation SSM 56372f66-848e-45eb-82c1-ed93e420b34a confirmed message 1128 is withdrawn/redacted, both mailbox copies are deleted, linked attachments/signing requests remain zero, and the send-event subject is redacted. ',
         'Report remains in_progress pending final incident/business-owner follow-up rather than being marked resolved automatically.'
       ),
       @note_at
 WHERE @previous_status_154 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 154
        AND note_text LIKE CONCAT('Codex PROD release note 2026-07-05: Released secure-message withdrawal safeguards in ', @release_id, '%')
   );

SELECT status
  INTO @previous_status_155
  FROM admin_feedback_report
 WHERE id = 155
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 155
   AND @previous_status_155 = 'planned';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 155, @previous_status_155, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_155 = 'planned'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 155
        AND previous_status = @previous_status_155
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 155, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD release note 2026-07-05: Released applicant-name secure-message notification fix in ', @release_id, '. ',
         'PROD deploy manifest /home/bill/ISET/admin-dashboard/tmp/path-deploy/prod/20260705-secure-message-batch--2026-07-05T13-34-06-602Z.json completed successfully. ',
         'Normal-routing smoke returned 200 for admin and both portal hosts. Deployed-source marker SSM bd63dd80-c45b-4267-857d-9ac2014a137b passed. ',
         'Read-only live validation found report context ISET-20260429-AF259F has an email-like account display name but client name Molly Hink, and deployed selector SSM 2b4c0643-fdf8-43f6-b868-28aff1b35f48 returned Molly Hink. ',
         'Report remains in_progress, not resolved, because Codex did not create a real PROD applicant message/email; resolve after the next legitimate applicant-origin secure-message notification or staff confirmation shows the Outlook subject uses the applicant name.'
       ),
       @note_at
 WHERE @previous_status_155 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 155
        AND note_text LIKE CONCAT('Codex PROD release note 2026-07-05: Released applicant-name secure-message notification fix in ', @release_id, '%')
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (154, 155)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (154, 155)
 ORDER BY changed_at DESC, id DESC
 LIMIT 10;

SELECT report_id, author_name, created_at, LEFT(note_text, 420) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (154, 155)
 ORDER BY created_at DESC, id DESC
 LIMIT 10;
