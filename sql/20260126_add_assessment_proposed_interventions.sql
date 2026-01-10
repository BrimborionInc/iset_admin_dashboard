-- Add proposed interventions payload for coordinator assessment costing.
ALTER TABLE iset_case_assessment
  ADD COLUMN proposed_interventions JSON NULL;
