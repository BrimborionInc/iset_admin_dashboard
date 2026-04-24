-- PROD feedback-log update prepared on 2026-04-24.
-- Purpose: record that report #49 now has a DEV-side hotfix prepared and is
-- waiting for TEST validation before PROD deploy.

START TRANSACTION;

SET @report_id = 49;
SET @actor_name = 'Codex';
SET @actor_email = 'codex@local';
SET @note_text = '2026-04-24 DEV hotfix prepared: application-case document loading now uses the current application submission payload to prove which historical applicant intake uploads belong to this application when older application_submission rows still have application_id = NULL. The same narrow proof rule now feeds both the supporting-documents list and the document checklist, so the acceptance letter and other original intake files should reappear without widening document visibility across multiple applications. Waiting for TEST validation before PROD deploy.';

SELECT id, status, summary, page_path, updated_at
FROM admin_feedback_report
WHERE id = @report_id
FOR UPDATE;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT @report_id, NULL, @actor_name, @actor_email, @note_text, NOW()
FROM DUAL
WHERE EXISTS (
    SELECT 1
    FROM admin_feedback_report
    WHERE id = @report_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_note
    WHERE report_id = @report_id
      AND note_text = @note_text
  );

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT
  r.id,
  r.status,
  'in_progress',
  NULL,
  @actor_name,
  @actor_email,
  NOW()
FROM admin_feedback_report r
WHERE r.id = @report_id
  AND r.status <> 'in_progress'
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_status_history h
    WHERE h.report_id = r.id
      AND h.new_status = 'in_progress'
      AND h.changed_by_email = @actor_email
  );

UPDATE admin_feedback_report
SET status = 'in_progress',
    updated_at = NOW()
WHERE id = @report_id
  AND status <> 'in_progress';

SELECT id, status, summary, page_path, updated_at
FROM admin_feedback_report
WHERE id = @report_id;

SELECT report_id, author_name, author_email, note_text, created_at
FROM admin_feedback_note
WHERE report_id = @report_id
  AND note_text = @note_text
ORDER BY created_at DESC, id DESC;

COMMIT;
