-- Persist staff hands-on tutorial completion/dismissal in the database.
-- Used by the Admin Console "Take a tour" feature (Cloudscape AnnotationContext/Hotspot/TutorialPanel).

CREATE TABLE IF NOT EXISTS staff_tutorial_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_profile_id INT NOT NULL,
  tutorial_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  completed_at DATETIME NULL,
  dismissed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_staff_tutorial (staff_profile_id, tutorial_id),
  INDEX idx_staff_profile (staff_profile_id),
  INDEX idx_tutorial (tutorial_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

