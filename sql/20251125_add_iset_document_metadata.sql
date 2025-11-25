-- Add metadata JSON column to support structured document attributes (e.g., label, virtual path).
-- Non-destructive: nullable, default NULL.

ALTER TABLE `iset_document`
  ADD COLUMN `metadata` JSON NULL AFTER `label`;
