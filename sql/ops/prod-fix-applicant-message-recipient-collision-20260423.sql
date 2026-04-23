-- Repair applicant secure messages that were written to a staff_profiles.id
-- collision instead of the assigned staff member's user.id.
--
-- Scope:
-- - applicant-origin outbound messages only
-- - current recipient_id numerically matches a staff_profiles.id
-- - recipient user email does not match the intended staff profile email
--
-- Effects:
-- - rewrites messages.recipient_id to the resolved staff user.id
-- - resets messages.status to unread for the corrected recipient
-- - removes mailbox rows from the wrong recipient inbox
-- - inserts/resets mailbox rows for the correct recipient inbox

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_message_recipient_repair;
CREATE TEMPORARY TABLE tmp_message_recipient_repair AS
SELECT
  m.id AS message_id,
  m.case_id,
  m.application_id,
  m.sender_id AS applicant_user_id,
  m.recipient_id AS wrong_recipient_user_id,
  recipient_user.email AS wrong_recipient_email,
  sp.id AS intended_staff_profile_id,
  sp.display_name AS intended_staff_name,
  sp.email AS intended_staff_email,
  COALESCE(
    (
      SELECT u_sub.id
        FROM user u_sub
       WHERE sp.cognito_sub IS NOT NULL
         AND sp.cognito_sub <> ''
         AND CONVERT(u_sub.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
             CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
       ORDER BY u_sub.id ASC
       LIMIT 1
    ),
    (
      SELECT u_email.id
        FROM user u_email
       WHERE sp.email IS NOT NULL
         AND sp.email <> ''
         AND LOWER(CONVERT(u_email.email USING utf8mb4)) COLLATE utf8mb4_unicode_ci =
             LOWER(CONVERT(sp.email USING utf8mb4)) COLLATE utf8mb4_unicode_ci
       ORDER BY u_email.id ASC
       LIMIT 1
    )
  ) AS correct_recipient_user_id
FROM messages m
JOIN iset_case c
  ON c.id = m.case_id
LEFT JOIN client cl
  ON cl.id = c.client_id
LEFT JOIN iset_application a
  ON a.id = COALESCE(c.application_id, m.application_id)
LEFT JOIN iset_application_submission s
  ON s.id = a.submission_id
LEFT JOIN user applicant_submission
  ON applicant_submission.id = s.user_id
LEFT JOIN user applicant_client_sub
  ON applicant_client_sub.cognito_sub = cl.applicant_cognito_sub
LEFT JOIN user applicant_client_email
  ON LOWER(CONVERT(applicant_client_email.email USING utf8mb4)) COLLATE utf8mb4_unicode_ci =
     LOWER(CONVERT(cl.applicant_account_email USING utf8mb4)) COLLATE utf8mb4_unicode_ci
JOIN staff_profiles sp
  ON sp.id = m.recipient_id
LEFT JOIN user recipient_user
  ON recipient_user.id = m.recipient_id
WHERE m.sender_id = COALESCE(applicant_submission.id, applicant_client_sub.id, applicant_client_email.id)
  AND COALESCE(CONVERT(recipient_user.email USING utf8mb4), '') COLLATE utf8mb4_unicode_ci <>
      COALESCE(CONVERT(sp.email USING utf8mb4), '') COLLATE utf8mb4_unicode_ci
HAVING correct_recipient_user_id IS NOT NULL
   AND correct_recipient_user_id <> wrong_recipient_user_id;

SELECT
  COUNT(*) AS repair_rows,
  COUNT(DISTINCT wrong_recipient_user_id) AS wrong_recipient_users,
  COUNT(DISTINCT applicant_user_id) AS exposed_applicants,
  COUNT(DISTINCT case_id) AS affected_cases
FROM tmp_message_recipient_repair;

SELECT
  message_id,
  case_id,
  applicant_user_id,
  wrong_recipient_user_id,
  wrong_recipient_email,
  intended_staff_profile_id,
  intended_staff_name,
  intended_staff_email,
  correct_recipient_user_id
FROM tmp_message_recipient_repair
ORDER BY message_id ASC;

UPDATE messages m
JOIN tmp_message_recipient_repair repair
  ON repair.message_id = m.id
SET
  m.recipient_id = repair.correct_recipient_user_id,
  m.status = 'unread';

DELETE mi
FROM message_item mi
JOIN tmp_message_recipient_repair repair
  ON repair.message_id = mi.message_id
WHERE mi.owner_user_id = repair.wrong_recipient_user_id;

INSERT INTO message_item (
  message_id,
  owner_user_id,
  folder,
  folder_before_deleted,
  read_at,
  deleted_at,
  purged_at
)
SELECT
  repair.message_id,
  repair.correct_recipient_user_id,
  'inbox',
  NULL,
  NULL,
  NULL,
  NULL
FROM tmp_message_recipient_repair repair
ON DUPLICATE KEY UPDATE
  folder = VALUES(folder),
  folder_before_deleted = VALUES(folder_before_deleted),
  read_at = VALUES(read_at),
  deleted_at = VALUES(deleted_at),
  purged_at = VALUES(purged_at);

SELECT
  COUNT(*) AS repaired_messages,
  COUNT(DISTINCT correct_recipient_user_id) AS corrected_recipient_users
FROM tmp_message_recipient_repair;

COMMIT;
