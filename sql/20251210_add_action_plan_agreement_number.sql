-- Add agreement number to action plans (per-plan, not case-level)
ALTER TABLE iset_case_action_plan
  ADD COLUMN agreement_number VARCHAR(128) NULL AFTER status;
