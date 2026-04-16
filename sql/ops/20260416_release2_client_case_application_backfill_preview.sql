SELECT 'applications_total' AS check_name, COUNT(*) AS row_count
FROM iset_application;

SELECT 'applications_missing_client_id' AS check_name, COUNT(*) AS row_count
FROM iset_application
WHERE client_id IS NULL;

SELECT 'applications_missing_case_id' AS check_name, COUNT(*) AS row_count
FROM iset_application
WHERE case_id IS NULL;

SELECT 'applications_with_multiple_legacy_cases' AS check_name, COUNT(*) AS row_count
FROM (
  SELECT application_id
  FROM iset_case
  WHERE application_id IS NOT NULL
  GROUP BY application_id
  HAVING COUNT(*) > 1
) anomalies;

SELECT 'clients_with_multiple_cases' AS check_name, COUNT(*) AS row_count
FROM (
  SELECT client_id
  FROM iset_case
  WHERE client_id IS NOT NULL
  GROUP BY client_id
  HAVING COUNT(*) > 1
) duplicates;

SELECT 'action_plans_missing_application_provenance' AS check_name, COUNT(*) AS row_count
FROM iset_case_action_plan ap
JOIN iset_case c ON c.id = ap.case_id
WHERE ap.application_id IS NULL
  AND c.application_id IS NOT NULL;

SELECT 'application_rows_needing_status_backfill' AS check_name, COUNT(*) AS row_count
FROM iset_application
WHERE lifecycle_status IS NULL
   OR awaiting_reason IS NULL
   OR (
     REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') IN (
       'approved',
       'completed',
       'rejected',
       'declined'
     )
     AND decision_outcome IS NULL
   )
   OR (
     REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') IN (
       'withdrawn',
       'closed',
       'cancelled'
     )
     AND closure_reason IS NULL
   );

SELECT 'case_rows_needing_lifecycle_backfill' AS check_name, COUNT(*) AS row_count
FROM iset_case
WHERE lifecycle_status IS NULL;

SELECT 'rejected_cases_with_service_history_for_manual_review' AS check_name, COUNT(*) AS row_count
FROM iset_case c
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
WHERE REPLACE(REPLACE(LOWER(TRIM(COALESCE(c.status, ''))), '-', '_'), ' ', '_') = 'rejected'
  AND (COALESCE(ap.plan_count, 0) > 0 OR COALESCE(ci.intervention_count, 0) > 0);

SELECT 'intervention_proposal_backfill_candidates' AS check_name, COUNT(*) AS row_count
FROM iset_case_intervention ci
LEFT JOIN iset_intervention_proposal ip ON ip.legacy_intervention_id = ci.id
WHERE ip.id IS NULL
  AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(ci.status, ''))), '-', '_'), ' ', '_') IN (
    'draft',
    'submitted',
    'in_review',
    'changes_requested',
    'rejected'
  );

SELECT 'live_interventions_needing_delivery_status_backfill' AS check_name, COUNT(*) AS row_count
FROM iset_case_intervention
WHERE delivery_status IS NULL
  AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') IN (
    'approved',
    'in_progress',
    'suspended',
    'completed',
    'cancelled'
  );

SELECT 'application_status_outside_backfill_mapping' AS check_name,
       REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') AS normalized_status,
       COUNT(*) AS row_count
FROM iset_application
WHERE REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') NOT IN (
  '',
  'submitted',
  'active',
  'open',
  'pending',
  'in_review',
  'docs_requested',
  'closure_notice',
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
GROUP BY normalized_status
ORDER BY row_count DESC, normalized_status;

SELECT 'case_status_outside_backfill_mapping' AS check_name,
       REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') AS normalized_status,
       COUNT(*) AS row_count
FROM iset_case
WHERE REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') NOT IN (
  '',
  'pending_approval',
  'submitted',
  'in_review',
  'open',
  'pending',
  'approved',
  'initiated',
  'active',
  'dormant',
  'ready_to_close',
  'closed',
  'completed',
  'cancelled',
  'withdrawn',
  'rejected',
  'archived'
)
GROUP BY normalized_status
ORDER BY row_count DESC, normalized_status;

SELECT 'intervention_status_outside_backfill_mapping' AS check_name,
       REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') AS normalized_status,
       COUNT(*) AS row_count
FROM iset_case_intervention
WHERE REPLACE(REPLACE(LOWER(TRIM(COALESCE(status, ''))), '-', '_'), ' ', '_') NOT IN (
  '',
  'draft',
  'submitted',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
  'in_progress',
  'suspended',
  'completed',
  'cancelled'
)
GROUP BY normalized_status
ORDER BY row_count DESC, normalized_status;
