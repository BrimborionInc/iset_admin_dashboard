CREATE TABLE IF NOT EXISTS admin_ai_guidance_entry (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  surface VARCHAR(64) NOT NULL DEFAULT 'help-panel',
  priority INT NOT NULL DEFAULT 100,
  active TINYINT(1) NOT NULL DEFAULT 1,
  source_type VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'workflow',
  coverage_domain VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  coverage_status VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted',
  route_patterns_json JSON NULL,
  help_titles_json JSON NULL,
  roles_json JSON NULL,
  workflow_states_json JSON NULL,
  topic_tags_json JSON NULL,
  keywords_json JSON NULL,
  state_hints_json JSON NULL,
  source_refs_json JSON NULL,
  expected_anchors_json JSON NULL,
  do_not_say_json JSON NULL,
  applicability_text TEXT COLLATE utf8mb4_unicode_ci NULL,
  answer_style_text TEXT COLLATE utf8mb4_unicode_ci NULL,
  steps_text MEDIUMTEXT COLLATE utf8mb4_unicode_ci NULL,
  side_effects_text TEXT COLLATE utf8mb4_unicode_ci NULL,
  restrictions_text TEXT COLLATE utf8mb4_unicode_ci NULL,
  guidance_text MEDIUMTEXT COLLATE utf8mb4_unicode_ci NOT NULL,
  last_reviewed_at DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_slug (slug),
  KEY idx_surface_active (surface, active),
  KEY idx_guidance_source_type (source_type),
  KEY idx_guidance_coverage_domain (coverage_domain),
  KEY idx_guidance_coverage_status (coverage_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_ai_guidance_example (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guidance_slug VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  route_context_json JSON NULL,
  role_context_json JSON NULL,
  must_mention_json JSON NULL,
  must_not_mention_json JSON NULL,
  source_refs_json JSON NULL,
  eval_fixture_id VARCHAR(128) COLLATE utf8mb4_unicode_ci NULL,
  coverage_status VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'drafted',
  question_text TEXT COLLATE utf8mb4_unicode_ci NOT NULL,
  answer_text MEDIUMTEXT COLLATE utf8mb4_unicode_ci NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_guidance_slug_sort (guidance_slug, sort_order),
  KEY idx_guidance_slug_active (guidance_slug, active),
  KEY idx_guidance_example_fixture (eval_fixture_id),
  KEY idx_guidance_example_coverage_status (coverage_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'source_type'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN source_type VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''workflow'' AFTER active', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'coverage_domain'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN coverage_domain VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER source_type', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'coverage_status'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN coverage_status VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''drafted'' AFTER coverage_domain', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'workflow_states_json'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN workflow_states_json JSON NULL AFTER roles_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'expected_anchors_json'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN expected_anchors_json JSON NULL AFTER source_refs_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'do_not_say_json'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN do_not_say_json JSON NULL AFTER expected_anchors_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'applicability_text'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN applicability_text TEXT COLLATE utf8mb4_unicode_ci NULL AFTER do_not_say_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'steps_text'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN steps_text MEDIUMTEXT COLLATE utf8mb4_unicode_ci NULL AFTER answer_style_text', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'side_effects_text'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN side_effects_text TEXT COLLATE utf8mb4_unicode_ci NULL AFTER steps_text', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'restrictions_text'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN restrictions_text TEXT COLLATE utf8mb4_unicode_ci NULL AFTER side_effects_text', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND column_name = 'last_reviewed_at'
), 'ALTER TABLE admin_ai_guidance_entry ADD COLUMN last_reviewed_at DATE NULL AFTER guidance_text', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND index_name = 'idx_guidance_source_type'
), 'CREATE INDEX idx_guidance_source_type ON admin_ai_guidance_entry (source_type)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND index_name = 'idx_guidance_coverage_domain'
), 'CREATE INDEX idx_guidance_coverage_domain ON admin_ai_guidance_entry (coverage_domain)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_entry'
     AND index_name = 'idx_guidance_coverage_status'
), 'CREATE INDEX idx_guidance_coverage_status ON admin_ai_guidance_entry (coverage_status)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND column_name = 'route_context_json'
), 'ALTER TABLE admin_ai_guidance_example ADD COLUMN route_context_json JSON NULL AFTER active', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND column_name = 'role_context_json'
), 'ALTER TABLE admin_ai_guidance_example ADD COLUMN role_context_json JSON NULL AFTER route_context_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND column_name = 'must_mention_json'
), 'ALTER TABLE admin_ai_guidance_example ADD COLUMN must_mention_json JSON NULL AFTER role_context_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND column_name = 'must_not_mention_json'
), 'ALTER TABLE admin_ai_guidance_example ADD COLUMN must_not_mention_json JSON NULL AFTER must_mention_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND column_name = 'source_refs_json'
), 'ALTER TABLE admin_ai_guidance_example ADD COLUMN source_refs_json JSON NULL AFTER must_not_mention_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND column_name = 'eval_fixture_id'
), 'ALTER TABLE admin_ai_guidance_example ADD COLUMN eval_fixture_id VARCHAR(128) COLLATE utf8mb4_unicode_ci NULL AFTER source_refs_json', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND column_name = 'coverage_status'
), 'ALTER TABLE admin_ai_guidance_example ADD COLUMN coverage_status VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''drafted'' AFTER eval_fixture_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND index_name = 'idx_guidance_example_fixture'
), 'CREATE INDEX idx_guidance_example_fixture ON admin_ai_guidance_example (eval_fixture_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'admin_ai_guidance_example'
     AND index_name = 'idx_guidance_example_coverage_status'
), 'CREATE INDEX idx_guidance_example_coverage_status ON admin_ai_guidance_example (coverage_status)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
