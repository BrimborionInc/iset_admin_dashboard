-- PROD feedback notes for TEST release 20260525-test-bugcr-batch.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260525-test-bugcr-batch';

START TRANSACTION;

SELECT status
  INTO @previous_status_118
  FROM admin_feedback_report
 WHERE id = 118
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 118
   AND COALESCE(@previous_status_118, '') <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 118, @previous_status_118, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_118 IS NOT NULL
   AND @previous_status_118 <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 118
        AND previous_status = @previous_status_118
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 118, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex TEST deploy note 2026-05-25: Included report #118 Other Funding fix in TEST release ', @release_id, '. ',
         'This deploy is for TEST validation only, not PROD. The report remains in_progress until the fix is released to PROD and the case 120 proposed-intervention Other Funding workflow is rechecked live.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 118
      AND note_text LIKE CONCAT('Codex TEST deploy note 2026-05-25: Included report #118 Other Funding fix in TEST release ', @release_id, '%')
 );

SELECT status
  INTO @previous_status_120
  FROM admin_feedback_report
 WHERE id = 120
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 120
   AND COALESCE(@previous_status_120, '') <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 120, @previous_status_120, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_120 IS NOT NULL
   AND @previous_status_120 <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 120
        AND previous_status = @previous_status_120
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 120, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex TEST deploy note 2026-05-25: Included report #120 funding revision letter/signing-request fix in TEST release ', @release_id, '. ',
         'This deploy is for TEST validation only, not PROD. The report remains in_progress until the fix is released to PROD and the funding-revision secure-message letter, signing request, and attached packet are rechecked live.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 120
      AND note_text LIKE CONCAT('Codex TEST deploy note 2026-05-25: Included report #120 funding revision letter/signing-request fix in TEST release ', @release_id, '%')
 );

SELECT status
  INTO @previous_status_121
  FROM admin_feedback_report
 WHERE id = 121
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 121
   AND COALESCE(@previous_status_121, '') <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 121, @previous_status_121, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_121 IS NOT NULL
   AND @previous_status_121 <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 121
        AND previous_status = @previous_status_121
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 121, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex TEST deploy note 2026-05-25: Included report #121 Access Control source-of-truth fix in TEST release ', @release_id, '. ',
         'This deploy is for TEST validation only, not PROD. The report remains in_progress until the fix is released to PROD and Template Editor / Manage Notifications route-matrix behavior is rechecked live.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 121
      AND note_text LIKE CONCAT('Codex TEST deploy note 2026-05-25: Included report #121 Access Control source-of-truth fix in TEST release ', @release_id, '%')
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

SELECT report_id, author_name, created_at, LEFT(note_text, 320) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (118, 120, 121)
 ORDER BY created_at DESC, id DESC
 LIMIT 12;
