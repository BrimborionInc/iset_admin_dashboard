-- Read-only preview for four deterministic Regional Snapshot action-plan lineage repairs.
-- Kaitlyn Kitson's mixed historical/renewal action plan 15 is intentionally excluded.

DROP TEMPORARY TABLE IF EXISTS tmp_expected_snapshot_lineage_20260728;
CREATE TEMPORARY TABLE tmp_expected_snapshot_lineage_20260728 (
  action_plan_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  expected_status VARCHAR(32) NOT NULL,
  expected_source VARCHAR(64) NULL,
  expected_archived TINYINT(1) NOT NULL,
  expected_intervention_count INT NOT NULL,
  basis VARCHAR(255) NOT NULL
);

INSERT INTO tmp_expected_snapshot_lineage_20260728 VALUES
  (27, 90, 8, 'active', NULL, 0, 1, 'Proposal 97 and ESDC submission 32 both retain application 8'),
  (29, 131, 52, 'archived', 'auto_assessment', 1, 4, 'Proposals 111 and 216 both retain application 52'),
  (32, 127, 48, 'archived', 'auto_assessment', 1, 2, 'ESDC submission 21 retains application 48'),
  (53, 94, 12, 'closed', 'manual_backload', 0, 2, 'Proposals 175/176 and ESDC submission 115 retain application 12');

SELECT
  expected.action_plan_id,
  expected.case_id,
  plan.application_id AS current_application_id,
  expected.application_id,
  plan.status,
  JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) AS plan_source,
  plan.archived_at,
  (SELECT COUNT(*)
     FROM iset_case_intervention intervention
    WHERE intervention.action_plan_id = expected.action_plan_id) AS intervention_count,
  expected.expected_intervention_count,
  expected.basis
FROM tmp_expected_snapshot_lineage_20260728 expected
JOIN iset_case_action_plan plan
  ON plan.id = expected.action_plan_id
 AND plan.case_id = expected.case_id
ORDER BY expected.action_plan_id;

SELECT
  expected.action_plan_id,
  'proposal' AS provenance_source,
  proposal.id AS source_record_id,
  proposal.application_id
FROM tmp_expected_snapshot_lineage_20260728 expected
JOIN iset_intervention_proposal proposal
  ON proposal.action_plan_id = expected.action_plan_id
WHERE proposal.application_id IS NOT NULL
ORDER BY expected.action_plan_id, proposal.id;

SELECT
  expected.action_plan_id,
  'esdc_submission' AS provenance_source,
  submission.id AS source_record_id,
  submission.application_id
FROM tmp_expected_snapshot_lineage_20260728 expected
JOIN esdc_participant_submission submission
  ON submission.action_plan_id = expected.action_plan_id
WHERE submission.application_id IS NOT NULL
ORDER BY expected.action_plan_id, submission.id;

SELECT
  SUM(plan.id IS NULL) AS missing_plan_rows,
  SUM(application.id IS NULL) AS missing_or_cross_case_applications,
  SUM(plan.application_id IS NOT NULL) AS plans_already_linked,
  SUM(NOT (
    CAST(plan.status AS BINARY) <=> CAST(expected.expected_status AS BINARY)
  )) AS status_mismatches,
  SUM(NOT (
    CAST(JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) AS BINARY)
      <=> CAST(expected.expected_source AS BINARY)
  )) AS source_mismatches,
  SUM(NOT ((plan.archived_at IS NOT NULL) <=> expected.expected_archived)) AS archive_mismatches,
  SUM(
    (SELECT COUNT(*)
       FROM iset_case_intervention intervention
      WHERE intervention.action_plan_id = expected.action_plan_id)
      <> expected.expected_intervention_count
  ) AS intervention_count_mismatches
FROM tmp_expected_snapshot_lineage_20260728 expected
LEFT JOIN iset_case_action_plan plan
  ON plan.id = expected.action_plan_id
 AND plan.case_id = expected.case_id
LEFT JOIN iset_application application
  ON application.id = expected.application_id
 AND application.case_id = expected.case_id;

SELECT COUNT(*) AS conflicting_proposal_rows
FROM tmp_expected_snapshot_lineage_20260728 expected
JOIN iset_intervention_proposal proposal
  ON proposal.action_plan_id = expected.action_plan_id
WHERE proposal.application_id IS NOT NULL
  AND proposal.application_id <> expected.application_id;

SELECT COUNT(*) AS conflicting_esdc_rows
FROM tmp_expected_snapshot_lineage_20260728 expected
JOIN esdc_participant_submission submission
  ON submission.action_plan_id = expected.action_plan_id
WHERE submission.application_id IS NOT NULL
  AND submission.application_id <> expected.application_id;

SELECT COUNT(DISTINCT expected.action_plan_id) AS plans_with_expected_provenance
FROM tmp_expected_snapshot_lineage_20260728 expected
LEFT JOIN iset_intervention_proposal proposal
  ON proposal.action_plan_id = expected.action_plan_id
 AND proposal.application_id = expected.application_id
LEFT JOIN esdc_participant_submission submission
  ON submission.action_plan_id = expected.action_plan_id
 AND submission.application_id = expected.application_id
WHERE proposal.id IS NOT NULL OR submission.id IS NOT NULL;

SELECT COUNT(*) AS existing_repair_events
FROM iset_case_event event
WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
      'prod-regional-snapshot-lineage-backfill-20260728';

DROP TEMPORARY TABLE IF EXISTS tmp_expected_snapshot_lineage_20260728;
