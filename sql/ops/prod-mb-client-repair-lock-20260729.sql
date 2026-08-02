-- Place the verified application lock for Susan's surviving application.
-- The insert intentionally fails if any lock already exists.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO application_lock (
  application_id,
  owner_user_id,
  owner_display_name,
  owner_email,
  acquired_at,
  expires_at,
  metadata
)
VALUES (
  103,
  'prod-mb-client-repair-20260729',
  'System maintenance',
  NULL,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 2 HOUR),
  JSON_OBJECT(
    'run_id', 'prod-mb-client-repair-20260729',
    'snapshot_id', 'path-prod-mb-client-repair-20260729163423',
    'reason', 'Controlled duplicate applicant identity merge for Susan Guimond'
  )
);

SELECT
  application_id,
  owner_user_id,
  owner_display_name,
  acquired_at,
  expires_at,
  metadata
FROM application_lock
WHERE application_id = 103;
