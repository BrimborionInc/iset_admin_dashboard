-- PROD preview for Participant Details array-field backfill.
-- Read-only. Shows application checkbox/list answers that are missing from
-- iset_case.case_context_json Participant Details snapshot fields.

DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_app_values;
DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_values;
DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_merged;
DROP TEMPORARY TABLE IF EXISTS tmp_pd_array_updates;
DROP TEMPORARY TABLE IF EXISTS tmp_pd_scalar_updates;
DROP TEMPORARY TABLE IF EXISTS tmp_pd_primary_application;

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

SELECT field_key,
       COUNT(*) AS case_field_updates,
       COUNT(DISTINCT case_id) AS cases,
       SUM(JSON_LENGTH(current_array)) AS current_values,
       SUM(JSON_LENGTH(app_array)) AS application_values,
       SUM(JSON_LENGTH(merged_array)) AS merged_values
  FROM tmp_pd_array_updates
 GROUP BY field_key
 ORDER BY field_key;

SELECT field_key,
       COUNT(*) AS scalar_updates,
       COUNT(DISTINCT case_id) AS cases
  FROM tmp_pd_scalar_updates
 GROUP BY field_key
 ORDER BY field_key;

SELECT COUNT(DISTINCT case_id) AS distinct_cases_to_update
  FROM (
    SELECT case_id FROM tmp_pd_array_updates
    UNION
    SELECT case_id FROM tmp_pd_scalar_updates
  ) cases;

SELECT case_number,
       client_name,
       field_key,
       current_array,
       app_array,
       merged_array
  FROM tmp_pd_array_updates
 ORDER BY case_number, field_key
 LIMIT 100;

SELECT case_number,
       client_name,
       field_key,
       current_value,
       app_value
  FROM tmp_pd_scalar_updates
 ORDER BY case_number, field_key
 LIMIT 100;
