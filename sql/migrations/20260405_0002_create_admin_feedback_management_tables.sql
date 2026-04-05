CREATE TABLE IF NOT EXISTS admin_feedback_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  previous_status VARCHAR(32) NULL,
  new_status VARCHAR(32) NOT NULL,
  changed_by_staff_profile_id INT NULL,
  changed_by_name VARCHAR(255) NULL,
  changed_by_email VARCHAR(320) NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_feedback_status_history_report (report_id, changed_at),
  KEY idx_admin_feedback_status_history_actor (changed_by_staff_profile_id, changed_at),
  CONSTRAINT fk_admin_feedback_status_history_report
    FOREIGN KEY (report_id) REFERENCES admin_feedback_report (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_feedback_note (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  author_staff_profile_id INT NULL,
  author_name VARCHAR(255) NULL,
  author_email VARCHAR(320) NULL,
  note_text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_feedback_note_report (report_id, created_at),
  KEY idx_admin_feedback_note_author (author_staff_profile_id, created_at),
  CONSTRAINT fk_admin_feedback_note_report
    FOREIGN KEY (report_id) REFERENCES admin_feedback_report (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
