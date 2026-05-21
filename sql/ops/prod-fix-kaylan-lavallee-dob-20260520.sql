-- PROD guarded data repair for Kaylan Lavallee / ISET-20260422-B9C76E.
-- Purpose: correct the invalid DOB value that was accepted by the public intake
-- date-input renderer before strict calendar validation was added.
-- Expected old value: 2008-24-12
-- Corrected value: 2008-12-24

DELIMITER //

DROP PROCEDURE IF EXISTS prod_fix_kaylan_lavallee_dob_20260520//

CREATE PROCEDURE prod_fix_kaylan_lavallee_dob_20260520()
BEGIN
  DECLARE v_reference VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ISET-20260422-B9C76E';
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 37;
  DECLARE v_submission_id BIGINT UNSIGNED DEFAULT 37;
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 119;
  DECLARE v_client_id BIGINT UNSIGNED DEFAULT 132;
  DECLARE v_user_id BIGINT UNSIGNED DEFAULT 170;
  DECLARE v_old_dob VARCHAR(32) DEFAULT '2008-24-12';
  DECLARE v_new_dob DATE DEFAULT DATE('2008-12-24');
  DECLARE v_run_id VARCHAR(64) DEFAULT 'prod-fix-kaylan-lavallee-dob-20260520';
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_submission_updates INT DEFAULT 0;
  DECLARE v_case_updates INT DEFAULT 0;
  DECLARE v_client_updates INT DEFAULT 0;
  DECLARE v_user_updates INT DEFAULT 0;
  DECLARE v_application_updates INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application_submission s
    JOIN iset_application a ON a.id = v_application_id AND a.submission_id = s.id
    JOIN iset_case c ON c.id = a.case_id
    JOIN client cl ON cl.id = a.client_id
    JOIN user u ON u.id = s.user_id
   WHERE s.id = v_submission_id
     AND s.user_id = v_user_id
     AND BINARY s.reference_number = BINARY v_reference
     AND a.client_id = v_client_id
     AND a.case_id = v_case_id
     AND BINARY c.case_number = BINARY v_reference
     AND BINARY cl.first_name = BINARY 'Kaylan'
     AND BINARY cl.last_name = BINARY 'Lavallee'
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$.dob')) = BINARY v_old_dob
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers.dob')) = BINARY v_old_dob
     AND cl.dob IS NULL
     AND u.date_of_birth IS NULL;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_kaylan_lavallee_dob';
  END IF;

  UPDATE iset_application_submission
     SET intake_payload = JSON_SET(COALESCE(intake_payload, JSON_OBJECT()), '$.dob', DATE_FORMAT(v_new_dob, '%Y-%m-%d')),
         updated_at = NOW()
   WHERE id = v_submission_id
     AND user_id = v_user_id
     AND BINARY reference_number = BINARY v_reference
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(intake_payload, '$.dob')) = BINARY v_old_dob;

  SET v_submission_updates = ROW_COUNT();

  UPDATE iset_case
     SET case_context_json = JSON_SET(
           COALESCE(case_context_json, JSON_OBJECT()),
           '$.dateOfBirth', DATE_FORMAT(v_new_dob, '%Y-%m-%d'),
           '$.applicationAnswers.dob', DATE_FORMAT(v_new_dob, '%Y-%m-%d')
         ),
         updated_at = NOW()
   WHERE id = v_case_id
     AND client_id = v_client_id
     AND BINARY case_number = BINARY v_reference
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.applicationAnswers.dob')) = BINARY v_old_dob;

  SET v_case_updates = ROW_COUNT();

  UPDATE client
     SET dob = v_new_dob,
         updated_at = NOW()
   WHERE id = v_client_id
     AND BINARY first_name = BINARY 'Kaylan'
     AND BINARY last_name = BINARY 'Lavallee'
     AND dob IS NULL;

  SET v_client_updates = ROW_COUNT();

  UPDATE user
     SET date_of_birth = v_new_dob,
         updated_at = NOW()
   WHERE id = v_user_id
     AND BINARY email = BINARY 'kimberlypoitras@hotmail.com'
     AND date_of_birth IS NULL;

  SET v_user_updates = ROW_COUNT();

  UPDATE iset_application
     SET payload_json = JSON_SET(
           COALESCE(payload_json, JSON_OBJECT()),
           '$.dataRepair',
           JSON_MERGE_PATCH(
             COALESCE(JSON_EXTRACT(payload_json, '$.dataRepair'), JSON_OBJECT()),
             JSON_OBJECT(
               'kaylanLavalleeDob20260520',
               JSON_OBJECT(
                 'runId', v_run_id,
                 'repairedAt', UTC_TIMESTAMP(3),
                 'reason', 'Corrected invalid DOB admitted by pre-fix intake date-input validation.',
                 'oldDob', v_old_dob,
                 'newDob', DATE_FORMAT(v_new_dob, '%Y-%m-%d'),
                 'fieldsUpdated', JSON_ARRAY(
                   'iset_application_submission.intake_payload.dob',
                   'iset_case.case_context_json.dateOfBirth',
                   'iset_case.case_context_json.applicationAnswers.dob',
                   'client.dob',
                   'user.date_of_birth'
                 )
               )
             )
           )
         ),
         updated_at = NOW(),
         row_version = COALESCE(row_version, 0) + 1
   WHERE id = v_application_id
     AND submission_id = v_submission_id
     AND client_id = v_client_id
     AND case_id = v_case_id;

  SET v_application_updates = ROW_COUNT();

  IF v_submission_updates <> 1
     OR v_case_updates <> 1
     OR v_client_updates <> 1
     OR v_user_updates <> 1
     OR v_application_updates <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_count_failed_kaylan_lavallee_dob';
  END IF;

  COMMIT;

  SELECT
    v_reference AS reference_number,
    v_run_id AS run_id,
    DATE_FORMAT(v_new_dob, '%Y-%m-%d') AS corrected_dob,
    v_submission_updates AS submission_rows_updated,
    v_case_updates AS case_rows_updated,
    v_client_updates AS client_rows_updated,
    v_user_updates AS user_rows_updated,
    v_application_updates AS application_rows_updated;
END//

CALL prod_fix_kaylan_lavallee_dob_20260520()//

DROP PROCEDURE IF EXISTS prod_fix_kaylan_lavallee_dob_20260520//

DELIMITER ;

SELECT
  a.id AS application_id,
  s.id AS submission_id,
  s.reference_number,
  c.id AS case_id,
  cl.id AS client_id,
  u.id AS user_id,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$.dob')) AS submission_dob,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.dateOfBirth')) AS case_context_dob,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers.dob')) AS case_context_answers_dob,
  cl.dob AS client_dob,
  u.date_of_birth AS user_dob,
  JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.dataRepair.kaylanLavalleeDob20260520.newDob')) AS repair_new_dob
FROM iset_application_submission s
JOIN iset_application a ON a.submission_id = s.id
JOIN iset_case c ON c.id = a.case_id
JOIN client cl ON cl.id = a.client_id
JOIN user u ON u.id = s.user_id
WHERE BINARY s.reference_number = BINARY 'ISET-20260422-B9C76E';
