-- Read-only preview for the complete Solana Henderson Case 41 fiscal-period repair.
--
-- Confirmed business facts:
--   * Funding agreement 16535866 runs 2026-01-05 through 2026-06-19.
--   * The 2025-26 plan/intervention period ends 2026-03-31.
--   * The prior plan result is code 4, Returned to school.
--   * The 2026-27 renewal plan/intervention period begins 2026-04-01.
--   * The renewal is EI Reach Back (EIClaimant code 2).
--   * The renewal intervention completed 2026-06-19 with outcome code 1
--     and verified actual amount $3,077.21.
--
-- The apply is intentionally blocked unless the complete known patchwork is
-- still present exactly as reviewed.

SELECT
  c.id AS case_id,
  c.case_number,
  cl.first_name,
  cl.last_name,
  c.status AS case_status,
  c.lifecycle_status,
  c.open_intervention_count,
  c.total_intervention_count,
  sp.email AS case_owner
FROM iset_case c
JOIN client cl ON cl.id = c.client_id
LEFT JOIN staff_profiles sp ON sp.id = c.assigned_staff_profile_id
WHERE c.id = 41;

SELECT
  ap.id AS action_plan_id,
  ap.name,
  ap.status,
  ap.agreement_number,
  ap.budget_pot,
  ap.funding_stream,
  ap.EIClaimant,
  ap.effective_date,
  ap.activated_at,
  ap.closed_at,
  ap.result_code,
  ap.result_date,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel'))
    AS result_education_level,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanFutureEducationLevel'))
    AS future_education_level,
  JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) AS source,
  ap.updated_at
FROM iset_case_action_plan ap
WHERE ap.case_id = 41
ORDER BY ap.effective_date, ap.id;

SELECT
  ci.id AS intervention_id,
  ci.action_plan_id,
  ci.status,
  ci.delivery_status,
  ci.start_date,
  ci.end_date,
  ci.intervention_cost,
  ci.budget_amount,
  ci.approved_amount,
  ci.actual_amount,
  ci.outcome_code,
  ci.reviewed_at,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) AS source,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.postingContext')) AS posting_context,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.snapshot.endDate')) AS snapshot_end_date,
  JSON_LENGTH(COALESCE(JSON_EXTRACT(ci.metadata_json, '$.costLines'), JSON_ARRAY())) AS cost_line_count,
  ci.updated_at
FROM iset_case_intervention ci
WHERE ci.case_id = 41
ORDER BY ci.start_date, ci.id;

SELECT
  p.id AS proposal_id,
  p.action_plan_id,
  p.legacy_intervention_id,
  p.proposal_kind,
  p.review_status,
  p.start_date,
  p.end_date,
  p.proposed_cost,
  JSON_UNQUOTE(JSON_EXTRACT(p.payload_json, '$.legacyStatus')) AS payload_legacy_status,
  JSON_UNQUOTE(JSON_EXTRACT(p.payload_json, '$.deliveryStatus')) AS payload_delivery_status,
  p.updated_at
FROM iset_intervention_proposal p
WHERE p.case_id = 41
ORDER BY p.id;

SELECT
  rw.id AS review_workflow_id,
  rw.subject_key,
  rw.proposal_id,
  rw.intervention_id,
  rw.current_stage,
  rw.current_owner_role,
  rw.nwac_decision,
  rw.archived_at,
  rw.updated_at
FROM iset_review_workflow rw
WHERE rw.case_id = 41
ORDER BY rw.id;

SELECT
  d.id AS document_id,
  d.label,
  d.status,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS metadata_intervention_id,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.assessment_source')) AS assessment_source,
  d.updated_at
FROM iset_document d
WHERE d.case_id = 41
ORDER BY d.id;

SELECT
  ft.id AS finance_transaction_id,
  ft.case_intervention_id,
  ft.budget_pot_id,
  ft.posting_context,
  ft.amount,
  ft.status,
  ft.transaction_date,
  JSON_UNQUOTE(JSON_EXTRACT(ft.metadata, '$.source')) AS source
FROM finance_transaction ft
WHERE ft.case_id = 41
ORDER BY ft.id;

SELECT
  eps.id AS participant_submission_id,
  eps.action_plan_id,
  eps.readiness_status,
  eps.submission_status,
  eps.updated_at
FROM esdc_participant_submission eps
WHERE eps.case_id = 41
ORDER BY eps.id;

SELECT
  bp.id AS budget_pot_id,
  bp.name,
  bp.actual_amount,
  bp.updated_at
FROM budget_pot bp
WHERE bp.id IN (2000000000086, 2000000000067, 2000000000062)
ORDER BY bp.id;

SELECT
  CASE WHEN
    -- Exact case identity and ownership.
    (SELECT COUNT(*)
       FROM iset_case c
       JOIN client cl ON cl.id = c.client_id
      WHERE c.id = 41
        AND c.case_number = 'CASE-2026-0000041'
        AND c.client_id = 41
        AND c.assigned_staff_profile_id = 54
        AND cl.first_name = 'Solana'
        AND cl.last_name = 'Henderson'
        AND c.status = 'active'
        AND c.lifecycle_status = 'active') = 1
    -- Exactly the two reviewed plans.
    AND (SELECT COUNT(*) FROM iset_case_action_plan WHERE case_id = 41) = 2
    AND (SELECT COUNT(*)
           FROM iset_case_action_plan
          WHERE id = 23
            AND case_id = 41
            AND status = 'active'
            AND agreement_number = '16535866'
            AND budget_pot = '2000000000086'
            AND funding_stream = 'EI'
            AND EIClaimant = 2
            AND effective_date = '2026-01-05'
            AND result_code IS NULL
            AND result_date IS NULL
            AND archived_at IS NULL) = 1
    AND (SELECT COUNT(*)
           FROM iset_case_action_plan
          WHERE id = 143
            AND case_id = 41
            AND status = 'draft'
            AND agreement_number = '16535866'
            AND budget_pot = '2000000000086'
            AND funding_stream = 'EI'
            AND EIClaimant = 1
            AND effective_date = '2026-04-01'
            AND activated_at IS NULL
            AND archived_at IS NULL) = 1
    -- Exactly the two reviewed interventions.
    AND (SELECT COUNT(*) FROM iset_case_intervention WHERE case_id = 41) = 2
    AND (SELECT COUNT(*)
           FROM iset_case_intervention
          WHERE id = 32
            AND case_id = 41
            AND action_plan_id = 23
            AND status = 'completed'
            AND delivery_status = 'completed'
            AND start_date = '2026-01-05'
            AND end_date = '2026-03-31'
            AND intervention_cost = 900.00
            AND budget_amount = 900.00
            AND actual_amount = 900.00
            AND outcome_code = 1
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload') = 1
    AND (SELECT COUNT(*)
           FROM iset_case_intervention
          WHERE id = 311
            AND case_id = 41
            AND action_plan_id = 23
            AND status = 'in_progress'
            AND delivery_status = 'in_progress'
            AND start_date = '2026-04-01'
            AND end_date = '2026-06-19'
            AND intervention_cost IS NULL
            AND budget_amount IS NULL
            AND approved_amount IS NULL
            AND actual_amount IS NULL
            AND outcome_code IS NULL
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload') = 1
    -- Compatibility proposals are present and no deleted revision copy remains.
    AND (SELECT COUNT(*) FROM iset_intervention_proposal WHERE case_id = 41) = 2
    AND (SELECT COUNT(*)
           FROM iset_intervention_proposal
          WHERE id = 69
            AND action_plan_id = 23
            AND legacy_intervention_id = 32
            AND proposal_kind = 'new'
            AND review_status = 'approved'
            AND proposed_cost = 900.00) = 1
    AND (SELECT COUNT(*)
           FROM iset_intervention_proposal
          WHERE id = 382
            AND action_plan_id = 23
            AND legacy_intervention_id = 311
            AND proposal_kind = 'new'
            AND review_status = 'approved'
            AND proposed_cost = 0.00) = 1
    AND (SELECT COUNT(*) FROM iset_case_intervention WHERE id = 301) = 0
    AND (SELECT COUNT(*) FROM iset_intervention_proposal WHERE id = 363) = 0
    -- The deleted revision left one orphaned workflow and one active generated PDF.
    AND (SELECT COUNT(*)
           FROM iset_review_workflow
          WHERE id = 40
            AND case_id = 41
            AND subject_key = 'intervention_revision:proposal:363'
            AND proposal_id IS NULL
            AND intervention_id IS NULL
            AND current_stage = 'returned_to_rm'
            AND nwac_decision = 'changes_requested'
            AND archived_at IS NULL) = 1
    AND (SELECT COUNT(*)
           FROM iset_document
          WHERE id = 7312
            AND case_id = 41
            AND status = 'active'
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.intervention_id')) = '301'
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.assessment_source')) =
                'intervention_revision_submission') = 1
    -- No hidden finance, payment, reminder, document-link, or application dependency.
    AND (SELECT COUNT(*) FROM finance_transaction WHERE case_intervention_id = 311) = 0
    AND (SELECT COUNT(*) FROM payment_packet WHERE case_id = 41) = 0
    AND (SELECT COUNT(*) FROM iset_case_reminder WHERE case_id = 41) = 0
    AND (SELECT COUNT(*)
           FROM iset_document_intervention di
           JOIN iset_case_intervention ci ON ci.id = di.intervention_id
          WHERE ci.case_id = 41) = 0
    AND (SELECT COUNT(*) FROM iset_application WHERE case_id = 41) = 0
    -- Existing and missing ILMP submission rows match the reviewed state.
    AND (SELECT COUNT(*)
           FROM esdc_participant_submission
          WHERE id = 70
            AND case_id = 41
            AND action_plan_id = 23
            AND readiness_status = 'needs_review'
            AND submission_status = 'pending') = 1
    AND (SELECT COUNT(*) FROM esdc_participant_submission WHERE action_plan_id = 143) = 0
    -- Finance rollup values have not moved since review.
    AND (SELECT COUNT(*) FROM budget_pot WHERE id = 2000000000086 AND actual_amount = 74543.00) = 1
    AND (SELECT COUNT(*) FROM budget_pot WHERE id = 2000000000067 AND actual_amount = 102052.00) = 1
    AND (SELECT COUNT(*) FROM budget_pot WHERE id = 2000000000062 AND actual_amount = 159020.62) = 1
  THEN 'READY'
  ELSE 'BLOCKED'
  END AS repair_readiness;

SELECT
  23 AS prior_plan_id,
  'closed' AS projected_status,
  '2026-03-31' AS projected_result_date,
  '4 - Returned to school' AS projected_result,
  '8 - College / CEGEP / non-university diploma' AS projected_result_education,
  '8 - College / CEGEP / non-university diploma' AS projected_future_education
UNION ALL
SELECT
  143,
  'active',
  NULL,
  'EI Reach Back',
  NULL,
  NULL;

SELECT
  32 AS intervention_id,
  23 AS projected_action_plan_id,
  '2026-01-05' AS projected_start_date,
  '2026-03-31' AS projected_end_date,
  'completed' AS projected_status,
  '1 - Complete' AS projected_outcome,
  900.00 AS projected_actual_amount
UNION ALL
SELECT
  311,
  143,
  '2026-04-01',
  '2026-06-19',
  'completed',
  '1 - Complete',
  3077.21;
