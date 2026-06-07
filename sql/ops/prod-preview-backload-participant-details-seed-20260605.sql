-- PROD preview: seed blank Participant Details fields from historical/backloaded
-- action plan and intervention records.
--
-- Read-only. This mirrors the intended repair logic:
--   - only existing/backloaded action plans/interventions;
--   - only blank Participant Details fields, or legacy numeric code values;
--   - no overwrite of staff-entered Participant Details values.

DROP TEMPORARY TABLE IF EXISTS tmp_backload_plans;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_interventions;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_case_names;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_plan_sources;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_intervention_sources;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_barrier_values;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_barrier_arrays;
DROP TEMPORARY TABLE IF EXISTS tmp_backload_field_updates;

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
