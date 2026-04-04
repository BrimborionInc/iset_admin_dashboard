CREATE TABLE IF NOT EXISTS finance_regional_salary_entry (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  region_code CHAR(2) NOT NULL,
  fiscal_year_start SMALLINT UNSIGNED NOT NULL,
  budget_pot_id BIGINT UNSIGNED DEFAULT NULL,
  annual_salary_amount DECIMAL(12,2) DEFAULT NULL,
  created_by_staff_profile_id BIGINT UNSIGNED DEFAULT NULL,
  updated_by_staff_profile_id BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_finance_regional_salary_entry_region_year (region_code, fiscal_year_start),
  KEY idx_finance_regional_salary_entry_year (fiscal_year_start),
  KEY idx_finance_regional_salary_entry_pot (budget_pot_id),
  KEY idx_finance_regional_salary_entry_created_by (created_by_staff_profile_id),
  KEY idx_finance_regional_salary_entry_updated_by (updated_by_staff_profile_id),
  CONSTRAINT fk_finance_regional_salary_entry_region
    FOREIGN KEY (region_code) REFERENCES canada_region (code) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_regional_salary_entry_budget_pot
    FOREIGN KEY (budget_pot_id) REFERENCES budget_pot (id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_regional_salary_entry_created_by
    FOREIGN KEY (created_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_regional_salary_entry_updated_by
    FOREIGN KEY (updated_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL
);

SET @salary_fy_start_year = IF(MONTH(CURDATE()) >= 4, YEAR(CURDATE()), YEAR(CURDATE()) - 1);

INSERT INTO finance_regional_salary_entry (
  region_code,
  fiscal_year_start,
  budget_pot_id
)
SELECT
  region_defaults.region_code,
  @salary_fy_start_year AS fiscal_year_start,
  region_defaults.salary_pot_id
FROM (
  SELECT
    cr.code AS region_code,
    (
      SELECT bp.id
      FROM budget_pot_region bpr
      JOIN budget_pot bp ON bp.id = bpr.pot_id
      WHERE bpr.region_code = cr.code
        AND (
          UPPER(COALESCE(bp.code, '')) LIKE '%SAL%'
          OR UPPER(COALESCE(bp.name, '')) LIKE '%SALAR%'
        )
      ORDER BY bp.id ASC
      LIMIT 1
    ) AS salary_pot_id
  FROM canada_region cr
  WHERE cr.code <> 'XX'
) AS region_defaults
WHERE 1 = 1
ON DUPLICATE KEY UPDATE
  budget_pot_id = COALESCE(budget_pot_id, VALUES(budget_pot_id));
