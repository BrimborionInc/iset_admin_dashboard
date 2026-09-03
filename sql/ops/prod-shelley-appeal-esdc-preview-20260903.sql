-- Read-only ESDC state required to plan the appeal-pending reporting hold.
-- Run only after exact PROD identity and live esdc_participant_submission DDL.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT
  esdc_participant_submission.id,
  esdc_participant_submission.case_id,
  esdc_participant_submission.action_plan_id,
  esdc_participant_submission.application_id,
  esdc_participant_submission.readiness_status,
  esdc_participant_submission.readiness_summary,
  esdc_participant_submission.warnings,
  esdc_participant_submission.blocking_issues,
  esdc_participant_submission.last_validated_at,
  esdc_participant_submission.submission_status,
  esdc_participant_submission.submitted_at,
  esdc_participant_submission.submitted_by_user_id,
  esdc_participant_submission.payload_snapshot,
  esdc_participant_submission.payload_storage_key,
  esdc_participant_submission.payload_checksum,
  esdc_participant_submission.rejection_reason,
  esdc_participant_submission.created_at,
  esdc_participant_submission.updated_at
FROM esdc_participant_submission
WHERE esdc_participant_submission.id IN (508, 513)
ORDER BY esdc_participant_submission.id;
