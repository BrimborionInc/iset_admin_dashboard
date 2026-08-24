-- Read-only first-pass PROD inventory for staff-origin secure messages whose
-- generic recipient status currently renders as "Applicant replied".
--
-- This query deliberately reads one live-DDL-proven table only. It identifies
-- candidates; it does not prove which actor caused the replied transition.

SELECT messages.id,
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
 WHERE messages.sender_actor_type IN ('staff_profile', 'local_user')
   AND messages.recipient_actor_type = 'applicant_user'
   AND messages.status = 'replied'
   AND messages.deleted = 0
 ORDER BY messages.created_at, messages.id;
