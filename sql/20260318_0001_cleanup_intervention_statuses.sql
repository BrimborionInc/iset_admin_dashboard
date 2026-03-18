UPDATE iset_case_intervention
SET status = 'approved'
WHERE LOWER(TRIM(COALESCE(status, ''))) = 'planned';

UPDATE iset_case_intervention
SET status = 'suspended'
WHERE REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') = 'on_hold';

UPDATE iset_case_intervention
SET status = 'in_progress'
WHERE REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') IN (
  'active',
  'inprogress',
  'progress',
  'ready_to_close'
);

ALTER TABLE iset_case_intervention
  ALTER COLUMN status SET DEFAULT 'draft';
