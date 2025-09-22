-- Ensure indexes and defaults for case status/stage
ALTER TABLE iset_case
  ADD INDEX idx_iset_case_status (status),
  ADD INDEX idx_iset_case_stage (stage),
  MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'submitted';

-- Backfill legacy rows to submitted when blank or placeholder
UPDATE iset_case
  SET status = 'submitted'
  WHERE status IS NULL OR status = '' OR status = 'open';
