ALTER TABLE payment_packet
  ADD COLUMN follow_up_status varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_required' AFTER status,
  ADD COLUMN follow_up_due_at date DEFAULT NULL AFTER due_by,
  ADD COLUMN follow_up_updated_at datetime DEFAULT NULL AFTER follow_up_due_at,
  ADD INDEX idx_payment_packet_follow_up_status (follow_up_status),
  ADD INDEX idx_payment_packet_follow_up_due (follow_up_due_at);

ALTER TABLE payment_packet_line
  ADD COLUMN follow_up_status varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_required' AFTER status,
  ADD COLUMN follow_up_due_at date DEFAULT NULL AFTER follow_up_status,
  ADD COLUMN follow_up_updated_at datetime DEFAULT NULL AFTER follow_up_due_at,
  ADD INDEX idx_payment_line_follow_up_status (follow_up_status),
  ADD INDEX idx_payment_line_follow_up_due (follow_up_due_at);

CREATE TABLE payment_followup_event (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  payment_packet_id bigint unsigned NOT NULL,
  payment_packet_line_id bigint unsigned DEFAULT NULL,
  from_status varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  to_status varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  actor_user_id int DEFAULT NULL,
  note text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  due_at date DEFAULT NULL,
  document_id bigint unsigned DEFAULT NULL,
  metadata json DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_followup_packet (payment_packet_id),
  KEY idx_payment_followup_line (payment_packet_line_id),
  KEY idx_payment_followup_status (to_status),
  KEY idx_payment_followup_due (due_at),
  KEY idx_payment_followup_actor (actor_user_id),
  KEY idx_payment_followup_document (document_id),
  CONSTRAINT fk_payment_followup_packet FOREIGN KEY (payment_packet_id) REFERENCES payment_packet (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_followup_line FOREIGN KEY (payment_packet_line_id) REFERENCES payment_packet_line (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_followup_actor FOREIGN KEY (actor_user_id) REFERENCES user (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_followup_document FOREIGN KEY (document_id) REFERENCES iset_document (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE payment_packet
SET
  follow_up_status = CASE status
    WHEN 'submitted' THEN 'sent_to_finance'
    WHEN 'confirmed' THEN 'reported_paid'
    WHEN 'cancelled' THEN 'cancelled_not_proceeding'
    ELSE 'not_required'
  END,
  follow_up_updated_at = CASE
    WHEN status IN ('submitted', 'confirmed', 'cancelled') THEN COALESCE(updated_at, NOW())
    ELSE follow_up_updated_at
  END;

UPDATE payment_packet_line
SET
  follow_up_status = CASE status
    WHEN 'submitted' THEN 'sent_to_finance'
    WHEN 'paid' THEN 'reported_paid'
    WHEN 'held' THEN 'follow_up_needed'
    WHEN 'cancelled' THEN 'cancelled_not_proceeding'
    ELSE 'not_required'
  END,
  follow_up_updated_at = CASE
    WHEN status IN ('submitted', 'paid', 'held', 'cancelled') THEN COALESCE(updated_at, NOW())
    ELSE follow_up_updated_at
  END;
