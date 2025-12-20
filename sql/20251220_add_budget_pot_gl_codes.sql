-- Add GL/project codes to budget_pot and budget_snapshot_pot
-- Tables altered: budget_pot, budget_snapshot_pot
-- Nullable by default to preserve existing data; UI trims/normalizes empty to NULL.

ALTER TABLE budget_pot
  ADD COLUMN gl_project_code_external VARCHAR(64) NULL AFTER fiscal_year_tag,
  ADD COLUMN gl_project_code_internal VARCHAR(64) NULL AFTER gl_project_code_external;

ALTER TABLE budget_snapshot_pot
  ADD COLUMN gl_project_code_external VARCHAR(64) NULL AFTER fiscal_year_tag,
  ADD COLUMN gl_project_code_internal VARCHAR(64) NULL AFTER gl_project_code_external;
