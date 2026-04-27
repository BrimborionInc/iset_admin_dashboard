UPDATE admin_feedback_attachment afa
LEFT JOIN staff_profiles sp ON sp.id = afa.uploaded_by_staff_profile_id
   SET afa.uploaded_by_staff_profile_id = NULL
 WHERE afa.uploaded_by_staff_profile_id IS NOT NULL
   AND sp.id IS NULL;

UPDATE admin_feedback_note afn
LEFT JOIN staff_profiles sp ON sp.id = afn.author_staff_profile_id
   SET afn.author_staff_profile_id = NULL
 WHERE afn.author_staff_profile_id IS NOT NULL
   AND sp.id IS NULL;

UPDATE admin_feedback_report afr
LEFT JOIN staff_profiles sp ON sp.id = afr.submitted_by_staff_profile_id
   SET afr.submitted_by_staff_profile_id = NULL
 WHERE afr.submitted_by_staff_profile_id IS NOT NULL
   AND sp.id IS NULL;

UPDATE admin_feedback_status_history afsh
LEFT JOIN staff_profiles sp ON sp.id = afsh.changed_by_staff_profile_id
   SET afsh.changed_by_staff_profile_id = NULL
 WHERE afsh.changed_by_staff_profile_id IS NOT NULL
   AND sp.id IS NULL;

UPDATE cfa_series cs
LEFT JOIN staff_profiles sp ON sp.id = cs.created_by_staff_profile_id
   SET cs.created_by_staff_profile_id = NULL
 WHERE cs.created_by_staff_profile_id IS NOT NULL
   AND sp.id IS NULL;

UPDATE cfa_version cv
LEFT JOIN staff_profiles sp_created ON sp_created.id = cv.created_by_staff_profile_id
LEFT JOIN staff_profiles sp_sent ON sp_sent.id = cv.sent_by_staff_profile_id
   SET cv.created_by_staff_profile_id = CASE
         WHEN cv.created_by_staff_profile_id IS NOT NULL AND sp_created.id IS NULL THEN NULL
         ELSE cv.created_by_staff_profile_id
       END,
       cv.sent_by_staff_profile_id = CASE
         WHEN cv.sent_by_staff_profile_id IS NOT NULL AND sp_sent.id IS NULL THEN NULL
         ELSE cv.sent_by_staff_profile_id
       END
 WHERE (cv.created_by_staff_profile_id IS NOT NULL AND sp_created.id IS NULL)
    OR (cv.sent_by_staff_profile_id IS NOT NULL AND sp_sent.id IS NULL);

UPDATE client c
LEFT JOIN staff_profiles sp ON sp.id = c.applicant_invited_by_staff_profile_id
   SET c.applicant_invited_by_staff_profile_id = NULL
 WHERE c.applicant_invited_by_staff_profile_id IS NOT NULL
   AND sp.id IS NULL;

UPDATE client_applicant_account_event caae
LEFT JOIN staff_profiles sp ON sp.id = caae.actor_staff_profile_id
   SET caae.actor_staff_profile_id = NULL
 WHERE caae.actor_staff_profile_id IS NOT NULL
   AND sp.id IS NULL;

DELETE stp
  FROM staff_tutorial_progress stp
  LEFT JOIN staff_profiles sp ON sp.id = stp.staff_profile_id
 WHERE sp.id IS NULL;

ALTER TABLE admin_feedback_attachment
  MODIFY uploaded_by_staff_profile_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_admin_feedback_attachment_uploader_staff
    FOREIGN KEY (uploaded_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE admin_feedback_note
  MODIFY author_staff_profile_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_admin_feedback_note_author_staff
    FOREIGN KEY (author_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE admin_feedback_report
  MODIFY submitted_by_staff_profile_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_admin_feedback_report_submitter_staff
    FOREIGN KEY (submitted_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE admin_feedback_status_history
  MODIFY changed_by_staff_profile_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_admin_feedback_status_actor_staff
    FOREIGN KEY (changed_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE cfa_series
  MODIFY created_by_staff_profile_id BIGINT UNSIGNED NULL,
  ADD KEY idx_cfa_series_created_by_staff_profile (created_by_staff_profile_id),
  ADD CONSTRAINT fk_cfa_series_created_by_staff_profile
    FOREIGN KEY (created_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE cfa_version
  MODIFY created_by_staff_profile_id BIGINT UNSIGNED NULL,
  MODIFY sent_by_staff_profile_id BIGINT UNSIGNED NULL,
  ADD KEY idx_cfa_version_created_by_staff_profile (created_by_staff_profile_id),
  ADD KEY idx_cfa_version_sent_by_staff_profile (sent_by_staff_profile_id),
  ADD CONSTRAINT fk_cfa_version_created_by_staff_profile
    FOREIGN KEY (created_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cfa_version_sent_by_staff_profile
    FOREIGN KEY (sent_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE client
  ADD CONSTRAINT fk_client_applicant_invited_by_staff_profile
    FOREIGN KEY (applicant_invited_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE client_applicant_account_event
  ADD CONSTRAINT fk_client_applicant_account_event_actor_staff
    FOREIGN KEY (actor_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;

ALTER TABLE staff_tutorial_progress
  MODIFY staff_profile_id BIGINT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_staff_tutorial_progress_staff_profile
    FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles (id) ON DELETE CASCADE;
