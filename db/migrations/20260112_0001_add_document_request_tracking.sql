ALTER TABLE iset_application
  ADD COLUMN docs_requested_active TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN docs_requested_at DATETIME DEFAULT NULL,
  ADD COLUMN docs_requested_cleared_at DATETIME DEFAULT NULL,
  ADD COLUMN docs_requested_source VARCHAR(32) DEFAULT NULL,
  ADD INDEX idx_docs_requested_active (docs_requested_active),
  ADD INDEX idx_docs_requested_at (docs_requested_at);
