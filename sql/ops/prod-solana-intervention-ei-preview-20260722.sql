-- Read-only preview for Solana Henderson's pending intervention-revision EI fallback.
-- Approved scope: case 41, action plan 23, draft intervention 301, proposal 363,
-- review workflow 40. The action plan's authoritative EIClaimant code 2 maps to
-- "EI Reach Back" while both pending-review metadata copies are blank.

SELECT
  c.id AS case_id,
  c.case_number,
  cl.first_name,
  cl.last_name,
  ap.id AS action_plan_id,
  ap.status AS action_plan_status,
  ap.funding_stream,
  ap.EIClaimant AS action_plan_ei_claimant,
  ci.id AS revision_intervention_id,
  ci.status AS revision_status,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.review.eiStatus')) AS intervention_ei_status,
  p.id AS proposal_id,
  p.proposal_kind,
  p.review_status AS proposal_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.review.eiStatus')) AS proposal_ei_status,
  rw.id AS review_workflow_id,
  rw.current_stage,
  rw.nwac_decision,
  rw.nwac_decided_by_staff_profile_id
FROM iset_case c
JOIN client cl ON cl.id = c.client_id
JOIN iset_case_action_plan ap ON ap.case_id = c.id
JOIN iset_case_intervention ci ON ci.case_id = c.id AND ci.action_plan_id = ap.id
JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
JOIN iset_review_workflow rw ON rw.proposal_id = p.id
WHERE c.id = 41
  AND c.case_number = 'CASE-2026-0000041'
  AND cl.id = 41
  AND cl.first_name = 'Solana'
  AND cl.last_name = 'Henderson'
  AND ap.id = 23
  AND ci.id = 301
  AND p.id = 363
  AND rw.id = 40;

SELECT
  CASE
    WHEN COUNT(*) = 1 THEN 'READY'
    ELSE 'BLOCKED'
  END AS repair_readiness,
  COUNT(*) AS exact_target_count
FROM iset_case c
JOIN client cl ON cl.id = c.client_id
JOIN iset_case_action_plan ap ON ap.case_id = c.id
JOIN iset_case_intervention ci ON ci.case_id = c.id AND ci.action_plan_id = ap.id
JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
JOIN iset_review_workflow rw ON rw.proposal_id = p.id
WHERE c.id = 41
  AND c.case_number = 'CASE-2026-0000041'
  AND cl.id = 41
  AND cl.first_name = 'Solana'
  AND cl.last_name = 'Henderson'
  AND ap.id = 23
  AND ap.status = 'active'
  AND ap.funding_stream = 'EI'
  AND ap.EIClaimant = 2
  AND ci.id = 301
  AND ci.status = 'submitted'
  AND NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.review.eiStatus'))), '') IS NULL
  AND p.id = 363
  AND p.proposal_kind = 'revision'
  AND p.review_status = 'submitted'
  AND NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.review.eiStatus'))), '') IS NULL
  AND rw.id = 40
  AND rw.workflow_type = 'intervention_revision'
  AND rw.current_stage = 'nwac_review'
  AND rw.nwac_decision IS NULL
  AND rw.nwac_decided_by_staff_profile_id IS NULL;
