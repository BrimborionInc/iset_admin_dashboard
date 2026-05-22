-- PROD guarded data repair for denied applications whose denial letter was sent
-- but whose application lifecycle remained decision_recorded.
-- Restore point: path-prod-denial-letter-completion-repair-20260522170354
-- Purpose:
-- - The May 20 denial-letter completion fix relies on a frontend follow-up call after
--   the secure message send.
-- - These already-sent denial letters recorded decisionLetterSent.denial but left the
--   application row as rejected / decision_recorded / denied, so Manage ISET Applications
--   still listed them as active.
-- - Close the application rows while preserving decision_outcome='denied'.

DROP PROCEDURE IF EXISTS prod_fix_denial_letter_completion_repair;

DELIMITER //

CREATE PROCEDURE prod_fix_denial_letter_completion_repair()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_app_updated_count INT DEFAULT 0;
  DECLARE v_case_updated_count INT DEFAULT 0;
  DECLARE v_verified_count INT DEFAULT 0;
  DECLARE v_remaining_count INT DEFAULT 0;

  DROP TEMPORARY TABLE IF EXISTS tmp_denial_letter_completion_repair;
  CREATE TEMPORARY TABLE tmp_denial_letter_completion_repair AS
  SELECT
    a.id AS application_id,
    a.case_id,
    JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id,
    a.status AS previous_status,
    a.lifecycle_status AS previous_lifecycle_status,
    a.decision_outcome AS previous_decision_outcome,
    a.awaiting_reason AS previous_awaiting_reason,
    a.closure_reason AS previous_closure_reason,
    a.row_version AS previous_row_version,
    c.status AS previous_case_status,
    c.lifecycle_status AS previous_case_lifecycle_status,
    c.closure_reason AS previous_case_closure_reason,
    COALESCE(
      JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', a.id, '".decisionLetterSent.denial'))),
      JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.decisionLetterSent.denial'))
    ) AS denial_sent_at
  FROM iset_application a
  JOIN iset_case c ON c.id = a.case_id
  WHERE a.id IN (4, 9, 10, 11, 14, 28, 35, 37, 41, 44, 48, 53, 66)
    AND LOWER(COALESCE(a.status, '')) IN ('rejected', 'declined', 'denied')
    AND LOWER(COALESCE(a.lifecycle_status, '')) = 'decision_recorded'
    AND LOWER(COALESCE(a.decision_outcome, '')) = 'denied'
    AND COALESCE(
      JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', a.id, '".decisionLetterSent.denial'))),
      JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.decisionLetterSent.denial'))
    ) IS NOT NULL;

  SELECT COUNT(*) INTO v_guard_count
    FROM tmp_denial_letter_completion_repair;

  IF v_guard_count <> 13 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for denial-letter completion repair; expected 13 affected applications.';
  END IF;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_application a
    JOIN tmp_denial_letter_completion_repair fix ON fix.application_id = a.id
    JOIN iset_case c ON c.id = a.case_id
   WHERE a.case_id = fix.case_id
     AND LOWER(COALESCE(a.status, '')) IN ('rejected', 'declined', 'denied')
     AND LOWER(COALESCE(a.lifecycle_status, '')) = 'decision_recorded'
     AND LOWER(COALESCE(a.decision_outcome, '')) = 'denied'
     AND COALESCE(
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', a.id, '".decisionLetterSent.denial'))),
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.decisionLetterSent.denial'))
     ) IS NOT NULL
   FOR UPDATE;

  IF v_guard_count <> 13 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Lock guard failed for denial-letter completion repair; expected 13 target applications.';
  END IF;

  UPDATE iset_application a
  JOIN tmp_denial_letter_completion_repair fix ON fix.application_id = a.id
     SET a.status = 'completed',
         a.lifecycle_status = 'closed',
         a.decision_outcome = 'denied',
         a.awaiting_reason = 'none',
         a.row_version = a.row_version + 1,
         a.updated_at = NOW()
   WHERE a.case_id = fix.case_id
     AND LOWER(COALESCE(a.status, '')) IN ('rejected', 'declined', 'denied')
     AND LOWER(COALESCE(a.lifecycle_status, '')) = 'decision_recorded'
     AND LOWER(COALESCE(a.decision_outcome, '')) = 'denied';

  SET v_app_updated_count = ROW_COUNT();
  IF v_app_updated_count <> 13 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denial-letter completion repair updated an unexpected number of applications.';
  END IF;

  UPDATE iset_case c
  JOIN tmp_denial_letter_completion_repair fix ON fix.case_id = c.id
     SET c.closure_reason = CASE
           WHEN LOWER(COALESCE(c.status, '')) = 'closed'
            AND LOWER(COALESCE(c.lifecycle_status, '')) = 'closed'
            AND LOWER(COALESCE(c.closure_reason, '')) IN ('', 'administrative')
           THEN 'application_denied'
           ELSE c.closure_reason
         END,
         c.case_context_json = JSON_SET(
           JSON_SET(
             COALESCE(c.case_context_json, JSON_OBJECT()),
             CONCAT('$.applicationDecisionLetters."', fix.application_id, '".dataRepair'),
             COALESCE(
               JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', fix.application_id, '".dataRepair')),
               JSON_OBJECT()
             )
           ),
           CONCAT('$.applicationDecisionLetters."', fix.application_id, '".dataRepair.denialLetterCompletionRepair'),
           JSON_OBJECT(
             'restorePoint', 'path-prod-denial-letter-completion-repair-20260522170354',
             'reason', 'Denial letter had been sent but application lifecycle remained decision_recorded, leaving the row in active application lists.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ'),
             'previousStatus', fix.previous_status,
             'previousLifecycleStatus', fix.previous_lifecycle_status,
             'previousDecisionOutcome', fix.previous_decision_outcome,
             'previousAwaitingReason', fix.previous_awaiting_reason,
             'previousClosureReason', fix.previous_closure_reason,
             'previousRowVersion', fix.previous_row_version,
             'denialSentAt', fix.denial_sent_at
           )
         ),
         c.updated_at = NOW()
   WHERE LOWER(COALESCE(c.status, '')) = 'closed'
     AND LOWER(COALESCE(c.lifecycle_status, '')) = 'closed';

  SET v_case_updated_count = ROW_COUNT();
  IF v_case_updated_count <> 13 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denial-letter completion repair updated an unexpected number of case context rows.';
  END IF;

  SELECT COUNT(*) INTO v_verified_count
    FROM iset_application a
    JOIN tmp_denial_letter_completion_repair fix ON fix.application_id = a.id
    JOIN iset_case c ON c.id = a.case_id
   WHERE a.case_id = fix.case_id
     AND a.status = 'completed'
     AND a.lifecycle_status = 'closed'
     AND a.decision_outcome = 'denied'
     AND a.awaiting_reason = 'none'
     AND a.row_version = fix.previous_row_version + 1
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', a.id, '".dataRepair.denialLetterCompletionRepair.restorePoint'))) = 'path-prod-denial-letter-completion-repair-20260522170354';

  IF v_verified_count <> 13 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denial-letter completion repair verification failed.';
  END IF;

  SELECT COUNT(*) INTO v_remaining_count
    FROM iset_application a
    JOIN iset_case c ON c.id = a.case_id
   WHERE LOWER(COALESCE(a.decision_outcome, '')) = 'denied'
     AND COALESCE(a.lifecycle_status, '') NOT IN ('closed', 'archived')
     AND COALESCE(
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', a.id, '".decisionLetterSent.denial'))),
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.decisionLetterSent.denial'))
     ) IS NOT NULL;

  IF v_remaining_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denial-letter completion repair left sent-denial applications not closed.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_denial_letter_completion_repair();

DROP PROCEDURE IF EXISTS prod_fix_denial_letter_completion_repair;

SELECT
  a.id AS application_id,
  a.case_id,
  JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id,
  a.status,
  a.lifecycle_status,
  a.decision_outcome,
  a.awaiting_reason,
  a.row_version,
  c.status AS case_status,
  c.lifecycle_status AS case_lifecycle_status,
  c.closure_reason AS case_closure_reason,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', a.id, '".dataRepair.denialLetterCompletionRepair.restorePoint'))) AS restore_point
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
WHERE a.id IN (4, 9, 10, 11, 14, 28, 35, 37, 41, 44, 48, 53, 66)
ORDER BY a.id;

SELECT COUNT(*) AS sent_denial_not_closed_remaining
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
WHERE LOWER(COALESCE(a.decision_outcome, '')) = 'denied'
  AND COALESCE(a.lifecycle_status, '') NOT IN ('closed', 'archived')
  AND COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, CONCAT('$.applicationDecisionLetters."', a.id, '".decisionLetterSent.denial'))),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.decisionLetterSent.denial'))
  ) IS NOT NULL;
