-- PROD feedback deploy notes for release 20260605-prod-ilmp-casework-batch.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.
-- Normal-routing PROD smoke passed on 2026-06-06 after the full app deploy.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @release_id := '20260605-prod-ilmp-casework-batch';
SET @note_at := NOW();

START TRANSACTION;

SELECT status INTO @previous_status_132
  FROM admin_feedback_report
 WHERE id = 132
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = CASE
         WHEN @previous_status_132 IN ('resolved', 'closed') THEN @previous_status_132
         ELSE 'in_progress'
       END,
       updated_at = @note_at
 WHERE id = 132
   AND @previous_status_132 IS NOT NULL;

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 132, @previous_status_132, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_132 IS NOT NULL
   AND @previous_status_132 NOT IN ('in_progress', 'resolved', 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 132
        AND previous_status = @previous_status_132
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
        AND changed_at >= DATE_SUB(@note_at, INTERVAL 1 DAY)
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 132, NULL, @actor_name, @actor_email,
       CONCAT('Codex deploy note 2026-06-06: Fix deployed to PROD in release ', @release_id, '. Normal-routing smoke passed for admin and both portal hosts. Keep in_progress pending targeted recheck of the denied/closed application document-checklist path; do not mark resolved until the affected checklist no longer shows funding-stage items such as CFA/EFT as missing.'),
       @note_at
 WHERE @previous_status_132 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 132
        AND note_text LIKE CONCAT('Codex deploy note 2026-06-06: Fix deployed to PROD in release ', @release_id, '.%')
   );

SELECT status INTO @previous_status_133
  FROM admin_feedback_report
 WHERE id = 133
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = CASE
         WHEN @previous_status_133 IN ('resolved', 'closed') THEN @previous_status_133
         ELSE 'in_progress'
       END,
       updated_at = @note_at
 WHERE id = 133
   AND @previous_status_133 IS NOT NULL;

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 133, @previous_status_133, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_133 IS NOT NULL
   AND @previous_status_133 NOT IN ('in_progress', 'resolved', 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 133
        AND previous_status = @previous_status_133
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
        AND changed_at >= DATE_SUB(@note_at, INTERVAL 1 DAY)
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 133, NULL, @actor_name, @actor_email,
       CONCAT('Codex deploy note 2026-06-06: Regional Snapshot totals/export fix deployed to PROD in release ', @release_id, '. Normal-routing smoke passed for admin and both portal hosts. Keep in_progress pending targeted recheck of dashboard totals and the all-regions Excel regional tabs against the intended one-application basis.'),
       @note_at
 WHERE @previous_status_133 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 133
        AND note_text LIKE CONCAT('Codex deploy note 2026-06-06: Regional Snapshot totals/export fix deployed to PROD in release ', @release_id, '.%')
   );

SELECT status INTO @previous_status_134
  FROM admin_feedback_report
 WHERE id = 134
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = CASE
         WHEN @previous_status_134 IN ('resolved', 'closed') THEN @previous_status_134
         ELSE 'in_progress'
       END,
       updated_at = @note_at
 WHERE id = 134
   AND @previous_status_134 IS NOT NULL;

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 134, @previous_status_134, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_134 IS NOT NULL
   AND @previous_status_134 NOT IN ('in_progress', 'resolved', 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 134
        AND previous_status = @previous_status_134
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
        AND changed_at >= DATE_SUB(@note_at, INTERVAL 1 DAY)
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 134, NULL, @actor_name, @actor_email,
       CONCAT('Codex deploy note 2026-06-06: Decision-letter applicant-name fix deployed to PROD in release ', @release_id, '. Normal-routing smoke passed for admin and both portal hosts. Keep in_progress pending targeted recheck that newly generated approval/denial letters use the resolved participant salutation/name instead of Dear Applicant.'),
       @note_at
 WHERE @previous_status_134 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 134
        AND note_text LIKE CONCAT('Codex deploy note 2026-06-06: Decision-letter applicant-name fix deployed to PROD in release ', @release_id, '.%')
   );

SELECT status INTO @previous_status_136
  FROM admin_feedback_report
 WHERE id = 136
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = CASE
         WHEN @previous_status_136 IN ('resolved', 'closed') THEN @previous_status_136
         ELSE 'in_progress'
       END,
       updated_at = @note_at
 WHERE id = 136
   AND @previous_status_136 IS NOT NULL;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 136, NULL, @actor_name, @actor_email,
       CONCAT('Codex deploy note 2026-06-06: Withdraw/Reopen raw-status quick-action fix deployed to PROD in release ', @release_id, '. Normal-routing smoke passed for admin and both portal hosts. Keep in_progress pending Emilie/browser recheck for Jaimee Lee Gray / ISET-20260410-0D4C68; do not mark resolved until Withdraw application is visible for the closure_notice application after refresh.'),
       @note_at
 WHERE @previous_status_136 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 136
        AND note_text LIKE CONCAT('Codex deploy note 2026-06-06: Withdraw/Reopen raw-status quick-action fix deployed to PROD in release ', @release_id, '.%')
   );

SELECT status INTO @previous_status_137
  FROM admin_feedback_report
 WHERE id = 137
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = CASE
         WHEN @previous_status_137 IN ('resolved', 'closed') THEN @previous_status_137
         ELSE 'in_progress'
       END,
       updated_at = @note_at
 WHERE id = 137
   AND @previous_status_137 IS NOT NULL;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 137, NULL, @actor_name, @actor_email,
       CONCAT('Codex deploy note 2026-06-06: ILMP backloaded-action-plan prefill/validation and Participant Details seeding code deployed to PROD in release ', @release_id, '. Normal-routing smoke passed for admin and both portal hosts. Keep in_progress pending staff confirmation of non-derivable Shayleen fields, rerun of ILMP validation, and targeted recheck before resolving.'),
       @note_at
 WHERE @previous_status_137 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 137
        AND note_text LIKE CONCAT('Codex deploy note 2026-06-06: ILMP backloaded-action-plan prefill/validation and Participant Details seeding code deployed to PROD in release ', @release_id, '.%')
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (132, 133, 134, 136, 137)
 ORDER BY id;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (132, 133, 134, 136, 137)
 ORDER BY id DESC
 LIMIT 10;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (132, 133, 134, 136, 137)
 ORDER BY id DESC
 LIMIT 10;
