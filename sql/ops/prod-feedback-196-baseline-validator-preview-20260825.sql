-- PROD READ-ONLY exact signed-baseline validator compatibility inventory for
-- feedback #196. The counts mirror assessSignedVersionBaseline without
-- returning case, version, participant, or snapshot values.
--
-- Exact PROD identity and full live DDL for every referenced table were
-- captured immediately before review of this artifact. This file contains no
-- mutation, lock, procedure, temporary object, PII field, or row identifier.

SELECT
  COUNT(`cfa_version`.`id`),
  SUM(JSON_TYPE(`cfa_version`.`metadata_json`) = 'OBJECT'),
  SUM(
    JSON_TYPE(`cfa_version`.`metadata_json`) = 'OBJECT'
    AND JSON_TYPE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case')) = 'OBJECT'
    AND COALESCE(
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0)
    ) = `cfa_series`.`case_id`
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) = `cfa_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) = `cfa_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) = `cfa_series`.`case_id`
    )
  ),
  SUM(
    `current_applicant_user`.`id` IS NOT NULL
    AND (
      (
        `cfa_version`.`signed_by_participant_id` IS NOT NULL
        AND `cfa_version`.`signed_by_participant_id` = `current_applicant_user`.`id`
      )
      OR (
        `cfa_version`.`signed_by_participant_id` IS NULL
        AND COALESCE(
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0),
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0)
        ) = `current_applicant_user`.`id`
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
      )
    )
  ),
  SUM(
    JSON_TYPE(`cfa_version`.`metadata_json`) = 'OBJECT'
    AND JSON_TYPE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case')) = 'OBJECT'
    AND COALESCE(
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0)
    ) = `cfa_series`.`case_id`
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) = `cfa_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) = `cfa_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) = `cfa_series`.`case_id`
    )
    AND `current_applicant_user`.`id` IS NOT NULL
    AND (
      (
        `cfa_version`.`signed_by_participant_id` IS NOT NULL
        AND `cfa_version`.`signed_by_participant_id` = `current_applicant_user`.`id`
      )
      OR (
        `cfa_version`.`signed_by_participant_id` IS NULL
        AND COALESCE(
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0),
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0)
        ) = `current_applicant_user`.`id`
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`cfa_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
      )
    )
  )
FROM `cfa_version`
JOIN `cfa_series`
  ON `cfa_series`.`id` = `cfa_version`.`series_id`
JOIN `iset_case`
  ON `iset_case`.`id` = `cfa_series`.`case_id`
LEFT JOIN `client`
  ON `client`.`id` = `iset_case`.`client_id`
LEFT JOIN `user` AS `current_applicant_user`
  ON `current_applicant_user`.`cognito_sub` = `client`.`applicant_cognito_sub`
WHERE `cfa_version`.`status` = 'signed'
  AND NOT EXISTS (
    SELECT 1
    FROM `cfa_version` AS `newer_cfa_version`
    WHERE `newer_cfa_version`.`series_id` = `cfa_version`.`series_id`
      AND `newer_cfa_version`.`status` = 'signed'
      AND `newer_cfa_version`.`version_number` > `cfa_version`.`version_number`
  );

SELECT
  COUNT(`funding_overview_version`.`id`),
  SUM(JSON_TYPE(`funding_overview_version`.`metadata_json`) = 'OBJECT'),
  SUM(
    JSON_TYPE(`funding_overview_version`.`metadata_json`) = 'OBJECT'
    AND JSON_TYPE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case')) = 'OBJECT'
    AND COALESCE(
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0)
    ) = `funding_overview_series`.`case_id`
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) = `funding_overview_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) = `funding_overview_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) = `funding_overview_series`.`case_id`
    )
  ),
  SUM(
    `current_applicant_user`.`id` IS NOT NULL
    AND (
      (
        `funding_overview_version`.`signed_by_participant_id` IS NOT NULL
        AND `funding_overview_version`.`signed_by_participant_id` = `current_applicant_user`.`id`
      )
      OR (
        `funding_overview_version`.`signed_by_participant_id` IS NULL
        AND COALESCE(
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0),
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0)
        ) = `current_applicant_user`.`id`
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
      )
    )
  ),
  SUM(
    JSON_TYPE(`funding_overview_version`.`metadata_json`) = 'OBJECT'
    AND JSON_TYPE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case')) = 'OBJECT'
    AND COALESCE(
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0),
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0)
    ) = `funding_overview_series`.`case_id`
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.id')) AS UNSIGNED), 0) = `funding_overview_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.caseId')) AS UNSIGNED), 0) = `funding_overview_series`.`case_id`
    )
    AND (
      NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) IS NULL
      OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.case_id')) AS UNSIGNED), 0) = `funding_overview_series`.`case_id`
    )
    AND `current_applicant_user`.`id` IS NOT NULL
    AND (
      (
        `funding_overview_version`.`signed_by_participant_id` IS NOT NULL
        AND `funding_overview_version`.`signed_by_participant_id` = `current_applicant_user`.`id`
      )
      OR (
        `funding_overview_version`.`signed_by_participant_id` IS NULL
        AND COALESCE(
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0),
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0)
        ) = `current_applicant_user`.`id`
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicantUserId')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
        AND (
          NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) IS NULL
          OR NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(`funding_overview_version`.`metadata_json`, '$.case.applicant_user_id')) AS UNSIGNED), 0) = `current_applicant_user`.`id`
        )
      )
    )
  )
FROM `funding_overview_version`
JOIN `funding_overview_series`
  ON `funding_overview_series`.`id` = `funding_overview_version`.`series_id`
JOIN `iset_case`
  ON `iset_case`.`id` = `funding_overview_series`.`case_id`
LEFT JOIN `client`
  ON `client`.`id` = `iset_case`.`client_id`
LEFT JOIN `user` AS `current_applicant_user`
  ON `current_applicant_user`.`cognito_sub` = `client`.`applicant_cognito_sub`
WHERE `funding_overview_version`.`status` = 'signed'
  AND NOT EXISTS (
    SELECT 1
    FROM `funding_overview_version` AS `newer_funding_overview_version`
    WHERE `newer_funding_overview_version`.`series_id` = `funding_overview_version`.`series_id`
      AND `newer_funding_overview_version`.`status` = 'signed'
      AND `newer_funding_overview_version`.`version_number` > `funding_overview_version`.`version_number`
  );
