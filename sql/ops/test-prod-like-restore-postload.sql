-- TEST post-load side-effect safety bundle for a production-like restore.
--
-- Purpose:
-- 1. Slow/neutralize automated backend jobs before TEST app traffic resumes.
-- 2. Prevent existing reminder notification settings from emailing immediately.
-- 3. Stop scheduled allocation apply jobs from auto-posting historical rows.
-- 4. Clear transient queues/locks/uploads that should not be replayed in TEST.
--
-- Run this immediately after restoring the production-like dump into TEST,
-- before applying cleanup migrations or bringing TEST admin/portal PM2
-- processes back up.
--
-- Do not clear Cognito identity bindings in this file. Several cleanup
-- migrations use the restored PROD Cognito subjects to backfill typed actor
-- references. Run test-prod-like-restore-identity-overlay.sql only after
-- those migrations have completed.

INSERT INTO iset_runtime_config (scope, k, v)
VALUES (
  'admin',
  'backend.jobs',
  CAST('{
    "reminderPollMinutes": 1440,
    "allocationPollMinutes": 1440,
    "allocationApplyHour": 23
  }' AS JSON)
)
ON DUPLICATE KEY UPDATE
  v = VALUES(v),
  updated_at = CURRENT_TIMESTAMP;

UPDATE notification_setting
SET email_alert = 0
WHERE COALESCE(email_alert, 0) <> 0;

UPDATE budget_allocation
SET metadata = JSON_REMOVE(metadata, '$.scheduledApplyAt')
WHERE status = 'approved'
  AND JSON_EXTRACT(metadata, '$.scheduledApplyAt') IS NOT NULL;

DELETE FROM pending_uploads;

DELETE FROM input_json_state;

DELETE FROM application_lock;
