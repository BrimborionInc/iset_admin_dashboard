ALTER TABLE iset_case
  ADD COLUMN assigned_staff_profile_id BIGINT UNSIGNED DEFAULT NULL AFTER assigned_to_user_id;

UPDATE iset_case
   SET assigned_staff_profile_id = assigned_to_user_id
 WHERE assigned_staff_profile_id IS NULL
   AND assigned_to_user_id IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM staff_profiles sp
      WHERE sp.id = iset_case.assigned_to_user_id
   );

UPDATE iset_case
   SET assigned_to_user_id = assigned_staff_profile_id
 WHERE assigned_to_user_id IS NOT NULL
   AND (
     assigned_staff_profile_id IS NULL
     OR assigned_to_user_id <> assigned_staff_profile_id
   );

ALTER TABLE iset_case
  ADD KEY idx_iset_case_assigned_staff_profile_id (assigned_staff_profile_id),
  ADD KEY idx_iset_case_status_assigned_staff_profile (status, assigned_staff_profile_id),
  ADD KEY idx_iset_case_lifecycle_assigned_staff_profile (lifecycle_status, assigned_staff_profile_id),
  ADD CONSTRAINT fk_iset_case_assigned_staff_profile
    FOREIGN KEY (assigned_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL;
