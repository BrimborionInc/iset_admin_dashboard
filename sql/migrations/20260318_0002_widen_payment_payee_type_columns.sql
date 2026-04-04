ALTER TABLE payment_packet_line
  MODIFY payee_type varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE payee_profile
  MODIFY payee_type varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
