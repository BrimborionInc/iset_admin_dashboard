-- Admin user mapping to Cognito
CREATE TABLE IF NOT EXISTS admin_user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cognito_sub VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  role ENUM('SysAdmin','ProgramAdmin','RegionalCoordinator','Adjudicator') NOT NULL,
  region_id INT NULL,
  app_user_id INT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admin_user_region (region_id),
  INDEX idx_admin_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
