-- Clear only the lock owned by this repair. A different lock is never removed.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DELETE FROM application_lock
WHERE application_id = 103
  AND owner_user_id = 'prod-mb-client-repair-20260729';

SELECT ROW_COUNT() AS removed_repair_lock_count;

SELECT
  application_id,
  owner_user_id,
  owner_display_name,
  acquired_at,
  expires_at,
  metadata
FROM application_lock
WHERE application_id = 103;
