-- PROD guarded repair: seed blank Participant Details fields from historical/
-- backloaded action plan and intervention records.
--
-- Purpose:
--   - Fill Participant Details fields from already-saved existing/backloaded
--     action plan/intervention ILMP data.
--   - Only fill blank Participant Details fields, or legacy numeric code values.
--   - Preserve staff-entered Participant Details values.
--   - Keep row-level before/after audit for rollback.

DELIMITER //

DROP PROCEDURE IF EXISTS prod_repair_backload_participant_details_seed_20260605//

CREATE PROCEDURE prod_repair_backload_participant_details_seed_20260605()
BEGIN
DECLARE v_run_id VARCHAR(96) DEFAULT 'backload-participant-details-seed-20260605';
DECLARE v_repaired_at DATETIME(3);
DECLARE v_message VARCHAR(255);
DECLARE v_distinct_cases INT DEFAULT 0;
DECLARE v_field_updates INT DEFAULT 0;
DECLARE v_duplicate_field_candidates INT DEFAULT 0;
DECLARE v_existing_audit_rows INT DEFAULT 0;
DECLARE v_rows_updated INT DEFAULT 0;
DECLARE v_event_count INT DEFAULT 0;
DECLARE v_verify_mismatch INT DEFAULT 0;
DECLARE v_field_count INT DEFAULT 0;
DECLARE v_done TINYINT DEFAULT 0;
DECLARE v_case_id BIGINT UNSIGNED;
DECLARE v_field_key VARCHAR(64);
DECLARE v_new_value_json_text LONGTEXT;
DECLARE v_json_path VARCHAR(96);
DECLARE cur_updates CURSOR FOR
  SELECT case_id, field_key, CAST(new_value_json AS CHAR)
    FROM tmp_backload_field_updates
   ORDER BY case_id, field_key;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
DECLARE EXIT HANDLER FOR SQLEXCEPTION
BEGIN
  ROLLBACK;
  RESIGNAL;
END;

SET v_repaired_at = UTC_TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS prod_participant_details_backload_seed_audit_20260605 (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id VARCHAR(96) NOT NULL,
  case_id BIGINT UNSIGNED NOT NULL,
  case_number VARCHAR(64) NULL,
  participant VARCHAR(260) NULL,
  assigned_staff VARCHAR(255) NULL,
  fields_json JSON NOT NULL,
  source_action_plan_ids_json JSON NULL,
  source_intervention_ids_json JSON NULL,
  before_case_context_json JSON NULL,
  after_case_context_json JSON NULL,
  before_sha256 CHAR(64) NULL,
  after_sha256 CHAR(64) NULL,
  repaired_at DATETIME(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_run_case (run_id, case_id)
);

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_backload_plans;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_interventions;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_case_names;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_plan_sources;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_intervention_sources;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_barrier_values;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_barrier_arrays;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_field_updates;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_case_repair_summary;

CREATE TEMPORARY TABLE tmp_backload_plans AS
SELECT ap.*
  FROM iset_case_action_plan ap
 WHERE ap.archived_at IS NULL
   AND (
     LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')), '')) = 'manual_backload'
     OR LOWER(COALESCE(
       JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.entryMode')),
       JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.entry_mode')),
       ''
     )) IN ('existing', 'backload')
     OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.backloadMode')), '')) = 'true'
     OR EXISTS (
       SELECT 1
         FROM iset_case_intervention ci_linked
        WHERE ci_linked.action_plan_id = ap.id
          AND (
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ci_linked.metadata_json, '$.source')), '')) = 'manual_backload'
            OR LOWER(COALESCE(
              JSON_UNQUOTE(JSON_EXTRACT(ci_linked.metadata_json, '$.entryMode')),
              JSON_UNQUOTE(JSON_EXTRACT(ci_linked.metadata_json, '$.entry_mode')),
              ''
            )) IN ('existing', 'backload')
            OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ci_linked.metadata_json, '$.backloadMode')), '')) = 'true'
          )
     )
   );

CREATE TEMPORARY TABLE tmp_backload_interventions AS
SELECT ci.*
  FROM iset_case_intervention ci
 WHERE LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')), '')) = 'manual_backload'
    OR LOWER(COALESCE(
      JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')),
      JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entry_mode')),
      ''
    )) IN ('existing', 'backload')
    OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.backloadMode')), '')) = 'true';

CREATE TEMPORARY TABLE tmp_backload_case_names AS
SELECT
  c.id AS case_id,
  c.case_number,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ',
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationPersonal.first_name')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationPersonal.last_name')), '')
    )), ''),
    NULLIF(TRIM(CONCAT_WS(' ',
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationPersonal.firstName')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationPersonal.lastName')), '')
    )), ''),
    NULLIF(TRIM(CONCAT_WS(' ',
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.firstName')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.lastName')), '')
    )), ''),
    NULLIF(TRIM(CONCAT_WS(' ', NULLIF(cl.first_name, ''), NULLIF(cl.last_name, ''))), ''),
    c.case_number
  ) AS participant,
  COALESCE(sp.display_name, sp.name, sp.email, '') AS assigned_staff,
  c.case_context_json
FROM iset_case c
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN staff_profiles sp ON sp.id = c.assigned_staff_profile_id;

CREATE TEMPORARY TABLE tmp_backload_plan_sources AS
SELECT
  bp.case_id,
  bp.id AS action_plan_id,
  COALESCE(osp.display_name, osp.name, osp.email, '') AS owner_staff,
  NULLIF(NULLIF(TRIM(COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.employmentGoals')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.goalDescription')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.summary')),
    bp.notes
  )), ''), 'null') AS src_employment_goals,
  NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.educationLevel'))), ''), 'null') AS src_education_level,
  NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.educationProvince'))), ''), 'null') AS src_education_province,
  NULLIF(NULLIF(TRIM(COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.socialAssistanceRecipient')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.SocialAssistanceRecipient'))
  )), ''), 'null') AS src_social_assistance,
  NULLIF(NULLIF(TRIM(COALESCE(
    CAST(bp.EIClaimant AS CHAR),
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.EIClaimant'))
  )), ''), 'null') AS src_ei_claimant,
  NULLIF(NULLIF(TRIM(COALESCE(
    CAST(bp.prev_employment AS CHAR),
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.actionPlanPreviousEmployment'))
  )), ''), 'null') AS src_prev_employment,
  NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.actionPlanPreviousEmploymentScheduleType'))), ''), 'null') AS src_prev_employment_schedule,
  NULLIF(NULLIF(TRIM(COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.actionPlanChildcareNeed')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.actionPlanChildCareNeed'))
  )), ''), 'null') AS src_childcare_need,
  NULLIF(NULLIF(TRIM(COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.actionPlanChildcareFundedCode')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.esdc_action_plan_json, '$.actionPlanChildCareFundedCode'))
  )), ''), 'null') AS src_childcare_funding,
  JSON_EXTRACT(bp.esdc_action_plan_json, '$.BarrierToEmployment') AS src_barriers_json,
  COALESCE(JSON_LENGTH(JSON_EXTRACT(bp.esdc_action_plan_json, '$.BarrierToEmployment')), 0) AS src_barrier_count,
  NULLIF(NULLIF(TRIM(COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.otherBarrier')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.other_barrier')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.otherBarrierDetails')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.other_barrier_details')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.employmentBarriersOtherDetails')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.employment_barriers_other_details')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.barriersOtherDetails')),
    JSON_UNQUOTE(JSON_EXTRACT(bp.metadata_json, '$.barriers_other_details'))
  )), ''), 'null') AS src_other_barrier_notes
FROM tmp_backload_plans bp
LEFT JOIN staff_profiles osp ON osp.id = bp.owner_staff_profile_id;

CREATE TEMPORARY TABLE tmp_backload_intervention_sources AS
SELECT
  bi.case_id,
  bi.id AS intervention_id,
  NULLIF(NULLIF(TRIM(COALESCE(
    bi.related_noc,
    JSON_UNQUOTE(JSON_EXTRACT(bi.esdc_intervention_json, '$.interventionRelatedNOC')),
    JSON_UNQUOTE(JSON_EXTRACT(bi.metadata_json, '$.noc'))
  )), ''), 'null') AS src_program_noc,
  NULLIF(NULLIF(TRIM(COALESCE(
    bi.related_noc_version,
    JSON_UNQUOTE(JSON_EXTRACT(bi.esdc_intervention_json, '$.interventionRelatedNOCVersion')),
    JSON_UNQUOTE(JSON_EXTRACT(bi.metadata_json, '$.nocVersion'))
  )), ''), 'null') AS src_program_noc_version
FROM tmp_backload_interventions bi;

CREATE TEMPORARY TABLE tmp_backload_barrier_values AS
SELECT
  ps.case_id,
  ps.action_plan_id,
  jt.ord,
  CASE TRIM(jt.code)
    WHEN '1' THEN 'none'
    WHEN '2' THEN 'lack-of-labour-force-attachment'
    WHEN '3' THEN 'lack-of-work-experience'
    WHEN '4' THEN 'lack-of-transportation'
    WHEN '5' THEN 'location'
    WHEN '6' THEN 'language'
    WHEN '7' THEN 'education'
    WHEN '8' THEN 'funding'
    WHEN '9' THEN 'dependent-care'
    WHEN '10' THEN 'lack-of-job-opportunities'
    WHEN '11' THEN 'physical-or-mental-health'
    WHEN '12' THEN 'other'
    ELSE NULL
  END AS mapped_value
FROM tmp_backload_plan_sources ps
JOIN JSON_TABLE(ps.src_barriers_json, '$[*]' COLUMNS (
  ord FOR ORDINALITY,
  code VARCHAR(16) PATH '$'
)) jt
WHERE ps.src_barrier_count > 0;

CREATE TEMPORARY TABLE tmp_backload_barrier_arrays AS
SELECT
  case_id,
  action_plan_id,
  JSON_EXTRACT(
    CONCAT('[', GROUP_CONCAT(JSON_QUOTE(mapped_value) ORDER BY first_ord SEPARATOR ','), ']'),
    '$'
  ) AS new_value_json,
  MAX(mapped_value = 'other') AS has_other
FROM (
  SELECT case_id,
         action_plan_id,
         mapped_value,
         MIN(ord) AS first_ord
    FROM tmp_backload_barrier_values
   WHERE mapped_value IS NOT NULL
   GROUP BY case_id, action_plan_id, mapped_value
) deduped
GROUP BY case_id, action_plan_id;

CREATE TEMPORARY TABLE tmp_backload_field_updates (
  case_id BIGINT UNSIGNED NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  field_label VARCHAR(128) NOT NULL,
  action_plan_id BIGINT UNSIGNED NULL,
  intervention_id BIGINT UNSIGNED NULL,
  owner_staff VARCHAR(255) NULL,
  new_value_json JSON NOT NULL,
  KEY idx_case (case_id),
  KEY idx_field (field_key)
);

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'employmentGoals', 'employment goals', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(ps.src_employment_goals) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE ps.src_employment_goals IS NOT NULL
  AND NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.employmentGoals'))), ''), 'null') IS NULL;

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'educationLevel', 'education level', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(CASE ps.src_education_level
         WHEN '1' THEN 'no_formal_education'
         WHEN '2' THEN 'grade_7_8'
         WHEN '3' THEN 'grade_9_10'
         WHEN '4' THEN 'grade_11_12'
         WHEN '5' THEN 'secondary_school_diploma_or_ged'
         WHEN '6' THEN 'post_secondary_training'
         WHEN '7' THEN 'apprenticeship_trades'
         WHEN '8' THEN 'college'
         WHEN '9' THEN 'university_certificate'
         WHEN '10' THEN 'bachelors_degree'
         WHEN '11' THEN 'masters_degree'
         WHEN '12' THEN 'doctorate'
         ELSE ps.src_education_level
       END) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE ps.src_education_level IS NOT NULL
  AND (
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.educationLevel'))), ''), 'null') IS NULL
    OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.educationLevel'))), ''), 'null') IN ('1','2','3','4','5','6','7','8','9','10','11','12')
  );

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'educationProvince', 'education province', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(CASE ps.src_education_province
         WHEN '1' THEN 'nl'
         WHEN '2' THEN 'ns'
         WHEN '3' THEN 'nb'
         WHEN '4' THEN 'pe'
         WHEN '5' THEN 'qc'
         WHEN '6' THEN 'on'
         WHEN '7' THEN 'mb'
         WHEN '8' THEN 'sk'
         WHEN '9' THEN 'ab'
         WHEN '10' THEN 'nt'
         WHEN '11' THEN 'bc'
         WHEN '12' THEN 'yt'
         WHEN '13' THEN 'other'
         WHEN '14' THEN 'other'
         WHEN '16' THEN 'nu'
         ELSE LOWER(ps.src_education_province)
       END) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE ps.src_education_province IS NOT NULL
  AND (
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.educationProvince'))), ''), 'null') IS NULL
    OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.educationProvince'))), ''), 'null') IN ('1','2','3','4','5','6','7','8','9','10','11','12','13','14','16')
  );

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'socialAssistance', 'social assistance', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(CASE LOWER(ps.src_social_assistance)
         WHEN '1' THEN 'yes'
         WHEN 'yes' THEN 'yes'
         WHEN 'true' THEN 'yes'
         WHEN 'y' THEN 'yes'
         WHEN '0' THEN 'no'
         WHEN 'no' THEN 'no'
         WHEN 'false' THEN 'no'
         WHEN 'n' THEN 'no'
         ELSE NULL
       END) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE LOWER(ps.src_social_assistance) IN ('1','yes','true','y','0','no','false','n')
  AND (
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.socialAssistance'))), ''), 'null') IS NULL
    OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.socialAssistance'))), ''), 'null') IN ('0','1')
  );

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'eiClaimant', 'EI claimant', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(ps.src_ei_claimant) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE ps.src_ei_claimant IS NOT NULL
  AND NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.eiClaimant'))), ''), 'null') IS NULL;

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'employmentInsurance', 'employment insurance', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(CASE ps.src_ei_claimant
         WHEN '1' THEN 'yes'
         WHEN '2' THEN 'yes'
         WHEN '3' THEN 'no'
         ELSE NULL
       END) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE ps.src_ei_claimant IN ('1','2','3')
  AND (
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.employmentInsurance'))), ''), 'null') IS NULL
    OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.employmentInsurance'))), ''), 'null') IN ('0','1')
  );

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'employmentStatus', 'employment status', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(CASE
         WHEN ps.src_prev_employment = '1' THEN 'unemployed'
         WHEN ps.src_prev_employment = '9' THEN 'student'
         WHEN ps.src_prev_employment = '2' AND ps.src_prev_employment_schedule = '1' THEN 'employed-full-time'
         WHEN ps.src_prev_employment = '2' AND ps.src_prev_employment_schedule = '2' THEN 'employed-part-time'
         ELSE NULL
       END) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE (
    ps.src_prev_employment IN ('1','9')
    OR (ps.src_prev_employment = '2' AND ps.src_prev_employment_schedule IN ('1','2'))
  )
  AND (
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.employmentStatus'))), ''), 'null') IS NULL
    OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.employmentStatus'))), ''), 'null') IN ('1','2','9')
  );

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'childcareNeed', 'childcare need', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(CASE LOWER(ps.src_childcare_need)
         WHEN '1' THEN 'yes'
         WHEN 'yes' THEN 'yes'
         WHEN 'true' THEN 'yes'
         WHEN 'y' THEN 'yes'
         WHEN '0' THEN 'no'
         WHEN 'no' THEN 'no'
         WHEN 'false' THEN 'no'
         WHEN 'n' THEN 'no'
         ELSE NULL
       END) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE LOWER(ps.src_childcare_need) IN ('1','yes','true','y','0','no','false','n')
  AND (
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.childcareNeed'))), ''), 'null') IS NULL
    OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.childcareNeed'))), ''), 'null') IN ('0','1')
  );

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'childcareFunding', 'childcare funding', ps.action_plan_id, NULL, ps.owner_staff,
       JSON_EXTRACT(CONCAT('[', JSON_QUOTE(CASE ps.src_childcare_funding
         WHEN '2' THEN 'fnicci'
         WHEN '3' THEN 'ei-crf'
         WHEN '4' THEN 'provincial-funding-subsidy'
         WHEN '5' THEN 'no-funding-received'
         WHEN '6' THEN 'daycare-not-available'
         WHEN '7' THEN 'assisted-by-family'
         ELSE NULL
       END), ']'), '$')
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE ps.src_childcare_funding IN ('2','3','4','5','6','7')
  AND (
    JSON_EXTRACT(cn.case_context_json, '$.childcareFunding') IS NULL
    OR JSON_TYPE(JSON_EXTRACT(cn.case_context_json, '$.childcareFunding')) = 'NULL'
    OR (JSON_TYPE(JSON_EXTRACT(cn.case_context_json, '$.childcareFunding')) = 'ARRAY' AND JSON_LENGTH(JSON_EXTRACT(cn.case_context_json, '$.childcareFunding')) = 0)
    OR REGEXP_REPLACE(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.childcareFunding')), '[\\[\\]\" ,]', '') REGEXP '^[0-9]+$'
  );

INSERT INTO tmp_backload_field_updates
SELECT ba.case_id, 'employmentBarriers', 'barriers to employment', ba.action_plan_id, NULL, ps.owner_staff,
       ba.new_value_json
FROM tmp_backload_barrier_arrays ba
JOIN tmp_backload_plan_sources ps ON ps.case_id = ba.case_id AND ps.action_plan_id = ba.action_plan_id
JOIN tmp_backload_case_names cn ON cn.case_id = ba.case_id
WHERE (
    JSON_EXTRACT(cn.case_context_json, '$.employmentBarriers') IS NULL
    OR JSON_TYPE(JSON_EXTRACT(cn.case_context_json, '$.employmentBarriers')) = 'NULL'
    OR (JSON_TYPE(JSON_EXTRACT(cn.case_context_json, '$.employmentBarriers')) = 'ARRAY' AND JSON_LENGTH(JSON_EXTRACT(cn.case_context_json, '$.employmentBarriers')) = 0)
    OR REGEXP_REPLACE(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.employmentBarriers')), '[\\[\\]\" ,]', '') REGEXP '^[0-9]+$'
  );

INSERT INTO tmp_backload_field_updates
SELECT ps.case_id, 'otherBarrier', 'other barrier notes', ps.action_plan_id, NULL, ps.owner_staff,
       CAST(JSON_QUOTE(ps.src_other_barrier_notes) AS JSON)
FROM tmp_backload_plan_sources ps
JOIN tmp_backload_barrier_arrays ba ON ba.case_id = ps.case_id AND ba.action_plan_id = ps.action_plan_id
JOIN tmp_backload_case_names cn ON cn.case_id = ps.case_id
WHERE ba.has_other = 1
  AND ps.src_other_barrier_notes IS NOT NULL
  AND NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.otherBarrier'))), ''), 'null') IS NULL;

INSERT INTO tmp_backload_field_updates
SELECT src.case_id, 'programNoc', 'program NOC', NULL, src.intervention_id, NULL,
       CAST(JSON_QUOTE(src.src_program_noc) AS JSON)
FROM tmp_backload_intervention_sources src
JOIN tmp_backload_case_names cn ON cn.case_id = src.case_id
WHERE src.src_program_noc IS NOT NULL
  AND NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.programNoc'))), ''), 'null') IS NULL;

INSERT INTO tmp_backload_field_updates
SELECT src.case_id, 'programNocVersion', 'program NOC version', NULL, src.intervention_id, NULL,
       CAST(JSON_QUOTE(src.src_program_noc_version) AS JSON)
FROM tmp_backload_intervention_sources src
JOIN tmp_backload_case_names cn ON cn.case_id = src.case_id
WHERE src.src_program_noc_version IS NOT NULL
  AND NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cn.case_context_json, '$.programNocVersion'))), ''), 'null') IS NULL;

SELECT
  COUNT(DISTINCT case_id) AS affected_cases,
  COUNT(*) AS field_updates
FROM tmp_backload_field_updates;

SELECT field_key, field_label, COUNT(DISTINCT case_id) AS affected_cases
FROM tmp_backload_field_updates
GROUP BY field_key, field_label
ORDER BY field_key;

SELECT
  cn.participant,
  cn.case_number,
  cn.assigned_staff,
  COALESCE(NULLIF(GROUP_CONCAT(DISTINCT u.owner_staff ORDER BY u.owner_staff SEPARATOR ', '), ''), '') AS action_plan_owner,
  GROUP_CONCAT(DISTINCT u.field_label ORDER BY u.field_label SEPARATOR ', ') AS fields_to_repair,
  GROUP_CONCAT(DISTINCT u.action_plan_id ORDER BY u.action_plan_id SEPARATOR ', ') AS action_plan_ids,
  GROUP_CONCAT(DISTINCT u.intervention_id ORDER BY u.intervention_id SEPARATOR ', ') AS intervention_ids
FROM tmp_backload_field_updates u
JOIN tmp_backload_case_names cn ON cn.case_id = u.case_id
GROUP BY cn.case_id, cn.participant, cn.case_number, cn.assigned_staff
ORDER BY cn.participant, cn.case_number;

SELECT COUNT(DISTINCT case_id), COUNT(*)
  INTO v_distinct_cases, v_field_updates
  FROM tmp_backload_field_updates;

SELECT COUNT(*)
  INTO v_duplicate_field_candidates
  FROM (
    SELECT case_id, field_key
      FROM tmp_backload_field_updates
     GROUP BY case_id, field_key
    HAVING COUNT(*) > 1
  ) dupes;

SELECT COUNT(*)
  INTO v_existing_audit_rows
  FROM prod_participant_details_backload_seed_audit_20260605
 WHERE run_id = v_run_id;

IF v_existing_audit_rows <> 0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed audit rows already exist for run id';
END IF;

IF v_distinct_cases <> 30 OR v_field_updates <> 229 OR v_duplicate_field_candidates <> 0 THEN
  SET v_message = CONCAT(
    'guard_failed_backload_pd_seed cases=',
    v_distinct_cases,
    ', fields=',
    v_field_updates,
    ', duplicateCaseFields=',
    v_duplicate_field_candidates
  );
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
END IF;

SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'childcareNeed';
IF v_field_count <> 20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed childcareNeed count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'educationLevel';
IF v_field_count <> 21 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed educationLevel count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'educationProvince';
IF v_field_count <> 21 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed educationProvince count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'eiClaimant';
IF v_field_count <> 30 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed eiClaimant count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'employmentBarriers';
IF v_field_count <> 16 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed employmentBarriers count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'employmentGoals';
IF v_field_count <> 19 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed employmentGoals count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'employmentInsurance';
IF v_field_count <> 21 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed employmentInsurance count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'employmentStatus';
IF v_field_count <> 20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed employmentStatus count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'programNoc';
IF v_field_count <> 28 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed programNoc count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'programNocVersion';
IF v_field_count <> 28 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed programNocVersion count'; END IF;
SELECT COUNT(*) INTO v_field_count FROM tmp_backload_field_updates WHERE field_key = 'socialAssistance';
IF v_field_count <> 5 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed socialAssistance count'; END IF;

CREATE TEMPORARY TABLE tmp_backload_case_repair_summary AS
SELECT
  case_id,
  JSON_EXTRACT(
    CONCAT('[', GROUP_CONCAT(DISTINCT JSON_QUOTE(field_key) ORDER BY field_key SEPARATOR ','), ']'),
    '$'
  ) AS fields_json,
  JSON_EXTRACT(
    CONCAT('[', GROUP_CONCAT(DISTINCT JSON_QUOTE(field_label) ORDER BY field_label SEPARATOR ','), ']'),
    '$'
  ) AS field_labels_json,
  COALESCE(
    JSON_EXTRACT(
      CONCAT('[', GROUP_CONCAT(DISTINCT action_plan_id ORDER BY action_plan_id SEPARATOR ','), ']'),
      '$'
    ),
    JSON_ARRAY()
  ) AS source_action_plan_ids_json,
  COALESCE(
    JSON_EXTRACT(
      CONCAT('[', GROUP_CONCAT(DISTINCT intervention_id ORDER BY intervention_id SEPARATOR ','), ']'),
      '$'
    ),
    JSON_ARRAY()
  ) AS source_intervention_ids_json
FROM tmp_backload_field_updates
GROUP BY case_id;

INSERT INTO prod_participant_details_backload_seed_audit_20260605 (
  run_id,
  case_id,
  case_number,
  participant,
  assigned_staff,
  fields_json,
  source_action_plan_ids_json,
  source_intervention_ids_json,
  before_case_context_json,
  before_sha256,
  repaired_at
)
SELECT
  v_run_id,
  cn.case_id,
  cn.case_number,
  cn.participant,
  cn.assigned_staff,
  summary.fields_json,
  summary.source_action_plan_ids_json,
  summary.source_intervention_ids_json,
  c.case_context_json,
  SHA2(COALESCE(CAST(c.case_context_json AS CHAR), ''), 256),
  v_repaired_at
FROM tmp_backload_case_repair_summary summary
JOIN tmp_backload_case_names cn ON cn.case_id = summary.case_id
JOIN iset_case c ON c.id = cn.case_id;

IF ROW_COUNT() <> 30 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_backload_pd_seed audit insert count';
END IF;

OPEN cur_updates;
update_loop: LOOP
  FETCH cur_updates INTO v_case_id, v_field_key, v_new_value_json_text;
  IF v_done = 1 THEN
    LEAVE update_loop;
  END IF;

  SET v_json_path = CONCAT('$.', v_field_key);

  UPDATE iset_case c
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             COALESCE(c.case_context_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           v_json_path,
           JSON_EXTRACT(v_new_value_json_text, '$'),
           '$.dataRepair.backloadParticipantDetailsSeed20260605',
           JSON_OBJECT(
             'runId', v_run_id,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'Historical/backloaded action plan and intervention ILMP data already saved in PATH.',
             'reason', 'Participant Details was missing fields that were captured on existing/backloaded action plans or interventions.',
             'mergePolicy', 'Filled only blank Participant Details fields or legacy numeric code values; staff-entered values were preserved.'
           )
         ),
         c.updated_at = v_repaired_at
   WHERE c.id = v_case_id;

  SET v_rows_updated = v_rows_updated + ROW_COUNT();
END LOOP;
CLOSE cur_updates;

IF v_rows_updated <> 229 THEN
  SET v_message = CONCAT('guard_failed_backload_pd_seed update count=', v_rows_updated);
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
END IF;

SELECT COUNT(*)
  INTO v_verify_mismatch
  FROM tmp_backload_field_updates u
  JOIN iset_case c ON c.id = u.case_id
 WHERE CAST(JSON_EXTRACT(c.case_context_json, CONCAT('$.', u.field_key)) AS CHAR) <> CAST(u.new_value_json AS CHAR);

IF v_verify_mismatch <> 0 THEN
  SET v_message = CONCAT('guard_failed_backload_pd_seed verify mismatches=', v_verify_mismatch);
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
END IF;

UPDATE prod_participant_details_backload_seed_audit_20260605 audit
JOIN iset_case c ON c.id = audit.case_id
   SET audit.after_case_context_json = c.case_context_json,
       audit.after_sha256 = SHA2(COALESCE(CAST(c.case_context_json AS CHAR), ''), 256)
 WHERE audit.run_id = v_run_id;

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
SELECT
  cn.case_id,
  'data_repair',
  'Seeded Participant Details from historical action plan/intervention data.',
  JSON_OBJECT(
    'runId', v_run_id,
    'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
    'fields', summary.field_labels_json,
    'sourceActionPlanIds', summary.source_action_plan_ids_json,
    'sourceInterventionIds', summary.source_intervention_ids_json,
    'reason', 'Participant Details was missing fields already captured on historical/backloaded action plans or interventions.',
    'mergePolicy', 'Filled blank Participant Details fields or legacy numeric code values only; staff-entered values were preserved.',
    'auditTable', 'prod_participant_details_backload_seed_audit_20260605'
  ),
  v_repaired_at,
  NULL,
  NULL,
  'codex'
FROM tmp_backload_case_repair_summary summary
JOIN tmp_backload_case_names cn ON cn.case_id = summary.case_id;

SET v_event_count = ROW_COUNT();
IF v_event_count <> 30 THEN
  SET v_message = CONCAT('guard_failed_backload_pd_seed event count=', v_event_count);
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
END IF;

COMMIT;

SELECT
  v_run_id AS run_id,
  v_distinct_cases AS affected_cases,
  v_field_updates AS field_updates,
  v_rows_updated AS field_updates_applied,
  v_event_count AS case_events_inserted,
  v_verify_mismatch AS verify_mismatches;

SELECT
  audit.participant,
  audit.case_number,
  audit.assigned_staff,
  JSON_UNQUOTE(JSON_EXTRACT(audit.fields_json, '$')) AS field_keys,
  audit.before_sha256,
  audit.after_sha256
FROM prod_participant_details_backload_seed_audit_20260605 audit
WHERE audit.run_id = v_run_id
ORDER BY audit.participant, audit.case_number;
END//

CALL prod_repair_backload_participant_details_seed_20260605()//

DROP PROCEDURE IF EXISTS prod_repair_backload_participant_details_seed_20260605//

DELIMITER ;
