DELETE FROM privacy_erm_relationship_fk_hardening_audit
 WHERE run_label = 'remaining-relationship-fk-hardening-20260427';

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'remaining-relationship-fk-hardening-20260427',
  'client_account_event_client',
  'client_applicant_account_event',
  e.id,
  CAST(e.client_id AS CHAR),
  'client',
  CAST(c.id AS CHAR),
  CASE WHEN c.id IS NULL THEN 1 ELSE 0 END,
  0
FROM client_applicant_account_event e
LEFT JOIN client c ON c.id = e.client_id;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'remaining-relationship-fk-hardening-20260427',
  'input_json_state_client',
  'input_json_state',
  NULL,
  CAST(s.client_id AS CHAR),
  'client',
  CAST(c.id AS CHAR),
  CASE WHEN s.client_id IS NOT NULL AND c.id IS NULL THEN 1 ELSE 0 END,
  0
FROM input_json_state s
LEFT JOIN client c ON c.id = s.client_id
WHERE s.client_id IS NOT NULL;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'remaining-relationship-fk-hardening-20260427',
  'case_assessment_intervention_budget_pot',
  'iset_case_assessment',
  a.case_id,
  CAST(a.intervention_budget_pot_id AS CHAR),
  'budget_pot',
  CAST(bp.id AS CHAR),
  CASE WHEN a.intervention_budget_pot_id IS NOT NULL AND bp.id IS NULL THEN 1 ELSE 0 END,
  0
FROM iset_case_assessment a
LEFT JOIN budget_pot bp ON bp.id = a.intervention_budget_pot_id
WHERE a.intervention_budget_pot_id IS NOT NULL;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'remaining-relationship-fk-hardening-20260427',
  'case_reminder_action_plan',
  'iset_case_reminder',
  r.id,
  CAST(r.action_plan_id AS CHAR),
  'iset_case_action_plan',
  CAST(ap.id AS CHAR),
  CASE WHEN r.action_plan_id IS NOT NULL AND ap.id IS NULL THEN 1 ELSE 0 END,
  0
FROM iset_case_reminder r
LEFT JOIN iset_case_action_plan ap ON ap.id = r.action_plan_id
WHERE r.action_plan_id IS NOT NULL;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'remaining-relationship-fk-hardening-20260427',
  'staff_profile_region',
  'staff_profiles',
  sp.id,
  CAST(sp.region_id AS CHAR),
  'canada_region',
  CAST(cr.region_id AS CHAR),
  CASE WHEN sp.region_id IS NOT NULL AND cr.region_id IS NULL THEN 1 ELSE 0 END,
  0
FROM staff_profiles sp
LEFT JOIN canada_region cr ON cr.region_id = sp.region_id
WHERE sp.region_id IS NOT NULL;

SELECT COUNT(*)
  INTO @remaining_relationship_fk_blockers
  FROM privacy_erm_relationship_fk_hardening_audit
 WHERE run_label = 'remaining-relationship-fk-hardening-20260427'
   AND (missing_target = 1 OR scope_mismatch = 1);

SET @sql = IF(@remaining_relationship_fk_blockers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''remaining relationship FK blockers remain before hardening''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @staff_region_type = (
  SELECT LOWER(column_type)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'staff_profiles'
     AND column_name = 'region_id'
);

SET @sql = IF(@staff_region_type <> 'tinyint unsigned',
  'ALTER TABLE staff_profiles MODIFY region_id TINYINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'input_json_state'
     AND index_name = 'idx_input_json_state_client'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE input_json_state ADD KEY idx_input_json_state_client (client_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_client_applicant_account_event_client'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE client_applicant_account_event ADD CONSTRAINT fk_client_applicant_account_event_client FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_input_json_state_client'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE input_json_state ADD CONSTRAINT fk_input_json_state_client FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_case_assessment_intervention_budget_pot'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE iset_case_assessment ADD CONSTRAINT fk_case_assessment_intervention_budget_pot FOREIGN KEY (intervention_budget_pot_id) REFERENCES budget_pot (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_case_reminder_action_plan'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE iset_case_reminder ADD CONSTRAINT fk_case_reminder_action_plan FOREIGN KEY (action_plan_id) REFERENCES iset_case_action_plan (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_staff_profiles_region'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE staff_profiles ADD CONSTRAINT fk_staff_profiles_region FOREIGN KEY (region_id) REFERENCES canada_region (region_id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
