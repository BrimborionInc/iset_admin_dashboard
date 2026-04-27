ALTER TABLE messages
  ADD COLUMN sender_actor_type ENUM('applicant_user','staff_profile','local_user','system') DEFAULT NULL AFTER recipient_id,
  ADD COLUMN sender_user_id INT DEFAULT NULL AFTER sender_actor_type,
  ADD COLUMN sender_staff_profile_id BIGINT UNSIGNED DEFAULT NULL AFTER sender_user_id,
  ADD COLUMN recipient_actor_type ENUM('applicant_user','staff_profile','local_user','system') DEFAULT NULL AFTER sender_staff_profile_id,
  ADD COLUMN recipient_user_id INT DEFAULT NULL AFTER recipient_actor_type,
  ADD COLUMN recipient_staff_profile_id BIGINT UNSIGNED DEFAULT NULL AFTER recipient_user_id;

ALTER TABLE messages
  ADD KEY idx_messages_sender_actor (sender_actor_type, sender_user_id, sender_staff_profile_id),
  ADD KEY idx_messages_recipient_actor (recipient_actor_type, recipient_user_id, recipient_staff_profile_id),
  ADD KEY idx_messages_sender_staff_profile (sender_staff_profile_id),
  ADD KEY idx_messages_recipient_staff_profile (recipient_staff_profile_id),
  ADD CONSTRAINT fk_messages_sender_user
    FOREIGN KEY (sender_user_id) REFERENCES `user` (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_messages_recipient_user
    FOREIGN KEY (recipient_user_id) REFERENCES `user` (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_messages_sender_staff_profile
    FOREIGN KEY (sender_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_messages_recipient_staff_profile
    FOREIGN KEY (recipient_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

UPDATE messages m
LEFT JOIN `user` su ON su.id = m.sender_id
LEFT JOIN `user` ru ON ru.id = m.recipient_id
   SET m.sender_user_id = su.id,
       m.recipient_user_id = ru.id;

UPDATE messages m
   SET m.sender_staff_profile_id = (
         SELECT sp.id
           FROM staff_profiles sp
           JOIN `user` u ON u.id = m.sender_id
          WHERE (
                  sp.cognito_sub IS NOT NULL
              AND u.cognito_sub IS NOT NULL
              AND CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                  CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
                )
             OR (
                  sp.email IS NOT NULL
              AND u.email IS NOT NULL
              AND LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                  LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
                )
          ORDER BY sp.id
          LIMIT 1
       ),
       m.recipient_staff_profile_id = (
         SELECT sp.id
           FROM staff_profiles sp
           JOIN `user` u ON u.id = m.recipient_id
          WHERE (
                  sp.cognito_sub IS NOT NULL
              AND u.cognito_sub IS NOT NULL
              AND CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                  CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
                )
             OR (
                  sp.email IS NOT NULL
              AND u.email IS NOT NULL
              AND LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                  LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
                )
          ORDER BY sp.id
          LIMIT 1
       );

UPDATE messages m
LEFT JOIN iset_case c ON c.id = m.case_id
LEFT JOIN iset_application a ON a.id = COALESCE(m.application_id, c.application_id)
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
LEFT JOIN client cl ON cl.id = COALESCE(a.client_id, c.client_id)
LEFT JOIN `user` applicant_by_sub
  ON CONVERT(applicant_by_sub.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
     CONVERT(cl.applicant_cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
LEFT JOIN `user` applicant_by_email
  ON LOWER(CONVERT(applicant_by_email.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
     LOWER(CONVERT(cl.applicant_account_email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
   SET m.sender_actor_type = CASE
         WHEN m.sender_user_id IS NULL THEN 'local_user'
         WHEN m.sender_user_id = s.user_id
           OR m.sender_user_id = applicant_by_sub.id
           OR m.sender_user_id = applicant_by_email.id
           THEN 'applicant_user'
         WHEN m.sender_staff_profile_id IS NOT NULL THEN 'staff_profile'
         ELSE 'local_user'
       END,
       m.recipient_actor_type = CASE
         WHEN m.recipient_user_id IS NULL THEN 'local_user'
         WHEN m.recipient_user_id = s.user_id
           OR m.recipient_user_id = applicant_by_sub.id
           OR m.recipient_user_id = applicant_by_email.id
           THEN 'applicant_user'
         WHEN m.recipient_staff_profile_id IS NOT NULL THEN 'staff_profile'
         ELSE 'local_user'
       END;
