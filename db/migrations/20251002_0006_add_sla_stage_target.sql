-- Migration: add SLA stage target configuration table
-- Created: 2025-10-02
-- Notes: stores editable turnaround targets per intake stage. Designed for MySQL 8.

CREATE TABLE IF NOT EXISTS sla_stage_target (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stage_key VARCHAR(64) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  target_hours INT UNSIGNED NOT NULL,
  description TEXT NULL,
  applies_to_role VARCHAR(128) NULL,
  active_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active_to DATETIME NULL DEFAULT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(128) NOT NULL DEFAULT 'system',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(128) NOT NULL DEFAULT 'system',
  PRIMARY KEY (id),
  KEY idx_sla_stage_target_stage (stage_key),
  KEY idx_sla_stage_target_role (applies_to_role),
  KEY idx_sla_stage_target_active (stage_key, applies_to_role, active_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed baseline program-wide targets if table was empty
INSERT INTO sla_stage_target (stage_key, display_name, target_hours, description)
SELECT vals.stage_key, vals.display_name, vals.target_hours, vals.description
FROM (
  SELECT 'intake_triage' AS stage_key, 'Intake triage' AS display_name, 24 AS target_hours, 'Time to first open and triage new application.' AS description
  UNION ALL SELECT 'assignment', 'Assignment', 72, 'Time to assign a coordinator or assessor after triage.'
  UNION ALL SELECT 'assessment', 'Assessment', 240, 'Working time for assessors to complete review (10 days).'
  UNION ALL SELECT 'program_decision', 'Program decision', 48, 'Decision turnaround once assessment is complete.'
) AS vals
LEFT JOIN sla_stage_target existing
  ON existing.stage_key = vals.stage_key AND existing.applies_to_role IS NULL AND existing.active_to IS NULL
WHERE existing.id IS NULL;
