START TRANSACTION;

UPDATE iset_application a
JOIN (
  SELECT application_id, MIN(id) AS case_id, MAX(client_id) AS client_id
  FROM iset_case
  WHERE application_id IS NOT NULL
  GROUP BY application_id
) legacy_map ON legacy_map.application_id = a.id
SET a.client_id = COALESCE(a.client_id, legacy_map.client_id),
    a.case_id = COALESCE(a.case_id, legacy_map.case_id)
WHERE a.client_id IS NULL
   OR a.case_id IS NULL;

UPDATE iset_case_action_plan ap
JOIN iset_case c ON c.id = ap.case_id
SET ap.application_id = c.application_id
WHERE ap.application_id IS NULL
  AND c.application_id IS NOT NULL;

UPDATE iset_application a
SET a.lifecycle_status = COALESCE(
      a.lifecycle_status,
      CASE
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN ('submitted', 'active', 'open', 'pending')
          THEN 'submitted'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') = 'in_review'
          THEN 'in_review'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') = 'docs_requested'
          THEN 'awaiting_applicant'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') = 'closure_notice'
          THEN 'awaiting_applicant'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN ('pending_approval', 'decision_ready')
          THEN 'pending_decision'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN ('approved', 'rejected', 'declined')
          THEN 'decision_recorded'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN ('completed', 'closed', 'withdrawn', 'cancelled')
          THEN 'closed'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') = 'archived'
          THEN 'archived'
        ELSE NULL
      END
    ),
    a.decision_outcome = COALESCE(
      a.decision_outcome,
      CASE
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN ('approved', 'completed')
          THEN 'approved'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN ('rejected', 'declined')
          THEN 'denied'
        ELSE NULL
      END
    ),
    a.awaiting_reason = COALESCE(
      a.awaiting_reason,
      CASE
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') = 'docs_requested'
          THEN 'documents'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') = 'closure_notice'
          THEN 'closure_response'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN (
          'submitted',
          'active',
          'open',
          'pending',
          'in_review',
          'pending_approval',
          'decision_ready',
          'approved',
          'rejected',
          'declined',
          'completed',
          'closed',
          'withdrawn',
          'cancelled',
          'archived'
        )
          THEN 'none'
        ELSE NULL
      END
    ),
    a.closure_reason = COALESCE(
      a.closure_reason,
      CASE
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') = 'withdrawn'
          THEN 'withdrawn'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.status, ''))), '-', '_'), ' ', '_') IN ('closed', 'cancelled')
          THEN 'administrative'
        ELSE NULL
      END
    )
WHERE a.lifecycle_status IS NULL
   OR a.decision_outcome IS NULL
   OR a.awaiting_reason IS NULL
   OR a.closure_reason IS NULL;

UPDATE iset_case c
LEFT JOIN (
  SELECT case_id, COUNT(*) AS plan_count
  FROM iset_case_action_plan
  GROUP BY case_id
) ap ON ap.case_id = c.id
LEFT JOIN (
  SELECT case_id, COUNT(*) AS intervention_count
  FROM iset_case_intervention
  GROUP BY case_id
) ci ON ci.case_id = c.id
SET c.lifecycle_status = COALESCE(
      c.lifecycle_status,
      CASE
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') IN ('pending_approval', 'submitted', 'in_review', 'open', 'pending')
          THEN 'intake'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') IN ('approved', 'initiated')
          THEN 'initiated'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'active'
          THEN 'active'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'dormant'
          THEN 'dormant'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'ready_to_close'
          THEN 'ready_to_close'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') IN ('closed', 'completed', 'cancelled', 'withdrawn')
          THEN 'closed'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'rejected'
             AND COALESCE(ap.plan_count, 0) = 0
             AND COALESCE(ci.intervention_count, 0) = 0
          THEN 'closed'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'archived'
          THEN 'archived'
        ELSE NULL
      END
    ),
    c.closure_reason = COALESCE(
      c.closure_reason,
      CASE
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'withdrawn'
          THEN 'withdrawn'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') IN ('closed', 'completed', 'cancelled')
          THEN 'administrative'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'rejected'
             AND COALESCE(ap.plan_count, 0) = 0
             AND COALESCE(ci.intervention_count, 0) = 0
          THEN 'application_denied'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'rejected'
             AND (COALESCE(ap.plan_count, 0) > 0 OR COALESCE(ci.intervention_count, 0) > 0)
          THEN 'manual_review_required'
        ELSE NULL
      END
    )
WHERE c.lifecycle_status IS NULL
   OR c.closure_reason IS NULL;

UPDATE iset_case_intervention ci
SET ci.delivery_status = COALESCE(
      ci.delivery_status,
      CASE
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') = 'approved'
          THEN 'planned'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') = 'in_progress'
          THEN 'in_progress'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') = 'suspended'
          THEN 'suspended'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') = 'completed'
          THEN 'completed'
        WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') = 'cancelled'
          THEN 'cancelled'
        ELSE NULL
      END
    )
WHERE ci.delivery_status IS NULL;

INSERT INTO iset_intervention_proposal (
  case_id,
  action_plan_id,
  application_id,
  legacy_intervention_id,
  source_intervention_id,
  proposal_kind,
  review_status,
  title,
  intervention_code,
  start_date,
  end_date,
  proposed_cost,
  decision_reason,
  decision_notes,
  payload_json,
  metadata_json,
  submitted_by_staff_profile_id,
  reviewed_by_staff_profile_id,
  submitted_at,
  reviewed_at
)
SELECT
  ci.case_id,
  ci.action_plan_id,
  c.application_id,
  ci.id,
  CASE
    WHEN JSON_EXTRACT(ci.metadata_json, '$.revision.sourceInterventionId') IS NOT NULL
      THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.revision.sourceInterventionId')) AS UNSIGNED)
    ELSE NULL
  END AS source_intervention_id,
  CASE
    WHEN JSON_EXTRACT(ci.metadata_json, '$.revision.sourceInterventionId') IS NOT NULL
      THEN 'revision'
    ELSE 'new'
  END AS proposal_kind,
  REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') AS review_status,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.title')) AS title,
  ci.intervention_code,
  ci.start_date,
  ci.end_date,
  COALESCE(ci.intervention_cost, ci.budget_amount, ci.approved_amount) AS proposed_cost,
  NULL AS decision_reason,
  COALESCE(ci.review_notes, ci.notes) AS decision_notes,
  JSON_OBJECT(
    'legacyInterventionId', ci.id,
    'legacyStatus', ci.status,
    'interventionCode', ci.intervention_code,
    'startDate', ci.start_date,
    'endDate', ci.end_date,
    'proposedCost', COALESCE(ci.intervention_cost, ci.budget_amount, ci.approved_amount),
    'notes', ci.notes
  ) AS payload_json,
  ci.metadata_json,
  ci.created_by_staff_profile_id,
  ci.reviewed_by_staff_profile_id,
  ci.created_at,
  ci.reviewed_at
FROM iset_case_intervention ci
JOIN iset_case c ON c.id = ci.case_id
LEFT JOIN iset_intervention_proposal existing_proposal ON existing_proposal.legacy_intervention_id = ci.id
WHERE existing_proposal.id IS NULL
  AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') IN (
    'draft',
    'submitted',
    'in_review',
    'changes_requested',
    'rejected'
  );

COMMIT;
