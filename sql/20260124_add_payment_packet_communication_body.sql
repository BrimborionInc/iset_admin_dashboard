ALTER TABLE payment_packet_communication
  ADD COLUMN body TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER subject;
