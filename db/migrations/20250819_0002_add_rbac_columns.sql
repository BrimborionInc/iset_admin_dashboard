-- Add region_id/assignment columns to core tables (adjust if columns already exist)
ALTER TABLE iset_application
  ADD COLUMN IF NOT EXISTS region_id INT NULL,
  ADD INDEX IF NOT EXISTS idx_iset_application_region (region_id);

ALTER TABLE iset_case
  ADD COLUMN IF NOT EXISTS region_id INT NULL,
  ADD INDEX IF NOT EXISTS idx_iset_case_region (region_id),
  ADD INDEX IF NOT EXISTS idx_iset_case_assigned (assigned_to_user_id);
