-- PROD read-only preview: Shayleen McNabb ILMP safe repair.
-- Scope: no mutations. Shows only fields that can be repaired from unambiguous
-- application/participant/action-plan evidence.

SET @case_number := 'ISET-20260410-78062A';
SET @action_plan_id := 53;
SET @feedback_id := 137;

SELECT
  c.id AS case_id,
  c.case_number,
  CONCAT(cl.first_name, ' ', cl.last_name) AS client_name,
  sp.display_name AS case_manager,
  a.id AS application_id,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  ap.id AS action_plan_id,
  ap.status AS action_plan_status,
  ap.metadata_json AS action_plan_metadata,
  ap.effective_date AS current_plan_start,
  MIN(i.start_date) AS earliest_intervention_start
FROM iset_case c
JOIN client cl ON cl.id = c.client_id
LEFT JOIN staff_profiles sp ON sp.id = c.assigned_staff_profile_id
LEFT JOIN iset_application a ON a.case_id = c.id
LEFT JOIN iset_case_action_plan ap ON ap.case_id = c.id AND ap.id = @action_plan_id
LEFT JOIN iset_case_intervention i ON i.action_plan_id = ap.id
WHERE c.case_number = @case_number
GROUP BY
  c.id,
  c.case_number,
  cl.first_name,
  cl.last_name,
  sp.display_name,
  a.id,
  a.status,
  a.lifecycle_status,
  ap.id,
  ap.status,
  ap.metadata_json,
  ap.effective_date;

SELECT
  'case_context' AS target,
  field_name,
  current_value,
  source_value,
  proposed_value,
  repair_source,
  rationale
FROM (
  SELECT
    'maritalStatus' AS field_name,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.maritalStatus')) AS current_value,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."marital-status"')) AS source_value,
    'single' AS proposed_value,
    'applicationAnswers."marital-status"' AS repair_source,
    'Direct application answer; blank root Participant Details field.' AS rationale
  FROM iset_case c WHERE c.case_number = @case_number

  UNION ALL
  SELECT
    'dependentChildren',
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.dependentChildren')),
    CONCAT(
      'dependent-children=',
      JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."dependent-children"')),
      '; ages=',
      JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."ages-of-children"'))
    ),
    '2',
    'derived from application ages 14, 9',
    'Participant Details field is a numeric count; application yes/no must not be copied as count.'
  FROM iset_case c WHERE c.case_number = @case_number

  UNION ALL
  SELECT
    'agesOfChildren',
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.agesOfChildren')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."ages-of-children"')),
    '14, 9',
    'applicationAnswers."ages-of-children"',
    'Direct application answer; supports dependent-child count derivation.'
  FROM iset_case c WHERE c.case_number = @case_number

  UNION ALL
  SELECT
    'socialAssistance',
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.socialAssistance')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."social-assistance"')),
    'no',
    'applicationAnswers."social-assistance"',
    'Application answer 0 maps to Participant Details yes/no value no.'
  FROM iset_case c WHERE c.case_number = @case_number

  UNION ALL
  SELECT
    'employmentStatus',
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.employmentStatus')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."labour-force-status"')),
    'employed-full-time',
    'applicationAnswers."labour-force-status"',
    'Direct application answer; previous employment NOC remains unresolved.'
  FROM iset_case c WHERE c.case_number = @case_number

  UNION ALL
  SELECT
    'educationLevel',
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationLevel')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."highest-education"')),
    'bachelors_degree',
    'applicationAnswers."highest-education"',
    'Direct application answer displayed by Participant Details fallback.'
  FROM iset_case c WHERE c.case_number = @case_number

  UNION ALL
  SELECT
    'educationYear',
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationYear')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-year"')),
    '2019',
    'applicationAnswers."education-year"',
    'Direct application answer displayed by Participant Details fallback.'
  FROM iset_case c WHERE c.case_number = @case_number

  UNION ALL
  SELECT
    'educationProvince',
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationProvince')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-location"')),
    'sk',
    'applicationAnswers."education-location"',
    'Direct application answer displayed by Participant Details fallback.'
  FROM iset_case c WHERE c.case_number = @case_number
) preview_rows
WHERE current_value IS NULL OR current_value = '' OR current_value <> proposed_value
ORDER BY field_name;

SELECT
  'action_plan' AS target,
  field_name,
  current_value,
  source_value,
  proposed_value,
  repair_source,
  rationale
FROM (
  SELECT
    'effective_date' AS field_name,
    CAST(ap.effective_date AS CHAR) AS current_value,
    CAST(MIN(i.start_date) AS CHAR) AS source_value,
    '2026-04-21' AS proposed_value,
    'earliest linked intervention start date' AS repair_source,
    'Action plan must start on/before first intervention; current plan is one day late.' AS rationale
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  LEFT JOIN iset_case_intervention i ON i.action_plan_id = ap.id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id
  GROUP BY ap.effective_date

  UNION ALL
  SELECT
    'activated_at',
    CAST(ap.activated_at AS CHAR),
    CAST(MIN(i.start_date) AS CHAR),
    '2026-04-21 00:00:00',
    'earliest linked intervention start date',
    'Keep activation timestamp aligned with corrected backloaded plan start.'
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  LEFT JOIN iset_case_intervention i ON i.action_plan_id = ap.id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id
  GROUP BY ap.activated_at

  UNION ALL
  SELECT
    'esdc_action_plan_json.educationLevel',
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."highest-education"')),
    '10',
    'application highest-education bachelors_degree',
    'ILMP education code 10 = Bachelor degree.'
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id

  UNION ALL
  SELECT
    'esdc_action_plan_json.educationProvince',
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationProvince')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-location"')),
    '8',
    'application education-location sk',
    'ILMP province code 8 = Saskatchewan.'
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id

  UNION ALL
  SELECT
    'esdc_action_plan_json.socialAssistanceRecipient',
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.socialAssistanceRecipient')),
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."social-assistance"')),
    '0',
    'application social-assistance 0',
    'ILMP yes/no code 0 = No.'
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id
) preview_rows
WHERE current_value IS NULL OR current_value = '' OR current_value <> proposed_value
ORDER BY field_name;

SELECT
  'leave_for_case_manager' AS target,
  field_name,
  current_value,
  reason
FROM (
  SELECT
    'barrierToEmployment' AS field_name,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.BarrierToEmployment')) AS current_value,
    'Application barriers are blank and root Participant Details employmentBarriers is blank; do not infer Education from education-history fields.' AS reason
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id

  UNION ALL
  SELECT
    'EIClaimant',
    COALESCE(
      JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.EIClaimant')),
      CAST(ap.EIClaimant AS CHAR)
    ),
    'Action plan funding stream/agreement says EI/16535866, but claimant vs reach-back is not derivable from that alone.'
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id

  UNION ALL
  SELECT
    'previousEmploymentNocVersion',
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanPreviousEmploymentNocVersion')),
    'Application says employed full-time, so NOC/version is required if that intake status is correct; case manager must confirm/provide it.'
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id

  UNION ALL
  SELECT
    'previousEmploymentNoc',
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanPreviousEmploymentNoc')),
    'Application says employed full-time, so NOC/version is required if that intake status is correct; case manager must confirm/provide it.'
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE c.case_number = @case_number AND ap.id = @action_plan_id
) manager_rows
ORDER BY field_name;
