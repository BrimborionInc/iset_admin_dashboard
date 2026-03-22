CREATE TABLE IF NOT EXISTS iset_regional_snapshot_report (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  region_id TINYINT UNSIGNED NOT NULL,
  period_type ENUM('month', 'quarter', 'year') NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  snapshot_status ENUM('draft', 'final') NOT NULL DEFAULT 'draft',
  regional_manager_name VARCHAR(255) NULL,
  regional_coordinator_name VARCHAR(255) NULL,
  er_funding_amount DECIMAL(14,2) NULL,
  if_funding_amount DECIMAL(14,2) NULL,
  coordinator_salary_amount DECIMAL(14,2) NULL,
  operating_costs_amount DECIMAL(14,2) NULL,
  compliance_flag VARCHAR(64) NULL,
  comments_recommendations TEXT NULL,
  manual_inputs_json JSON NULL,
  created_by_staff_profile_id BIGINT UNSIGNED NULL,
  updated_by_staff_profile_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_snapshot_region_period (region_id, period_type, period_start, period_end),
  KEY idx_snapshot_period (period_type, period_start, period_end),
  KEY idx_snapshot_status (snapshot_status),
  KEY idx_snapshot_created_by (created_by_staff_profile_id),
  KEY idx_snapshot_updated_by (updated_by_staff_profile_id),
  CONSTRAINT fk_snapshot_region
    FOREIGN KEY (region_id) REFERENCES canada_region (region_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_snapshot_created_by
    FOREIGN KEY (created_by_staff_profile_id) REFERENCES staff_profiles (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_snapshot_updated_by
    FOREIGN KEY (updated_by_staff_profile_id) REFERENCES staff_profiles (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
