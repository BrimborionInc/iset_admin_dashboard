-- PROD data repair for Participant Details application-answer pull-through.
-- Restore point: path-prod-participant-details-arrays-20260604144745
-- Purpose:
--   - Backfill Participant Details checkbox/list fields from the case's primary
--     application when the submitted application captured values but the
--     case_context_json Participant Details snapshot is blank or incomplete.
--   - Preserve existing Participant Details values and append missing
--     application values.
--   - Fill Other-barrier/support notes only where Participant Details is blank.

DELIMITER //

DROP PROCEDURE IF EXISTS prod_repair_participant_details_array_backfill_20260604//

CREATE PROCEDURE prod_repair_participant_details_array_backfill_20260604()
BEGIN
  DECLARE v_run_id VARCHAR(96) DEFAULT 'participant-details-array-backfill-20260604';
  DECLARE v_snapshot_id VARCHAR(128) DEFAULT 'path-prod-participant-details-arrays-20260604144745';
  DECLARE v_repaired_at DATETIME(3);
  DECLARE v_message VARCHAR(255);

  DECLARE v_distinct_cases INT DEFAULT 0;
  DECLARE v_array_total INT DEFAULT 0;
  DECLARE v_scalar_total INT DEFAULT 0;
  DECLARE v_childcare_count INT DEFAULT 0;
  DECLARE v_barrier_count INT DEFAULT 0;
  DECLARE v_transport_count INT DEFAULT 0;
  DECLARE v_support_count INT DEFAULT 0;
  DECLARE v_other_barrier_count INT DEFAULT 0;
  DECLARE v_other_support_count INT DEFAULT 0;

  DECLARE v_childcare_updated INT DEFAULT 0;
  DECLARE v_barrier_updated INT DEFAULT 0;
  DECLARE v_transport_updated INT DEFAULT 0;
  DECLARE v_support_updated INT DEFAULT 0;
  DECLARE v_other_barrier_updated INT DEFAULT 0;
  DECLARE v_other_support_updated INT DEFAULT 0;
  DECLARE v_event_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_repaired_at = UTC_TIMESTAMP(3);

  START TRANSACTION;

  DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_app_values;
  DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_values;
  DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_merged;
  DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_updates;
  DROP TEMPORARY TABLE IF EXISTS tmp_pd_scalar_updates;
  DROP TEMPORARY TABLE IF EXISTS tmp_pd_primary_application;
  DROP TEMPORARY TABLE IF EXISTS tmp_pd_updated_cases;

  CREATE TEMPORARY TABLE tmp_pd_primary_application AS
  SELECT c.id AS case_id,
         a.id AS application_id,
         s.id AS submission_id,
         c.case_number,
         CONCAT(COALESCE(cl.first_name, ''), ' ', COALESCE(cl.last_name, '')) AS client_name,
         s.intake_payload
    FROM iset_case c
    JOIN client cl ON cl.id = c.client_id
    JOIN iset_application a
      ON a.id = (
        SELECT a_case.id
          FROM iset_application a_case
         WHERE a_case.case_id = c.id
         ORDER BY CASE
                    WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a_case.status, ''))), '-', '_'), ' ', '_') IN
                         ('approved', 'completed', 'complete', 'rejected', 'declined', 'denied', 'withdrawn', 'cancelled', 'closed', 'archived')
                      OR REPLACE(REPLACE(LOWER(TRIM(COALESCE(a_case.lifecycle_status, ''))), '-', '_'), ' ', '_') IN ('closed', 'archived')
                    THEN 1 ELSE 0
                  END ASC,
                  COALESCE(a_case.updated_at, a_case.created_at) DESC,
                  a_case.id DESC
         LIMIT 1
      )
    JOIN iset_application_submission s ON s.id = a.submission_id;

  CREATE TEMPORARY TABLE tmp_pd_array_app_values (
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL,
    submission_id BIGINT UNSIGNED NOT NULL,
    case_number VARCHAR(32) NULL,
    client_name VARCHAR(260) NULL,
    field_key VARCHAR(64) NOT NULL,
    answer_key VARCHAR(64) NOT NULL,
    app_array JSON NOT NULL,
    current_array JSON NOT NULL,
    PRIMARY KEY (case_id, field_key)
  );

  INSERT INTO tmp_pd_array_app_values
  SELECT c.id, pa.application_id, pa.submission_id, c.case_number,
         pa.client_name,
         'employmentBarriers', 'barriers',
         JSON_EXTRACT(pa.intake_payload, '$.barriers'),
         CASE
           WHEN JSON_TYPE(JSON_EXTRACT(c.case_context_json, '$.employmentBarriers')) = 'ARRAY'
             THEN JSON_EXTRACT(c.case_context_json, '$.employmentBarriers')
           ELSE JSON_ARRAY()
         END
    FROM tmp_pd_primary_application pa
    JOIN iset_case c ON c.id = pa.case_id
   WHERE JSON_TYPE(JSON_EXTRACT(pa.intake_payload, '$.barriers')) = 'ARRAY'
     AND JSON_LENGTH(JSON_EXTRACT(pa.intake_payload, '$.barriers')) > 0;

  INSERT INTO tmp_pd_array_app_values
  SELECT c.id, pa.application_id, pa.submission_id, c.case_number,
         pa.client_name,
         'requestedSupports', 'requested-supports',
         JSON_EXTRACT(pa.intake_payload, '$."requested-supports"'),
         CASE
           WHEN JSON_TYPE(JSON_EXTRACT(c.case_context_json, '$.requestedSupports')) = 'ARRAY'
             THEN JSON_EXTRACT(c.case_context_json, '$.requestedSupports')
           ELSE JSON_ARRAY()
         END
    FROM tmp_pd_primary_application pa
    JOIN iset_case c ON c.id = pa.case_id
   WHERE JSON_TYPE(JSON_EXTRACT(pa.intake_payload, '$."requested-supports"')) = 'ARRAY'
     AND JSON_LENGTH(JSON_EXTRACT(pa.intake_payload, '$."requested-supports"')) > 0;

  INSERT INTO tmp_pd_array_app_values
  SELECT c.id, pa.application_id, pa.submission_id, c.case_number,
         pa.client_name,
         'childcareFunding', 'childcare-fuding-status',
         COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."childcare-fuding-status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare_fuding_status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare-funding-status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare_funding_status"')
         ),
         CASE
           WHEN JSON_TYPE(JSON_EXTRACT(c.case_context_json, '$.childcareFunding')) = 'ARRAY'
             THEN JSON_EXTRACT(c.case_context_json, '$.childcareFunding')
           ELSE JSON_ARRAY()
         END
    FROM tmp_pd_primary_application pa
    JOIN iset_case c ON c.id = pa.case_id
   WHERE JSON_TYPE(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."childcare-fuding-status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare_fuding_status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare-funding-status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare_funding_status"')
         )) = 'ARRAY'
     AND JSON_LENGTH(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."childcare-fuding-status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare_fuding_status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare-funding-status"'),
           JSON_EXTRACT(pa.intake_payload, '$."childcare_funding_status"')
         )) > 0;

  INSERT INTO tmp_pd_array_app_values
  SELECT c.id, pa.application_id, pa.submission_id, c.case_number,
         pa.client_name,
         'expensesTransport', 'expenses-transport',
         COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."expenses-transport"'),
           JSON_EXTRACT(pa.intake_payload, '$."expenses_transport"')
         ),
         CASE
           WHEN JSON_TYPE(JSON_EXTRACT(c.case_context_json, '$.expensesTransport')) = 'ARRAY'
             THEN JSON_EXTRACT(c.case_context_json, '$.expensesTransport')
           ELSE JSON_ARRAY()
         END
    FROM tmp_pd_primary_application pa
    JOIN iset_case c ON c.id = pa.case_id
   WHERE JSON_TYPE(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."expenses-transport"'),
           JSON_EXTRACT(pa.intake_payload, '$."expenses_transport"')
         )) = 'ARRAY'
     AND JSON_LENGTH(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."expenses-transport"'),
           JSON_EXTRACT(pa.intake_payload, '$."expenses_transport"')
         )) > 0;

  CREATE TEMPORARY TABLE tmp_pd_array_values (
    case_id BIGINT UNSIGNED NOT NULL,
    field_key VARCHAR(64) NOT NULL,
    source_order TINYINT UNSIGNED NOT NULL,
    value_order INT UNSIGNED NOT NULL,
    value VARCHAR(255) NOT NULL
  );

  INSERT INTO tmp_pd_array_values
  SELECT a.case_id, a.field_key, 0, jt.ord, TRIM(jt.value)
    FROM tmp_pd_array_app_values a
    JOIN JSON_TABLE(a.current_array, '$[*]' COLUMNS (
      ord FOR ORDINALITY,
      value VARCHAR(255) PATH '$'
    )) jt
   WHERE TRIM(jt.value) <> '';

  INSERT INTO tmp_pd_array_values
  SELECT a.case_id, a.field_key, 1, jt.ord, TRIM(jt.value)
    FROM tmp_pd_array_app_values a
    JOIN JSON_TABLE(a.app_array, '$[*]' COLUMNS (
      ord FOR ORDINALITY,
      value VARCHAR(255) PATH '$'
    )) jt
   WHERE TRIM(jt.value) <> '';

  CREATE TEMPORARY TABLE tmp_pd_array_merged AS
  SELECT case_id,
         field_key,
         JSON_EXTRACT(
           CONCAT('[', GROUP_CONCAT(JSON_QUOTE(value) ORDER BY first_source_order, first_value_order SEPARATOR ','), ']'),
           '$'
         ) AS merged_array
    FROM (
      SELECT case_id,
             field_key,
             value,
             MIN(source_order) AS first_source_order,
             MIN(CASE WHEN source_order = 0 THEN value_order ELSE 100000 + value_order END) AS first_value_order
        FROM tmp_pd_array_values
       GROUP BY case_id, field_key, value
    ) deduped
   GROUP BY case_id, field_key;

  CREATE TEMPORARY TABLE tmp_pd_array_updates AS
  SELECT a.case_id,
         a.application_id,
         a.submission_id,
         a.case_number,
         a.client_name,
         a.field_key,
         a.answer_key,
         a.current_array,
         a.app_array,
         m.merged_array
    FROM tmp_pd_array_app_values a
    JOIN tmp_pd_array_merged m
      ON m.case_id = a.case_id
     AND m.field_key = a.field_key
   WHERE NOT JSON_CONTAINS(a.current_array, a.app_array);

  CREATE TEMPORARY TABLE tmp_pd_scalar_updates (
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL,
    submission_id BIGINT UNSIGNED NOT NULL,
    case_number VARCHAR(32) NULL,
    client_name VARCHAR(260) NULL,
    field_key VARCHAR(64) NOT NULL,
    answer_key VARCHAR(64) NOT NULL,
    app_value TEXT NULL,
    current_value TEXT NULL,
    PRIMARY KEY (case_id, field_key)
  );

  INSERT INTO tmp_pd_scalar_updates
  SELECT c.id AS case_id,
         pa.application_id,
         pa.submission_id,
         c.case_number,
         pa.client_name,
         'otherBarrier' AS field_key,
         'other-barrier' AS answer_key,
         JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."other-barrier"'),
           JSON_EXTRACT(pa.intake_payload, '$."other_barrier"')
         )) AS app_value,
         JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(c.case_context_json, '$.otherBarrier'),
           JSON_EXTRACT(c.case_context_json, '$."other_barrier"')
         )) AS current_value
    FROM tmp_pd_primary_application pa
    JOIN iset_case c ON c.id = pa.case_id
   WHERE NULLIF(TRIM(JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."other-barrier"'),
           JSON_EXTRACT(pa.intake_payload, '$."other_barrier"')
         ))), '') IS NOT NULL
     AND NULLIF(TRIM(JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(c.case_context_json, '$.otherBarrier'),
           JSON_EXTRACT(c.case_context_json, '$."other_barrier"')
         ))), '') IS NULL;

  INSERT INTO tmp_pd_scalar_updates
  SELECT c.id AS case_id,
         pa.application_id,
         pa.submission_id,
         c.case_number,
         pa.client_name,
         'otherRequestedSupport' AS field_key,
         'other-requested-support' AS answer_key,
         JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."other-requested-support"'),
           JSON_EXTRACT(pa.intake_payload, '$."other_requested_support"')
         )) AS app_value,
         JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(c.case_context_json, '$.otherRequestedSupport'),
           JSON_EXTRACT(c.case_context_json, '$."other_requested_support"')
         )) AS current_value
    FROM tmp_pd_primary_application pa
    JOIN iset_case c ON c.id = pa.case_id
   WHERE NULLIF(TRIM(JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(pa.intake_payload, '$."other-requested-support"'),
           JSON_EXTRACT(pa.intake_payload, '$."other_requested_support"')
         ))), '') IS NOT NULL
     AND NULLIF(TRIM(JSON_UNQUOTE(COALESCE(
           JSON_EXTRACT(c.case_context_json, '$.otherRequestedSupport'),
           JSON_EXTRACT(c.case_context_json, '$."other_requested_support"')
         ))), '') IS NULL;

  SELECT COUNT(*) INTO v_array_total FROM tmp_pd_array_updates;
  SELECT COUNT(*) INTO v_scalar_total FROM tmp_pd_scalar_updates;

  SELECT COALESCE(SUM(field_key = 'childcareFunding'), 0),
         COALESCE(SUM(field_key = 'employmentBarriers'), 0),
         COALESCE(SUM(field_key = 'expensesTransport'), 0),
         COALESCE(SUM(field_key = 'requestedSupports'), 0)
    INTO v_childcare_count,
         v_barrier_count,
         v_transport_count,
         v_support_count
    FROM tmp_pd_array_updates;

  SELECT COALESCE(SUM(field_key = 'otherBarrier'), 0),
         COALESCE(SUM(field_key = 'otherRequestedSupport'), 0)
    INTO v_other_barrier_count,
         v_other_support_count
    FROM tmp_pd_scalar_updates;

  SELECT COUNT(DISTINCT case_id)
    INTO v_distinct_cases
    FROM (
      SELECT case_id FROM tmp_pd_array_updates
      UNION
      SELECT case_id FROM tmp_pd_scalar_updates
    ) candidate_cases;

  IF v_array_total <> 226
     OR v_scalar_total <> 12
     OR v_distinct_cases <> 90
     OR v_childcare_count <> 14
     OR v_barrier_count <> 88
     OR v_transport_count <> 37
     OR v_support_count <> 87
     OR v_other_barrier_count <> 3
     OR v_other_support_count <> 9 THEN
    SET v_message = CONCAT(
      'guard_failed_participant_details_array_backfill counts: array=',
      v_array_total,
      ', scalar=',
      v_scalar_total,
      ', cases=',
      v_distinct_cases
    );
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
  END IF;

  CREATE TEMPORARY TABLE tmp_pd_updated_cases (
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL,
    submission_id BIGINT UNSIGNED NOT NULL,
    case_number VARCHAR(32) NULL,
    client_name VARCHAR(260) NULL,
    PRIMARY KEY (case_id)
  );

  INSERT IGNORE INTO tmp_pd_updated_cases
  SELECT case_id, application_id, submission_id, case_number, client_name FROM tmp_pd_array_updates;

  INSERT IGNORE INTO tmp_pd_updated_cases
  SELECT case_id, application_id, submission_id, case_number, client_name FROM tmp_pd_scalar_updates;

  UPDATE iset_case c
  JOIN tmp_pd_array_updates u
    ON u.case_id = c.id
   AND u.field_key = 'employmentBarriers'
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             JSON_SET(
               COALESCE(c.case_context_json, JSON_OBJECT()),
               '$.applicationAnswers',
               COALESCE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers'), JSON_OBJECT())
             ),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.employmentBarriers',
           u.merged_array,
           '$.applicationAnswers.barriers',
           u.merged_array,
           '$.dataRepair.participantDetailsArrayBackfill20260604',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_snapshot_id,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'iset_application_submission.intake_payload via primary case application',
             'reason', 'Participant Details array/list answers did not pull through from submitted application checkbox/list values.',
             'mergePolicy', 'Preserved existing Participant Details values and appended missing application values.'
           )
         ),
         c.updated_at = v_repaired_at;

  SET v_barrier_updated = ROW_COUNT();

  UPDATE iset_case c
  JOIN tmp_pd_array_updates u
    ON u.case_id = c.id
   AND u.field_key = 'requestedSupports'
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             JSON_SET(
               COALESCE(c.case_context_json, JSON_OBJECT()),
               '$.applicationAnswers',
               COALESCE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers'), JSON_OBJECT())
             ),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.requestedSupports',
           u.merged_array,
           '$.applicationAnswers."requested-supports"',
           u.merged_array,
           '$.dataRepair.participantDetailsArrayBackfill20260604',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_snapshot_id,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'iset_application_submission.intake_payload via primary case application',
             'reason', 'Participant Details array/list answers did not pull through from submitted application checkbox/list values.',
             'mergePolicy', 'Preserved existing Participant Details values and appended missing application values.'
           )
         ),
         c.updated_at = v_repaired_at;

  SET v_support_updated = ROW_COUNT();

  UPDATE iset_case c
  JOIN tmp_pd_array_updates u
    ON u.case_id = c.id
   AND u.field_key = 'childcareFunding'
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             JSON_SET(
               COALESCE(c.case_context_json, JSON_OBJECT()),
               '$.applicationAnswers',
               COALESCE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers'), JSON_OBJECT())
             ),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.childcareFunding',
           u.merged_array,
           '$.applicationAnswers."childcare-fuding-status"',
           u.merged_array,
           '$.dataRepair.participantDetailsArrayBackfill20260604',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_snapshot_id,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'iset_application_submission.intake_payload via primary case application',
             'reason', 'Participant Details array/list answers did not pull through from submitted application checkbox/list values.',
             'mergePolicy', 'Preserved existing Participant Details values and appended missing application values.'
           )
         ),
         c.updated_at = v_repaired_at;

  SET v_childcare_updated = ROW_COUNT();

  UPDATE iset_case c
  JOIN tmp_pd_array_updates u
    ON u.case_id = c.id
   AND u.field_key = 'expensesTransport'
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             JSON_SET(
               COALESCE(c.case_context_json, JSON_OBJECT()),
               '$.applicationAnswers',
               COALESCE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers'), JSON_OBJECT())
             ),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.expensesTransport',
           u.merged_array,
           '$.applicationAnswers."expenses-transport"',
           u.merged_array,
           '$.dataRepair.participantDetailsArrayBackfill20260604',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_snapshot_id,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'iset_application_submission.intake_payload via primary case application',
             'reason', 'Participant Details array/list answers did not pull through from submitted application checkbox/list values.',
             'mergePolicy', 'Preserved existing Participant Details values and appended missing application values.'
           )
         ),
         c.updated_at = v_repaired_at;

  SET v_transport_updated = ROW_COUNT();

  UPDATE iset_case c
  JOIN tmp_pd_scalar_updates u
    ON u.case_id = c.id
   AND u.field_key = 'otherBarrier'
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             JSON_SET(
               COALESCE(c.case_context_json, JSON_OBJECT()),
               '$.applicationAnswers',
               COALESCE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers'), JSON_OBJECT())
             ),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.otherBarrier',
           u.app_value,
           '$.applicationAnswers."other-barrier"',
           u.app_value,
           '$.dataRepair.participantDetailsArrayBackfill20260604',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_snapshot_id,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'iset_application_submission.intake_payload via primary case application',
             'reason', 'Participant Details other-note text did not pull through from submitted application values.',
             'mergePolicy', 'Filled only blank Participant Details note fields.'
           )
         ),
         c.updated_at = v_repaired_at;

  SET v_other_barrier_updated = ROW_COUNT();

  UPDATE iset_case c
  JOIN tmp_pd_scalar_updates u
    ON u.case_id = c.id
   AND u.field_key = 'otherRequestedSupport'
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             JSON_SET(
               COALESCE(c.case_context_json, JSON_OBJECT()),
               '$.applicationAnswers',
               COALESCE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers'), JSON_OBJECT())
             ),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.otherRequestedSupport',
           u.app_value,
           '$.applicationAnswers."other-requested-support"',
           u.app_value,
           '$.dataRepair.participantDetailsArrayBackfill20260604',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_snapshot_id,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'iset_application_submission.intake_payload via primary case application',
             'reason', 'Participant Details other-note text did not pull through from submitted application values.',
             'mergePolicy', 'Filled only blank Participant Details note fields.'
           )
         ),
         c.updated_at = v_repaired_at;

  SET v_other_support_updated = ROW_COUNT();

  IF v_childcare_updated <> 14
     OR v_barrier_updated <> 88
     OR v_transport_updated <> 37
     OR v_support_updated <> 87
     OR v_other_barrier_updated <> 3
     OR v_other_support_updated <> 9 THEN
    SET v_message = CONCAT(
      'update_count_failed_participant_details_array_backfill barriers=',
      v_barrier_updated,
      ', supports=',
      v_support_updated,
      ', childcare=',
      v_childcare_updated,
      ', transport=',
      v_transport_updated,
      ', otherBarrier=',
      v_other_barrier_updated,
      ', otherSupport=',
      v_other_support_updated
    );
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    actor_staff_profile_id,
    actor_user_id,
    source_system
  )
  SELECT uc.case_id,
         'data_repair',
         'Participant Details application-answer pull-through repaired.',
         JSON_OBJECT(
           'runId', v_run_id,
           'snapshot_id', v_snapshot_id,
           'repaired_at_utc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
           'application_id', uc.application_id,
           'submission_id', uc.submission_id,
           'array_fields', (
             SELECT JSON_EXTRACT(
                      CONCAT('[', GROUP_CONCAT(JSON_QUOTE(au.field_key) ORDER BY au.field_key SEPARATOR ','), ']'),
                      '$'
                    )
               FROM tmp_pd_array_updates au
              WHERE au.case_id = uc.case_id
           ),
           'scalar_fields', (
             SELECT JSON_EXTRACT(
                      CONCAT('[', GROUP_CONCAT(JSON_QUOTE(su.field_key) ORDER BY su.field_key SEPARATOR ','), ']'),
                      '$'
                    )
               FROM tmp_pd_scalar_updates su
              WHERE su.case_id = uc.case_id
           ),
           'merge_policy', 'Preserved existing Participant Details values and appended missing application values; filled only blank Other-note fields.',
           'source', 'iset_application_submission.intake_payload via primary case application'
         ),
         v_repaired_at,
         NULL,
         NULL,
         'codex_prod_data_repair'
    FROM tmp_pd_updated_cases uc;

  SET v_event_count = ROW_COUNT();

  IF v_event_count <> 90 THEN
    SET v_message = CONCAT('case_event_count_failed_participant_details_array_backfill events=', v_event_count);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
  END IF;

  COMMIT;

  SELECT v_run_id AS run_id,
         v_snapshot_id AS restore_point,
         v_distinct_cases AS cases_repaired,
         v_array_total AS array_field_updates,
         v_scalar_total AS scalar_field_updates,
         v_event_count AS case_events_written;

  SELECT 'childcareFunding' AS field_key, v_childcare_updated AS rows_updated
  UNION ALL
  SELECT 'employmentBarriers', v_barrier_updated
  UNION ALL
  SELECT 'expensesTransport', v_transport_updated
  UNION ALL
  SELECT 'requestedSupports', v_support_updated
  UNION ALL
  SELECT 'otherBarrier', v_other_barrier_updated
  UNION ALL
  SELECT 'otherRequestedSupport', v_other_support_updated;
END//

CALL prod_repair_participant_details_array_backfill_20260604()//

DROP PROCEDURE IF EXISTS prod_repair_participant_details_array_backfill_20260604//

DELIMITER ;
