-- Preview iset_document scope gaps before any backfill.
-- Read-only. Emits IDs and candidate relationship IDs only; no names, file names, or file paths.

SELECT
  d.source,
  COUNT(*) AS documents,
  SUM(d.client_id IS NULL) AS missing_client_id,
  SUM(d.case_id IS NULL) AS missing_case_id,
  SUM(d.application_id IS NULL) AS missing_application_id,
  SUM(d.user_id IS NOT NULL AND u.id IS NULL) AS missing_user_target,
  SUM(
    d.client_id IS NULL
    AND COALESCE(
      c_from_case.client_id,
      a.client_id,
      c_from_message.client_id,
      a_from_message.client_id,
      client_from_applicant_sub.id,
      client_from_applicant_email.id
    ) IS NOT NULL
  ) AS client_id_backfillable,
  SUM(
    d.case_id IS NULL
    AND COALESCE(a.case_id, m.case_id, a_from_message.case_id, single_case.case_id) IS NOT NULL
  ) AS case_id_backfillable,
  SUM(
    d.application_id IS NULL
    AND COALESCE(m.application_id, c_from_case.application_id, single_application.application_id) IS NOT NULL
  ) AS application_id_backfillable
FROM iset_document d
LEFT JOIN `user` u ON u.id = d.user_id
LEFT JOIN `user` applicant_user ON applicant_user.id = d.applicant_user_id
LEFT JOIN client client_from_applicant_sub
  ON client_from_applicant_sub.applicant_cognito_sub = applicant_user.cognito_sub
LEFT JOIN client client_from_applicant_email
  ON LOWER(client_from_applicant_email.applicant_account_email) = LOWER(applicant_user.email)
LEFT JOIN iset_case c_from_case ON c_from_case.id = d.case_id
LEFT JOIN iset_application a ON a.id = d.application_id
LEFT JOIN messages m ON m.id = d.origin_message_id
LEFT JOIN iset_case c_from_message ON c_from_message.id = m.case_id
LEFT JOIN iset_application a_from_message ON a_from_message.id = m.application_id
LEFT JOIN (
  SELECT client_id, MIN(id) AS case_id, COUNT(*) AS case_count
  FROM iset_case
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) single_case
  ON single_case.client_id = COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  )
 AND single_case.case_count = 1
LEFT JOIN (
  SELECT client_id, MIN(id) AS application_id, COUNT(*) AS application_count
  FROM iset_application
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) single_application
  ON single_application.client_id = COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  )
 AND single_application.application_count = 1
GROUP BY d.source
ORDER BY d.source;

SELECT
  d.id AS document_id,
  d.source,
  d.client_id,
  COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  ) AS candidate_client_id,
  d.case_id,
  COALESCE(d.case_id, a.case_id, m.case_id, a_from_message.case_id, single_case.case_id) AS candidate_case_id,
  d.application_id,
  COALESCE(d.application_id, m.application_id, c_from_case.application_id, single_application.application_id) AS candidate_application_id,
  d.user_id,
  CASE WHEN d.user_id IS NOT NULL AND u.id IS NULL THEN 1 ELSE 0 END AS user_id_missing_target,
  d.applicant_user_id,
  d.origin_message_id,
  CASE
    WHEN d.client_id IS NULL
      AND COALESCE(
        c_from_case.client_id,
        a.client_id,
        c_from_message.client_id,
        a_from_message.client_id,
        client_from_applicant_sub.id,
        client_from_applicant_email.id
      ) IS NULL
      THEN 'missing_client_no_candidate'
    WHEN d.case_id IS NULL
      AND COALESCE(a.case_id, m.case_id, a_from_message.case_id, single_case.case_id) IS NULL
      THEN 'missing_case_no_candidate'
    WHEN d.application_id IS NULL
      AND d.source IN ('application_submission', 'secure_message_attachment')
      AND COALESCE(m.application_id, c_from_case.application_id, single_application.application_id) IS NULL
      THEN 'missing_application_no_candidate'
    WHEN d.user_id IS NOT NULL AND u.id IS NULL
      THEN 'user_id_missing_target'
    ELSE 'backfillable_or_scoped'
  END AS classification
FROM iset_document d
LEFT JOIN `user` u ON u.id = d.user_id
LEFT JOIN `user` applicant_user ON applicant_user.id = d.applicant_user_id
LEFT JOIN client client_from_applicant_sub
  ON client_from_applicant_sub.applicant_cognito_sub = applicant_user.cognito_sub
LEFT JOIN client client_from_applicant_email
  ON LOWER(client_from_applicant_email.applicant_account_email) = LOWER(applicant_user.email)
LEFT JOIN iset_case c_from_case ON c_from_case.id = d.case_id
LEFT JOIN iset_application a ON a.id = d.application_id
LEFT JOIN messages m ON m.id = d.origin_message_id
LEFT JOIN iset_case c_from_message ON c_from_message.id = m.case_id
LEFT JOIN iset_application a_from_message ON a_from_message.id = m.application_id
LEFT JOIN (
  SELECT client_id, MIN(id) AS case_id, COUNT(*) AS case_count
  FROM iset_case
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) single_case
  ON single_case.client_id = COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  )
 AND single_case.case_count = 1
LEFT JOIN (
  SELECT client_id, MIN(id) AS application_id, COUNT(*) AS application_count
  FROM iset_application
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) single_application
  ON single_application.client_id = COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  )
 AND single_application.application_count = 1
WHERE d.client_id IS NULL
   OR d.case_id IS NULL
   OR d.application_id IS NULL
   OR (d.user_id IS NOT NULL AND u.id IS NULL)
ORDER BY d.id
LIMIT 250;
