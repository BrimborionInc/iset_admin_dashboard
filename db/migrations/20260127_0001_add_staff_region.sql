-- Add staff_region mapping table for multi-region regional managers
CREATE TABLE IF NOT EXISTS staff_region (
  staff_profile_id BIGINT UNSIGNED NOT NULL,
  region_id TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_profile_id, region_id),
  KEY idx_staff_region_region (region_id),
  CONSTRAINT fk_staff_region_staff_profile
    FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_region_region
    FOREIGN KEY (region_id) REFERENCES canada_region(region_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill from staff_profiles.region_id (single-province baseline)
INSERT INTO staff_region (staff_profile_id, region_id)
SELECT id, region_id
FROM staff_profiles
WHERE region_id IS NOT NULL AND region_id > 0
ON DUPLICATE KEY UPDATE updated_at = staff_region.updated_at;
