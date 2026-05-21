-- PROD operation: backfill denied-application reporting artifacts after the TEST rehearsal.
-- Scope: PROD denied applications with a sent denial letter marker, plus any existing
-- legacy denial-reporting plan. Run only after app deploy smoke is green and the
-- live candidate preview matches the reviewed PROD list.

SET @backfill_run_id = 'prod-denied-application-reporting-backfill-20260520';
SET @backfilled_at = DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ');
SET @reporting_source = 'denied_reporting';
SET @legacy_reporting_source = 'denied_ineligible_reporting';
SET @plan_name = 'Actions leading to denial';
SET @plan_note = 'Auto-created after denial decision for ILMP reporting.';

DROP TEMPORARY TABLE IF EXISTS tmp_denied_reporting_candidates;
CREATE TEMPORARY TABLE tmp_denied_reporting_candidates AS
SELECT *
FROM (
  SELECT
    a.id AS application_id,
    a.case_id,
    c.case_number,
    c.client_id,
    c.assigned_staff_profile_id AS owner_staff_profile_id,
    COALESCE(
      (
        SELECT DATE(MIN(ee.captured_at))
          FROM iset_event_entry ee
         WHERE ee.event_type = 'nwac_review_denied'
           AND (
             (ee.subject_type IN ('application', 'iset_application') AND CAST(ee.subject_id AS UNSIGNED) = a.id)
             OR (ee.subject_type IN ('case', 'iset_case') AND CAST(ee.subject_id AS UNSIGNED) = a.case_id)
           )
      ),
      (
        SELECT DATE(MIN(ee.captured_at))
          FROM iset_event_entry ee
         WHERE ee.event_type = 'status_changed'
           AND JSON_UNQUOTE(JSON_EXTRACT(ee.payload_json, '$.to')) = 'rejected'
           AND (
             (ee.subject_type IN ('application', 'iset_application') AND CAST(ee.subject_id AS UNSIGNED) = a.id)
             OR (ee.subject_type IN ('case', 'iset_case') AND CAST(ee.subject_id AS UNSIGNED) = a.case_id)
           )
      ),
      (
        SELECT MIN(ci.start_date)
          FROM iset_case_intervention ci
          JOIN iset_case_action_plan ap ON ap.id = ci.action_plan_id
         WHERE ci.case_id = a.case_id
           AND (
             JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) IN (@reporting_source, @legacy_reporting_source)
             OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) IN (@reporting_source, @legacy_reporting_source)
             OR ap.name IN (@plan_name, 'Eligibility denial reporting plan')
           )
      ),
      STR_TO_DATE(
        SUBSTRING(
          JSON_UNQUOTE(
            JSON_EXTRACT(
              c.case_context_json,
              CONCAT('$.applicationDecisionLetters."', a.id, '".decisionLetterSent.denial')
            )
          ),
          1,
          10
        ),
        '%Y-%m-%d'
      ),
      DATE(a.updated_at),
      CURRENT_DATE()
    ) AS denial_date,
    JSON_UNQUOTE(
      JSON_EXTRACT(
        c.case_context_json,
        CONCAT('$.applicationDecisionLetters."', a.id, '".decisionLetterSent.denial')
      )
    ) AS denial_letter_sent_at,
    EXISTS (
      SELECT 1
        FROM iset_case_action_plan ap
       WHERE ap.case_id = a.case_id
         AND (
           JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) IN (@reporting_source, @legacy_reporting_source)
           OR ap.name IN (@plan_name, 'Eligibility denial reporting plan')
         )
    ) AS has_existing_denial_reporting_plan
  FROM iset_application a
  JOIN iset_case c ON c.id = a.case_id
  WHERE LOWER(COALESCE(a.decision_outcome, '')) = 'denied'
     OR LOWER(COALESCE(a.status, '')) IN ('rejected', 'denied')
) candidate
WHERE candidate.denial_letter_sent_at IS NOT NULL
   OR candidate.has_existing_denial_reporting_plan = 1;

SELECT
  'candidate_preview' AS section,
  case_number,
  application_id,
  case_id,
  denial_date,
  denial_letter_sent_at,
  has_existing_denial_reporting_plan
FROM tmp_denied_reporting_candidates
ORDER BY case_number;

START TRANSACTION;

UPDATE iset_case c
JOIN tmp_denied_reporting_candidates t ON t.case_id = c.id
   SET c.status = 'closed',
       c.closed_at = COALESCE(c.closed_at, TIMESTAMP(t.denial_date)),
       c.case_context_json = JSON_SET(
         COALESCE(c.case_context_json, JSON_OBJECT()),
         '$.reportingOnlyDenied', TRUE,
         '$.excludeFromCaseworkQueues', TRUE,
         '$.reportingCorrectionAllowed', TRUE,
         '$.reportingSeedSource', @reporting_source,
         '$.reportingBackfillRunId', @backfill_run_id,
         '$.reportingBackfilledAt', @backfilled_at,
         '$.reportingSeededAt', COALESCE(
           JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.reportingSeededAt')),
           @backfilled_at
         ),
         '$.reportingLastSyncedAt', @backfilled_at,
         '$.reportingDeniedAt', DATE_FORMAT(t.denial_date, '%Y-%m-%d'),
         '$.applicationId', t.application_id,
         '$.clientId', t.client_id
       ),
       c.updated_at = NOW();

DROP TEMPORARY TABLE IF EXISTS tmp_denied_reporting_plan_choice;
CREATE TEMPORARY TABLE tmp_denied_reporting_plan_choice AS
SELECT
  t.*,
  (
    SELECT ap.id
      FROM iset_case_action_plan ap
     WHERE ap.case_id = t.case_id
       AND (
         JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) IN (@reporting_source, @legacy_reporting_source)
         OR ap.name IN (@plan_name, 'Eligibility denial reporting plan')
       )
     ORDER BY
       (JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = @reporting_source) DESC,
       ap.id ASC
     LIMIT 1
  ) AS plan_id
FROM tmp_denied_reporting_candidates t;

INSERT INTO iset_case_action_plan
  (case_id, application_id, name, status, agreement_number, budget_pot, funding_stream,
   owner_staff_profile_id, effective_date, review_date, activated_at, closed_at,
   result_code, result_date, outcome_summary, closure_notes, notes,
   metadata_json, esdc_action_plan_json, archived_at)
SELECT
  t.case_id,
  t.application_id,
  @plan_name,
  'closed',
  NULL,
  NULL,
  NULL,
  t.owner_staff_profile_id,
  t.denial_date,
  NULL,
  TIMESTAMP(t.denial_date),
  TIMESTAMP(t.denial_date),
  '1',
  t.denial_date,
  @plan_note,
  @plan_note,
  @plan_note,
  JSON_OBJECT(
    'source', @reporting_source,
    'reportingOnly', TRUE,
    'generatedAt', @backfilled_at,
    'backfilledAt', @backfilled_at,
    'backfillRunId', @backfill_run_id,
    'denialDate', DATE_FORMAT(t.denial_date, '%Y-%m-%d'),
    'note', @plan_note
  ),
  JSON_OBJECT(
    'actionPlanResultCode', '1',
    'actionPlanResultDate', DATE_FORMAT(t.denial_date, '%Y-%m-%d')
  ),
  NULL
FROM tmp_denied_reporting_plan_choice t
WHERE t.plan_id IS NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_denied_reporting_plan_map;
CREATE TEMPORARY TABLE tmp_denied_reporting_plan_map AS
SELECT
  t.*,
  (
    SELECT ap.id
      FROM iset_case_action_plan ap
     WHERE ap.case_id = t.case_id
       AND (
         JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) IN (@reporting_source, @legacy_reporting_source)
         OR ap.name IN (@plan_name, 'Eligibility denial reporting plan')
       )
     ORDER BY
       (JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = @reporting_source) DESC,
       ap.id ASC
     LIMIT 1
  ) AS plan_id
FROM tmp_denied_reporting_candidates t;

UPDATE iset_case_action_plan ap
JOIN tmp_denied_reporting_plan_map t ON t.plan_id = ap.id
   SET ap.application_id = t.application_id,
       ap.name = @plan_name,
       ap.status = 'closed',
       ap.budget_pot = NULL,
       ap.effective_date = t.denial_date,
       ap.review_date = NULL,
       ap.activated_at = COALESCE(ap.activated_at, TIMESTAMP(t.denial_date)),
       ap.closed_at = COALESCE(ap.closed_at, TIMESTAMP(t.denial_date)),
       ap.result_code = '1',
       ap.result_date = t.denial_date,
       ap.outcome_summary = @plan_note,
       ap.closure_notes = @plan_note,
       ap.notes = @plan_note,
       ap.archived_at = NULL,
       ap.metadata_json = JSON_SET(
         COALESCE(ap.metadata_json, JSON_OBJECT()),
         '$.source', @reporting_source,
         '$.reportingOnly', TRUE,
         '$.backfilledAt', @backfilled_at,
         '$.backfillRunId', @backfill_run_id,
         '$.denialDate', DATE_FORMAT(t.denial_date, '%Y-%m-%d'),
         '$.note', @plan_note
       ),
       ap.esdc_action_plan_json = JSON_SET(
         COALESCE(ap.esdc_action_plan_json, JSON_OBJECT()),
         '$.actionPlanResultCode', '1',
         '$.actionPlanResultDate', DATE_FORMAT(t.denial_date, '%Y-%m-%d')
       ),
       ap.updated_at = NOW();

DROP TEMPORARY TABLE IF EXISTS tmp_denied_reporting_codes;
CREATE TEMPORARY TABLE tmp_denied_reporting_codes (
  intervention_code TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  title VARCHAR(128) NOT NULL
);

INSERT INTO tmp_denied_reporting_codes (intervention_code, title)
VALUES
  (1, 'Career Research and Exploration'),
  (3, 'Employment Counselling');

UPDATE iset_case_intervention ci
JOIN tmp_denied_reporting_plan_map t ON t.plan_id = ci.action_plan_id
JOIN tmp_denied_reporting_codes code_map ON code_map.intervention_code = ci.intervention_code
   SET ci.status = 'completed',
       ci.delivery_status = 'completed',
       ci.start_date = t.denial_date,
       ci.end_date = t.denial_date,
       ci.duration_days = 0,
       ci.intervention_cost = NULL,
       ci.budget_amount = NULL,
       ci.approved_amount = NULL,
       ci.actual_amount = NULL,
       ci.outcome_code = 1,
       ci.notes = @plan_note,
       ci.metadata_json = JSON_SET(
         COALESCE(ci.metadata_json, JSON_OBJECT()),
         '$.source', @reporting_source,
         '$.reportingOnly', TRUE,
         '$.title', code_map.title,
         '$.backfilledAt', @backfilled_at,
         '$.backfillRunId', @backfill_run_id,
         '$.denialDate', DATE_FORMAT(t.denial_date, '%Y-%m-%d'),
         '$.compliance.ilmp', 'needs_review'
       ),
       ci.esdc_intervention_json = JSON_OBJECT(
         'interventionOutcome', '1',
         'interventionDuration', 0
       ),
       ci.created_by_staff_profile_id = COALESCE(ci.created_by_staff_profile_id, t.owner_staff_profile_id),
       ci.reviewed_by_staff_profile_id = NULL,
       ci.reviewed_at = NULL,
       ci.review_notes = NULL,
       ci.eligibility_result = NULL,
       ci.funding_stream_decision = NULL,
       ci.required_docs_flags = NULL,
       ci.closed_at = COALESCE(ci.closed_at, TIMESTAMP(t.denial_date)),
       ci.updated_at = NOW();

INSERT INTO iset_case_intervention
  (case_id, action_plan_id, intervention_code, related_noc_version, related_noc,
   status, delivery_status, start_date, end_date, duration_days,
   intervention_cost, budget_amount, approved_amount, actual_amount, outcome_code,
   notes, metadata_json, esdc_intervention_json, created_by_staff_profile_id,
   reviewed_by_staff_profile_id, reviewed_at, review_notes, eligibility_result,
   funding_stream_decision, required_docs_flags, closed_at)
SELECT
  t.case_id,
  t.plan_id,
  code_map.intervention_code,
  NULL,
  NULL,
  'completed',
  'completed',
  t.denial_date,
  t.denial_date,
  0,
  NULL,
  NULL,
  NULL,
  NULL,
  1,
  @plan_note,
  JSON_OBJECT(
    'source', @reporting_source,
    'reportingOnly', TRUE,
    'generatedAt', @backfilled_at,
    'backfilledAt', @backfilled_at,
    'backfillRunId', @backfill_run_id,
    'title', code_map.title,
    'denialDate', DATE_FORMAT(t.denial_date, '%Y-%m-%d'),
    'compliance', JSON_OBJECT('ilmp', 'needs_review')
  ),
  JSON_OBJECT(
    'interventionOutcome', '1',
    'interventionDuration', 0
  ),
  t.owner_staff_profile_id,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  TIMESTAMP(t.denial_date)
FROM tmp_denied_reporting_plan_map t
JOIN tmp_denied_reporting_codes code_map
WHERE NOT EXISTS (
  SELECT 1
    FROM iset_case_intervention ci
   WHERE ci.action_plan_id = t.plan_id
     AND ci.intervention_code = code_map.intervention_code
);

INSERT INTO esdc_participant_submission
  (case_id, action_plan_id, application_id, readiness_status, readiness_summary,
   warnings, blocking_issues, last_validated_at, submission_status, submitted_at,
   submitted_by_user_id, payload_snapshot, payload_storage_key, payload_checksum,
   rejection_reason)
SELECT
  t.case_id,
  t.plan_id,
  t.application_id,
  'needs_review',
  NULL,
  NULL,
  NULL,
  NULL,
  'pending',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM tmp_denied_reporting_plan_map t
ON DUPLICATE KEY UPDATE
  case_id = VALUES(case_id),
  application_id = VALUES(application_id),
  readiness_status = 'needs_review',
  readiness_summary = NULL,
  warnings = NULL,
  blocking_issues = NULL,
  last_validated_at = NULL,
  submission_status = 'pending',
  submitted_at = NULL,
  submitted_by_user_id = NULL,
  payload_snapshot = NULL,
  payload_storage_key = NULL,
  payload_checksum = NULL,
  rejection_reason = NULL,
  updated_at = NOW();

UPDATE iset_case c
JOIN (
  SELECT
    ci.case_id,
    COUNT(*) AS total_intervention_count,
    SUM(CASE WHEN LOWER(COALESCE(ci.status, '')) NOT IN ('completed', 'cancelled', 'canceled', 'archived', 'rejected') THEN 1 ELSE 0 END) AS open_intervention_count
  FROM iset_case_intervention ci
  JOIN tmp_denied_reporting_candidates t ON t.case_id = ci.case_id
  GROUP BY ci.case_id
) counts ON counts.case_id = c.id
   SET c.total_intervention_count = counts.total_intervention_count,
       c.open_intervention_count = counts.open_intervention_count,
       c.updated_at = NOW();

COMMIT;

SELECT
  'after_plan_summary' AS section,
  t.case_number,
  ap.id AS action_plan_id,
  ap.name,
  ap.status,
  ap.effective_date,
  ap.result_date,
  JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) AS source,
  JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.backfillRunId')) AS backfill_run_id
FROM tmp_denied_reporting_plan_map t
JOIN iset_case_action_plan ap ON ap.id = t.plan_id
ORDER BY t.case_number;

SELECT
  'after_intervention_summary' AS section,
  t.case_number,
  ci.id AS intervention_id,
  ci.intervention_code,
  ic.label,
  ci.status,
  ci.delivery_status,
  ci.start_date,
  ci.end_date,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) AS source,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.backfillRunId')) AS backfill_run_id
FROM tmp_denied_reporting_plan_map t
JOIN iset_case_intervention ci ON ci.action_plan_id = t.plan_id
LEFT JOIN esdc_intervention_code ic ON ic.code = CAST(ci.intervention_code AS CHAR)
ORDER BY t.case_number, ci.intervention_code;

SELECT
  'after_esdc_summary' AS section,
  t.case_number,
  eps.id AS participant_submission_id,
  eps.readiness_status,
  eps.submission_status,
  eps.application_id,
  eps.action_plan_id
FROM tmp_denied_reporting_plan_map t
LEFT JOIN esdc_participant_submission eps ON eps.action_plan_id = t.plan_id
ORDER BY t.case_number;
