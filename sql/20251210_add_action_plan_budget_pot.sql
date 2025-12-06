-- Add budget pot to action plans (plan-level funding container)
ALTER TABLE iset_case_action_plan
  ADD COLUMN budget_pot VARCHAR(128) NULL AFTER agreement_number;
