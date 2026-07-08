-- Read-only preview for assigning Application 30 / case 112 to Derry Yellowfly.
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file sql/ops/prod-application-30-assign-derry-preview-20260708.sql

SELECT
  a.id AS application_id,
  c.id AS case_id,
  c.case_number,
  s.reference_number,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."first-name"')) AS first_name,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."last-name"')) AS last_name,
  JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."address-province"')) AS intake_province,
  c.assigned_staff_profile_id AS current_owner_id,
  current_owner.display_name AS current_owner_name,
  current_owner.email AS current_owner_email,
  c.portfolio_region_id,
  portfolio.code AS portfolio_region_code,
  derry.id AS target_owner_id,
  derry.display_name AS target_owner_name,
  derry.email AS target_owner_email,
  derry.region_id AS target_primary_region_id,
  derry_primary.code AS target_primary_region_code,
  rw.id AS review_workflow_id,
  rw.current_stage,
  rw.current_owner_role,
  rw.current_owner_staff_profile_id AS current_review_owner_id,
  review_owner.display_name AS current_review_owner_name,
  (
    SELECT COUNT(*)
      FROM iset_internal_notification n
     WHERE n.event_key = 'rm_review_requested'
       AND n.audience_staff_profile_id = derry.id
       AND JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.eventId')) = '337c8812-d895-407c-8cda-e4f6ff448563'
  ) AS existing_derry_notification_count
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
JOIN iset_application_submission s ON s.id = a.submission_id
LEFT JOIN staff_profiles current_owner ON current_owner.id = c.assigned_staff_profile_id
LEFT JOIN canada_region portfolio ON portfolio.region_id = c.portfolio_region_id
JOIN staff_profiles derry ON derry.id = 995581
LEFT JOIN canada_region derry_primary ON derry_primary.region_id = derry.region_id
LEFT JOIN iset_review_workflow rw
  ON rw.workflow_type = 'application_assessment'
 AND rw.application_id = a.id
 AND rw.archived_at IS NULL
LEFT JOIN staff_profiles review_owner ON review_owner.id = rw.current_owner_staff_profile_id
WHERE a.id = 30
  AND c.id = 112;

