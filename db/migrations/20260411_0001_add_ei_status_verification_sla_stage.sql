-- Migration: seed configurable EI status verification SLA stage
-- Created: 2026-04-11
-- Notes: adds the status-based SLA stage between assignment and assessment.

INSERT INTO sla_stage_target (stage_key, display_name, target_hours, description)
SELECT 'ei_status_verification', 'EI Status Verification', 72, 'Time from assignment to confirm EI status or eligibility.'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM sla_stage_target existing
  WHERE existing.stage_key = 'ei_status_verification'
    AND existing.applies_to_role IS NULL
    AND existing.active_to IS NULL
);
