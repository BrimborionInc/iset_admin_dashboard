-- PROD one-off correction prepared on 2026-04-18.
-- Purpose: restore the three missing consent/signing workflows that feed the
-- Secure Messaging "Attach form(s) to send" picker.
--
-- Source of truth verified from DEV:
--   workflow 49 -> EI Consent Form -> step 76
--   workflow 50 -> Indigenous Declaration -> step 77
--   workflow 51 -> Conflict of Interest Form -> step 126
--
-- Intended result in PROD:
--   insert the missing workflow rows and workflow_step rows only
--   no workflow_route / workflow_route_option rows are required

START TRANSACTION;

SELECT id, name, status, workflow_type, document_type, created_at, updated_at
FROM iset_intake.workflow
WHERE id IN (49, 50, 51)
   OR name IN ('EI Consent Form', 'Indigenous Declaration', 'Conflict of Interest Form')
ORDER BY id, name
FOR UPDATE;

SELECT workflow_id, step_id, is_start
FROM iset_intake.workflow_step
WHERE workflow_id IN (49, 50, 51)
ORDER BY workflow_id, step_id
FOR UPDATE;

SELECT id, name
FROM iset_intake.step
WHERE id IN (76, 77, 126)
ORDER BY id
FOR UPDATE;

INSERT INTO iset_intake.workflow
  (id, name, status, workflow_type, document_type, created_at, updated_at)
SELECT 49, 'EI Consent Form', 'active', 'consent-no-prefill', 'ei_consent', '2026-04-17 18:00:37', '2026-04-17 18:00:37'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM iset_intake.workflow WHERE id = 49)
  AND NOT EXISTS (SELECT 1 FROM iset_intake.workflow WHERE name = 'EI Consent Form');

INSERT INTO iset_intake.workflow
  (id, name, status, workflow_type, document_type, created_at, updated_at)
SELECT 50, 'Indigenous Declaration', 'active', 'consent-no-prefill', 'indigenous_declaration', '2026-04-17 18:00:37', '2026-04-17 18:00:37'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM iset_intake.workflow WHERE id = 50)
  AND NOT EXISTS (SELECT 1 FROM iset_intake.workflow WHERE name = 'Indigenous Declaration');

INSERT INTO iset_intake.workflow
  (id, name, status, workflow_type, document_type, created_at, updated_at)
SELECT 51, 'Conflict of Interest Form', 'active', 'consent-no-prefill', 'conflict_of_interest', '2026-04-17 18:00:37', '2026-04-17 18:00:37'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM iset_intake.workflow WHERE id = 51)
  AND NOT EXISTS (SELECT 1 FROM iset_intake.workflow WHERE name = 'Conflict of Interest Form');

INSERT INTO iset_intake.workflow_step
  (workflow_id, step_id, is_start)
SELECT 49, 76, 1
FROM DUAL
WHERE EXISTS (SELECT 1 FROM iset_intake.workflow WHERE id = 49)
  AND EXISTS (SELECT 1 FROM iset_intake.step WHERE id = 76)
  AND NOT EXISTS (
    SELECT 1
    FROM iset_intake.workflow_step
    WHERE workflow_id = 49 AND step_id = 76
  );

INSERT INTO iset_intake.workflow_step
  (workflow_id, step_id, is_start)
SELECT 50, 77, 1
FROM DUAL
WHERE EXISTS (SELECT 1 FROM iset_intake.workflow WHERE id = 50)
  AND EXISTS (SELECT 1 FROM iset_intake.step WHERE id = 77)
  AND NOT EXISTS (
    SELECT 1
    FROM iset_intake.workflow_step
    WHERE workflow_id = 50 AND step_id = 77
  );

INSERT INTO iset_intake.workflow_step
  (workflow_id, step_id, is_start)
SELECT 51, 126, 1
FROM DUAL
WHERE EXISTS (SELECT 1 FROM iset_intake.workflow WHERE id = 51)
  AND EXISTS (SELECT 1 FROM iset_intake.step WHERE id = 126)
  AND NOT EXISTS (
    SELECT 1
    FROM iset_intake.workflow_step
    WHERE workflow_id = 51 AND step_id = 126
  );

SELECT id, name, status, workflow_type, document_type, created_at, updated_at
FROM iset_intake.workflow
WHERE id IN (49, 50, 51)
ORDER BY id;

SELECT workflow_id, step_id, is_start
FROM iset_intake.workflow_step
WHERE workflow_id IN (49, 50, 51)
ORDER BY workflow_id, step_id;

SELECT w.id, w.name, w.status, w.workflow_type, w.document_type, COUNT(ws.step_id) AS step_count
FROM iset_intake.workflow w
LEFT JOIN iset_intake.workflow_step ws ON ws.workflow_id = w.id
WHERE w.workflow_type IN ('consent-no-prefill', 'consent-cm-prefill')
GROUP BY w.id, w.name, w.status, w.workflow_type, w.document_type, w.updated_at
ORDER BY w.updated_at DESC, w.id DESC;

COMMIT;
