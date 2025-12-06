-- Remove intervention-level funding stream (now plan-level)
ALTER TABLE iset_case_intervention
  DROP COLUMN funding_stream;
