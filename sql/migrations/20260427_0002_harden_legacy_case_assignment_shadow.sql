UPDATE iset_case c
LEFT JOIN staff_profiles sp_legacy ON sp_legacy.id = c.assigned_to_user_id
   SET c.assigned_staff_profile_id = CASE
         WHEN c.assigned_staff_profile_id IS NOT NULL THEN c.assigned_staff_profile_id
         WHEN sp_legacy.id IS NOT NULL THEN sp_legacy.id
         ELSE NULL
       END;

UPDATE iset_case
   SET assigned_to_user_id = assigned_staff_profile_id
 WHERE (assigned_to_user_id IS NULL AND assigned_staff_profile_id IS NOT NULL)
    OR (assigned_to_user_id IS NOT NULL AND assigned_staff_profile_id IS NULL)
    OR (assigned_to_user_id IS NOT NULL AND assigned_staff_profile_id IS NOT NULL AND assigned_to_user_id <> assigned_staff_profile_id);

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_case'
     AND constraint_name = 'fk_iset_case_legacy_assigned_staff_profile'
), 'ALTER TABLE iset_case ADD CONSTRAINT fk_iset_case_legacy_assigned_staff_profile FOREIGN KEY (assigned_to_user_id) REFERENCES staff_profiles (id) ON DELETE SET NULL', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
