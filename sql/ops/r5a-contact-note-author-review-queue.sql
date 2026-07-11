-- R5a review queue only. This file is deliberately read-only.
-- A staff author may be repaired only from verified Cognito-subject evidence, never email alone.
SELECT
  n.id AS contact_note_id,
  n.contact_message_id,
  n.author_user_id,
  u.cognito_sub AS author_user_subject,
  u.email AS author_user_email,
  sp.id AS subject_matched_staff_profile_id,
  sp.cognito_sub AS subject_matched_staff_subject,
  n.created_at
FROM contact_message_note n
LEFT JOIN user u ON u.id = n.author_user_id
LEFT JOIN staff_profiles sp ON BINARY sp.cognito_sub = BINARY u.cognito_sub
WHERE n.author_user_id IS NOT NULL
  AND sp.id IS NULL
ORDER BY n.created_at, n.id;
