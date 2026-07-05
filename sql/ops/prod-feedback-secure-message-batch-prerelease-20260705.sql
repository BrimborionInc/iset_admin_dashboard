-- PROD feedback pre-release notes for secure-message batch 20260705-secure-message-batch.
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

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 154, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD pre-release note 2026-07-05: Included report #154 secure-message withdrawal safeguards in release ', @release_id, '. ',
         'TEST deploy and deployed-source marker check passed. The report remains in_progress because the wrong-recipient message has been contained, but the live PROD code release and final incident follow-up are still being completed.'
       ),
       @note_at
 WHERE @previous_status_154 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 154
        AND note_text LIKE CONCAT('Codex PROD pre-release note 2026-07-05: Included report #154 secure-message withdrawal safeguards in release ', @release_id, '%')
   );

SELECT status
  INTO @previous_status_155
  FROM admin_feedback_report
 WHERE id = 155
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'planned',
       updated_at = @note_at
 WHERE id = 155
   AND @previous_status_155 IN ('submitted', 'triaging', 'in_progress');

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 155, @previous_status_155, 'planned', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_155 IN ('submitted', 'triaging', 'in_progress')
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 155
        AND previous_status = @previous_status_155
        AND new_status = 'planned'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 155, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD pre-release note 2026-07-05: Included report #155 applicant-name secure-message notification fix in release ', @release_id, '. ',
         'TEST deploy and deployed-source marker check passed. The report is planned for PROD and should only move to resolved after normal-routing smoke and targeted live verification of applicant-origin secure-message notification naming.'
       ),
       @note_at
 WHERE @previous_status_155 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 155
        AND note_text LIKE CONCAT('Codex PROD pre-release note 2026-07-05: Included report #155 applicant-name secure-message notification fix in release ', @release_id, '%')
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
 LIMIT 8;

SELECT report_id, author_name, created_at, LEFT(note_text, 360) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (154, 155)
 ORDER BY created_at DESC, id DESC
 LIMIT 8;
