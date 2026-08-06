-- PROD read-only event inventory for subject id 69 during the mistaken
-- withdrawal window. The subject id is intentionally not paired with a
-- guessed subject_type value.
--
-- Live schema evidence captured 2026-08-06 from PROD iset_intake:
-- iset_event_entry ee: id, category, event_type, severity, source,
-- subject_type, subject_id, actor_type, actor_id, actor_staff_profile_id,
-- actor_applicant_user_id, actor_display_name, payload_json, tracking_id,
-- correlation_id, captured_by, notification_delivery_mode, captured_at,
-- ingested_at

SELECT
  ee.id AS event_entry_id,
  ee.category,
  ee.event_type,
  ee.severity,
  ee.source,
  ee.subject_type,
  ee.subject_id,
  ee.actor_type,
  ee.actor_id,
  ee.actor_staff_profile_id,
  ee.actor_applicant_user_id,
  ee.actor_display_name,
  ee.payload_json,
  ee.tracking_id,
  ee.correlation_id,
  ee.captured_by,
  ee.notification_delivery_mode,
  ee.captured_at,
  ee.ingested_at
FROM iset_event_entry AS ee
WHERE ee.subject_id = '69'
  AND ee.captured_at >= '2026-08-05 00:00:00'
ORDER BY ee.captured_at, ee.id;
