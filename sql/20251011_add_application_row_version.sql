-- Migration: add optimistic concurrency token to iset_application
-- Adds a monotonically increasing row_version column that increments on each write.

ALTER TABLE iset_application
  ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
