-- Read-only PROD discovery for appeal evidence added after the final denials.
-- Live target identity and live DDL for every referenced table/column were
-- proved in this task before execution.

SELECT
  iset_document.id,
  iset_document.client_id,
  iset_document.application_id,
  iset_document.case_id,
  iset_document.origin_message_id,
  iset_document.signing_request_id,
  iset_document.source,
  iset_document.file_name,
  iset_document.label,
  iset_document.status,
  iset_document.document_category,
  iset_document.visibility,
  iset_document.created_at,
  iset_document.updated_at
FROM iset_document
WHERE iset_document.case_id IN (258, 269)
  AND iset_document.created_at >= '2026-08-27 00:00:00'
ORDER BY iset_document.case_id, iset_document.created_at, iset_document.id;

SELECT
  messages.id,
  messages.sender_actor_type,
  messages.sender_user_id,
  messages.sender_staff_profile_id,
  messages.recipient_actor_type,
  messages.recipient_user_id,
  messages.recipient_staff_profile_id,
  messages.case_id,
  messages.application_id,
  messages.subject,
  messages.status,
  messages.created_at,
  messages.deleted,
  messages.urgent
FROM messages
WHERE messages.case_id IN (258, 269)
  AND messages.created_at >= '2026-08-27 00:00:00'
ORDER BY messages.case_id, messages.created_at, messages.id;

SELECT
  message_attachment.id,
  message_attachment.message_id,
  message_attachment.case_id,
  message_attachment.client_id,
  message_attachment.application_id,
  message_attachment.original_filename,
  message_attachment.uploaded_at,
  message_attachment.user_id
FROM message_attachment
WHERE message_attachment.case_id IN (258, 269)
  AND message_attachment.uploaded_at >= '2026-08-27 00:00:00'
ORDER BY message_attachment.case_id, message_attachment.uploaded_at, message_attachment.id;

SELECT
  staff_profiles.id,
  staff_profiles.email,
  staff_profiles.name,
  staff_profiles.display_name,
  staff_profiles.primary_role,
  staff_profiles.status,
  staff_profiles.region_id
FROM staff_profiles
WHERE staff_profiles.email = 'sstacey@nwac.ca'
ORDER BY staff_profiles.id;

SELECT
  iset_application_assessment.id,
  iset_application_assessment.application_id,
  iset_application_assessment.case_id,
  iset_application_assessment.intervention_cost_total,
  iset_application_assessment.recommendation,
  iset_application_assessment.nwac_review,
  iset_application_assessment.updated_at
FROM iset_application_assessment
WHERE iset_application_assessment.application_id IN (199, 208)
ORDER BY iset_application_assessment.application_id,
         iset_application_assessment.id;
