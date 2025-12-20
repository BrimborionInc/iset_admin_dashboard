-- Add posting context and GL code used for finance transactions and case assessment pot assignment
-- Tables altered: finance_transaction, iset_case_assessment
-- Nullable to preserve existing data; application layer enforces allowed values.

ALTER TABLE finance_transaction
  ADD COLUMN posting_context VARCHAR(16) NULL AFTER budget_pot_id,
  ADD COLUMN gl_project_code_used VARCHAR(64) NULL AFTER posting_context;

ALTER TABLE iset_case_assessment
  ADD COLUMN posting_context VARCHAR(16) NULL AFTER intervention_budget_pot_id;
