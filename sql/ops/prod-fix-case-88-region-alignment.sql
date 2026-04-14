-- PROD one-off correction prepared on 2026-04-14.
-- Purpose: realign case 88 / application 6 / client 97 from Nova Scotia to British Columbia
-- after manual intake stored conflicting province values across case, client, case-context, and
-- submission payload records.
--
-- Expected preflight before apply:
--   iset_case.id = 88
--   iset_case.application_id = 6
--   iset_case.client_id = 97
--   iset_case.portfolio_region_id = 7
--   client.address_json.address.city = Burns Lake
--   client.address_json.address.province = NS
--   iset_case.case_context_json.applicationAnswers."address-province" = ns
--   iset_case.case_context_json.applicationAnswers."education-location" = bc
--   iset_application_submission.id = 6
--   iset_application_submission.intake_payload."address-province" = ns
--   iset_application_submission.intake_payload."education-location" = bc

START TRANSACTION;

SELECT
  c.id AS case_id,
  c.application_id,
  c.client_id,
  c.portfolio_region_id,
  JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.city')) AS client_city,
  JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')) AS client_province,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."address-province"')) AS case_context_province,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-location"')) AS case_context_education_location,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."address-province"')) AS submission_province,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."education-location"')) AS submission_education_location
FROM iset_case c
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN iset_application a ON a.id = c.application_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
WHERE c.id = 88
FOR UPDATE;

UPDATE iset_case
SET portfolio_region_id = 2,
    updated_at = NOW()
WHERE id = 88
  AND application_id = 6
  AND client_id = 97
  AND portfolio_region_id = 7;

UPDATE client
SET address_json = JSON_SET(
      COALESCE(address_json, JSON_OBJECT()),
      '$.region.code', 'BC',
      '$.address.province', 'BC',
      '$.address.provinceCode', 'BC'
    ),
    updated_at = NOW()
WHERE id = 97
  AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(address_json, '$.address.city')), '')) = 'burns lake'
  AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(address_json, '$.address.province')), '')) = 'ns';

UPDATE iset_case
SET case_context_json = JSON_SET(
      COALESCE(case_context_json, JSON_OBJECT()),
      '$.applicationAnswers."address-province"', 'bc'
    ),
    updated_at = NOW()
WHERE id = 88
  AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.applicationAnswers."education-location"')), '')) = 'bc'
  AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.applicationAnswers."address-province"')), '')) = 'ns';

UPDATE iset_application_submission s
JOIN iset_application a ON a.submission_id = s.id
SET s.intake_payload = JSON_SET(
      COALESCE(s.intake_payload, JSON_OBJECT()),
      '$."address-province"', 'bc'
    ),
    s.updated_at = NOW()
WHERE a.id = 6
  AND s.id = 6
  AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."education-location"')), '')) = 'bc'
  AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."address-province"')), '')) = 'ns';

SELECT
  c.id AS case_id,
  c.application_id,
  c.client_id,
  c.portfolio_region_id,
  JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.region.code')) AS client_region_code,
  JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')) AS client_province,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."address-province"')) AS case_context_province,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-location"')) AS case_context_education_location,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."address-province"')) AS submission_province,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."education-location"')) AS submission_education_location
FROM iset_case c
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN iset_application a ON a.id = c.application_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
WHERE c.id = 88;

COMMIT;
