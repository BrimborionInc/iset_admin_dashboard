-- Preview client applicant-account event rows whose client no longer exists.
-- Read-only. Emits IDs and event types only; no names, emails, or metadata payload.

SELECT
  CASE WHEN c.id IS NULL THEN 'missing_client' ELSE 'ok' END AS cleanup_reason,
  e.event_type,
  COUNT(*) AS row_count,
  MIN(e.client_id) AS min_client_id,
  MAX(e.client_id) AS max_client_id
FROM client_applicant_account_event e
LEFT JOIN client c ON c.id = e.client_id
GROUP BY cleanup_reason, e.event_type
ORDER BY cleanup_reason, e.event_type;

SELECT
  e.id AS event_id,
  e.client_id,
  e.event_type,
  e.actor_staff_profile_id,
  e.created_at
FROM client_applicant_account_event e
LEFT JOIN client c ON c.id = e.client_id
WHERE c.id IS NULL
ORDER BY e.id
LIMIT 250;
