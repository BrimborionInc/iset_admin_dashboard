-- Adds schema_snapshot JSON column to iset_application_submission
-- Safe to run multiple times (checks existence)

ALTER TABLE iset_application_submission
  ADD COLUMN schema_snapshot JSON NULL AFTER intake_payload;

-- Backfill existing rows with minimal placeholder if empty
UPDATE iset_application_submission
SET schema_snapshot = JSON_OBJECT(
  'version', COALESCE(form_version, 'unknown'),
  'captured_at', DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%sZ'),
  'fields', JSON_OBJECT()
)
WHERE schema_snapshot IS NULL;