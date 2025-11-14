-- Persist transient intake "input JSON" aggregates per applicant session so
-- load-balanced portal instances share consistent state. Rows are short-lived
-- (cleared on logout/submission/save-later and pruned via expires_at).
CREATE TABLE IF NOT EXISTS `input_json_state` (
  `user_id` INT NOT NULL,
  `session_token` CHAR(64) NOT NULL DEFAULT '',
  `workflow_id` VARCHAR(64) NOT NULL DEFAULT 'iset-v1',
  `step_cursor` VARCHAR(128) DEFAULT NULL,
  `input_payload` JSON NOT NULL,
  `history` JSON DEFAULT NULL,
  `doc_refs` JSON DEFAULT NULL,
  `checksum_sha256` CHAR(64) DEFAULT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`, `session_token`),
  KEY `idx_input_json_state_expires` (`expires_at`),
  CONSTRAINT `fk_input_json_state_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
