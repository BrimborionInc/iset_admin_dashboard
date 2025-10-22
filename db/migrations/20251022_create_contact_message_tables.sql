-- 2025-10-22 Create tables for public portal contact messages
CREATE TABLE IF NOT EXISTS contact_message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  user_id INT NULL,
  submitted_ip VARCHAR(45) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_contact_message_status_submitted (status, submitted_at),
  KEY idx_contact_message_submitted_at (submitted_at),
  KEY idx_contact_message_user_id (user_id),
  CONSTRAINT fk_contact_message_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_message_note (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_message_id INT NOT NULL,
  author_user_id INT NULL,
  note_text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contact_message_note_message (contact_message_id),
  KEY idx_contact_message_note_author (author_user_id),
  CONSTRAINT fk_contact_message_note_message FOREIGN KEY (contact_message_id) REFERENCES contact_message (id) ON DELETE CASCADE,
  CONSTRAINT fk_contact_message_note_author FOREIGN KEY (author_user_id) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_message_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_message_id INT NOT NULL,
  previous_status VARCHAR(32) NOT NULL,
  new_status VARCHAR(32) NOT NULL,
  changed_by_user_id INT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contact_message_status_history_message (contact_message_id),
  KEY idx_contact_message_status_history_changed_by (changed_by_user_id),
  CONSTRAINT fk_contact_message_status_history_message FOREIGN KEY (contact_message_id) REFERENCES contact_message (id) ON DELETE CASCADE,
  CONSTRAINT fk_contact_message_status_history_user FOREIGN KEY (changed_by_user_id) REFERENCES `user` (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;