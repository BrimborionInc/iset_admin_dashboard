-- PROD repair: global manual-backload intervention reporting-date correction.
-- Business rule confirmed 2026-07-08: Financial Reports are approval-date based; for
-- historic/manual backloaded interventions, infer approval date from intervention start_date.
--
-- Scope: all remaining manual-backload/existing interventions with start_date present and
-- reviewed_at still NULL. This intentionally does not overwrite rows with reviewed_at already set.

DROP PROCEDURE IF EXISTS prod_global_backload_reporting_date_repair_20260708;

DELIMITER //

CREATE PROCEDURE prod_global_backload_reporting_date_repair_20260708()
BEGIN
  DECLARE v_expected_count INT DEFAULT 31;
  DECLARE v_matching_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_event_count INT DEFAULT 0;

  DROP TEMPORARY TABLE IF EXISTS tmp_global_backload_reporting_date_candidates;
  CREATE TEMPORARY TABLE tmp_global_backload_reporting_date_candidates AS
  SELECT
    ci.id AS intervention_id,
    ci.case_id,
    ci.start_date,
    COALESCE(ci.approved_amount, ci.budget_amount, ci.intervention_cost, 0) AS amount
  FROM iset_case_intervention ci
  WHERE ci.reviewed_at IS NULL
    AND ci.start_date IS NOT NULL
    AND (
      JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'manual_backload'
      OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) = 'existing'
      OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entry_mode')) = 'existing'
      OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.backloadMode')) = 'true'
    );

  SELECT COUNT(*) INTO v_matching_count
  FROM tmp_global_backload_reporting_date_candidates;

  IF v_matching_count <> v_expected_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: global manual-backload candidate count changed.';
  END IF;

  START TRANSACTION;

  UPDATE iset_case_intervention ci
  JOIN tmp_global_backload_reporting_date_candidates c ON c.intervention_id = ci.id
     SET ci.reviewed_at = TIMESTAMP(c.start_date),
         ci.updated_at = CURRENT_TIMESTAMP
   WHERE ci.reviewed_at IS NULL
     AND ci.start_date = c.start_date
     AND (
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'manual_backload'
       OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) = 'existing'
       OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entry_mode')) = 'existing'
       OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.backloadMode')) = 'true'
     );

  SET v_updated_count = ROW_COUNT();

  IF v_updated_count <> v_expected_count THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: global reviewed_at update count did not match expected count.';
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    source_system
  )
  SELECT
    ci.case_id,
    'data_repair',
    CONCAT('Corrected historic intervention reporting date for intervention ', ci.id),
    JSON_OBJECT(
      'repairId', 'prod-global-backload-intervention-reporting-date-repair-20260708',
      'interventionId', ci.id,
      'previousReportingBasis', 'PATH entry date via created_at fallback',
      'newReviewedAt', DATE_FORMAT(ci.reviewed_at, '%Y-%m-%d %H:%i:%s'),
      'inferredFrom', 'intervention.start_date',
      'reason', 'Financial Reports are approval-date based; manual historic interventions infer approval date from start date.'
    ),
    CURRENT_TIMESTAMP(3),
    'codex-prod-data-repair'
  FROM iset_case_intervention ci
  JOIN tmp_global_backload_reporting_date_candidates c ON c.intervention_id = ci.id;

  SET v_event_count = ROW_COUNT();

  IF v_event_count <> v_expected_count THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: global case event insert count did not match expected count.';
  END IF;

  COMMIT;

  SELECT
    v_expected_count AS expected_rows,
    v_updated_count AS updated_rows,
    v_event_count AS audit_events_inserted;

  SELECT
    COALESCE(cr.code, 'Unknown') AS region,
    COUNT(*) AS repaired_count,
    ROUND(SUM(c.amount), 2) AS repaired_amount
  FROM tmp_global_backload_reporting_date_candidates c
  JOIN iset_case ic ON ic.id = c.case_id
  LEFT JOIN canada_region cr ON cr.region_id = ic.portfolio_region_id
  GROUP BY region
  ORDER BY region;
END//

DELIMITER ;

CALL prod_global_backload_reporting_date_repair_20260708();

DROP PROCEDURE IF EXISTS prod_global_backload_reporting_date_repair_20260708;
