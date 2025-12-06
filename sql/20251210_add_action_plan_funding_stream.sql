-- Add funding stream to action plans (one per plan)
ALTER TABLE iset_case_action_plan
  ADD COLUMN funding_stream VARCHAR(128) NULL AFTER budget_pot;
