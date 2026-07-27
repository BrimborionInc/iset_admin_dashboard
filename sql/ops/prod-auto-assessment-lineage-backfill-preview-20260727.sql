-- Read-only preview for historical auto-assessment action-plan provenance.
--
-- Scope:
-- - 14 explicitly identified auto_assessment action plans whose application_id is NULL.
-- - Every intervention on each plan must match the expected application assessment through
--   metadata_json.proposedInterventionId -> proposed_interventions[*].id.
-- - Three null proposal application links and two null ESDC submission application links
--   are shown as dependent repairs.
-- - Documents are not changed; application_id is optional document provenance and the three
--   null rows in this scope are manual uploads already linked to their case/action plan.
--
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file \
--     sql/ops/prod-auto-assessment-lineage-backfill-preview-20260727.sql

DROP TEMPORARY TABLE IF EXISTS tmp_expected_auto_assessment_lineage_20260727;
CREATE TEMPORARY TABLE tmp_expected_auto_assessment_lineage_20260727 (
  action_plan_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL
);

INSERT INTO tmp_expected_auto_assessment_lineage_20260727
  (action_plan_id, case_id, application_id)
VALUES
  (12, 88, 6),
  (28, 84, 2),
  (30, 79, 42),
  (31, 98, 16),
  (34, 85, 3),
  (54, 134, 56),
  (56, 120, 39),
  (71, 16, 54),
  (83, 103, 21),
  (101, 166, 97),
  (105, 60, 72),
  (108, 133, 55),
  (109, 65, 38),
  (112, 97, 15);

SELECT
  'candidate' AS section,
  expected.action_plan_id,
  expected.case_id,
  expected.application_id AS expected_application_id,
  plan.application_id AS current_application_id,
  JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) AS plan_source,
  application.case_id AS application_case_id,
  assessment.id AS assessment_id,
  COUNT(DISTINCT intervention.id) AS intervention_count,
  SUM(
    JSON_SEARCH(
      assessment.proposed_interventions,
      'one',
      JSON_UNQUOTE(JSON_EXTRACT(intervention.metadata_json, '$.proposedInterventionId')),
      NULL,
      '$[*].id'
    ) IS NOT NULL
  ) AS interventions_matching_expected_assessment
FROM tmp_expected_auto_assessment_lineage_20260727 expected
LEFT JOIN iset_case_action_plan plan
  ON plan.id = expected.action_plan_id
 AND plan.case_id = expected.case_id
LEFT JOIN iset_application application
  ON application.id = expected.application_id
LEFT JOIN iset_application_assessment assessment
  ON assessment.application_id = expected.application_id
 AND assessment.case_id = expected.case_id
LEFT JOIN iset_case_intervention intervention
  ON intervention.action_plan_id = expected.action_plan_id
GROUP BY
  expected.action_plan_id,
  expected.case_id,
  expected.application_id,
  plan.application_id,
  plan.metadata_json,
  application.case_id,
  assessment.id
ORDER BY expected.action_plan_id;

SELECT
  'ambiguous_or_invalid_candidate' AS section,
  expected.action_plan_id,
  expected.case_id,
  expected.application_id,
  COUNT(DISTINCT discovered.application_id) AS discovered_application_count,
  GROUP_CONCAT(DISTINCT discovered.application_id ORDER BY discovered.application_id) AS discovered_application_ids
FROM tmp_expected_auto_assessment_lineage_20260727 expected
LEFT JOIN iset_case_intervention intervention
  ON intervention.action_plan_id = expected.action_plan_id
LEFT JOIN iset_application_assessment discovered
  ON discovered.case_id = expected.case_id
 AND JSON_SEARCH(
       discovered.proposed_interventions,
       'one',
       JSON_UNQUOTE(JSON_EXTRACT(intervention.metadata_json, '$.proposedInterventionId')),
       NULL,
       '$[*].id'
     ) IS NOT NULL
GROUP BY expected.action_plan_id, expected.case_id, expected.application_id
HAVING discovered_application_count <> 1
    OR MIN(discovered.application_id) <> expected.application_id
    OR MAX(discovered.application_id) <> expected.application_id;

SELECT
  'dependent_proposal' AS section,
  proposal.id,
  proposal.case_id,
  proposal.action_plan_id,
  proposal.application_id AS current_application_id,
  expected.application_id AS expected_application_id,
  proposal.legacy_intervention_id,
  proposal.review_status
FROM iset_intervention_proposal proposal
JOIN tmp_expected_auto_assessment_lineage_20260727 expected
  ON expected.action_plan_id = proposal.action_plan_id
ORDER BY proposal.action_plan_id, proposal.id;

SELECT
  'dependent_esdc_submission' AS section,
  submission.id,
  submission.case_id,
  submission.action_plan_id,
  submission.application_id AS current_application_id,
  expected.application_id AS expected_application_id,
  submission.readiness_status,
  submission.submission_status
FROM esdc_participant_submission submission
JOIN tmp_expected_auto_assessment_lineage_20260727 expected
  ON expected.action_plan_id = submission.action_plan_id
ORDER BY submission.action_plan_id, submission.id;

SELECT
  'projected_action_plan_updates' AS section,
  COUNT(*) AS row_count
FROM iset_case_action_plan plan
JOIN tmp_expected_auto_assessment_lineage_20260727 expected
  ON expected.action_plan_id = plan.id
 AND expected.case_id = plan.case_id
WHERE plan.application_id IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) = 'auto_assessment';

SELECT
  'projected_proposal_updates' AS section,
  COUNT(*) AS row_count
FROM iset_intervention_proposal proposal
JOIN tmp_expected_auto_assessment_lineage_20260727 expected
  ON expected.action_plan_id = proposal.action_plan_id
 AND expected.case_id = proposal.case_id
WHERE proposal.application_id IS NULL;

SELECT
  'projected_esdc_submission_updates' AS section,
  COUNT(*) AS row_count
FROM esdc_participant_submission submission
JOIN tmp_expected_auto_assessment_lineage_20260727 expected
  ON expected.action_plan_id = submission.action_plan_id
 AND expected.case_id = submission.case_id
WHERE submission.application_id IS NULL;

SELECT
  'existing_repair_events' AS section,
  COUNT(*) AS row_count
FROM iset_case_event event
WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
      'prod-auto-assessment-lineage-backfill-20260727';

SELECT
  'blocking_dependency_mismatch' AS section,
  'proposal' AS dependency,
  proposal.id AS row_id,
  proposal.action_plan_id,
  proposal.application_id AS current_application_id,
  expected.application_id AS expected_application_id
FROM iset_intervention_proposal proposal
JOIN tmp_expected_auto_assessment_lineage_20260727 expected
  ON expected.action_plan_id = proposal.action_plan_id
WHERE proposal.application_id IS NOT NULL
  AND (
    proposal.case_id <> expected.case_id
    OR proposal.application_id <> expected.application_id
  );

SELECT
  'blocking_dependency_mismatch' AS section,
  'esdc_participant_submission' AS dependency,
  submission.id AS row_id,
  submission.action_plan_id,
  submission.application_id AS current_application_id,
  expected.application_id AS expected_application_id
FROM esdc_participant_submission submission
JOIN tmp_expected_auto_assessment_lineage_20260727 expected
  ON expected.action_plan_id = submission.action_plan_id
WHERE submission.application_id IS NOT NULL
  AND (
    submission.case_id <> expected.case_id
    OR submission.application_id <> expected.application_id
  );
