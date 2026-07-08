-- PROD repair: move BC manual-backload interventions out of FY 2026-27 finance reporting
-- by setting reviewed_at to the inferred historic approval date (intervention start_date).
-- Business rule confirmed 2026-07-08: Financial Reports are approval-date based; for
-- historic/manual backloaded interventions, infer approval date from intervention start_date.

DROP PROCEDURE IF EXISTS prod_bc_backload_reporting_date_repair_20260708;

DELIMITER //

CREATE PROCEDURE prod_bc_backload_reporting_date_repair_20260708()
BEGIN
  DECLARE v_expected_count INT DEFAULT 13;
  DECLARE v_matching_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_event_count INT DEFAULT 0;

  DROP TEMPORARY TABLE IF EXISTS tmp_bc_backload_reporting_date_expected;
  CREATE TEMPORARY TABLE tmp_bc_backload_reporting_date_expected (
    intervention_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    expected_start_date DATE NOT NULL,
    expected_amount DECIMAL(14,2) NOT NULL,
    proposed_reviewed_at DATETIME NOT NULL
  );

  INSERT INTO tmp_bc_backload_reporting_date_expected
    (intervention_id, expected_start_date, expected_amount, proposed_reviewed_at)
  VALUES
    (25, '2025-07-10', 17269.00, '2025-07-10 00:00:00'),
    (22, '2025-02-06', 61536.00, '2025-02-06 00:00:00'),
    (30, '2025-09-03', 5855.00, '2025-09-03 00:00:00'),
    (15, '2026-01-05', 372.00, '2026-01-05 00:00:00'),
    (31, '2026-01-05', 437.00, '2026-01-05 00:00:00'),
    (24, '2025-09-01', 22301.00, '2025-09-01 00:00:00'),
    (26, '2026-01-19', 11505.00, '2026-01-19 00:00:00'),
    (18, '2025-12-18', 30800.00, '2025-12-18 00:00:00'),
    (23, '2025-09-03', 12616.00, '2025-09-03 00:00:00'),
    (9, '2025-09-02', 16044.44, '2025-09-02 00:00:00'),
    (33, '2026-01-19', 5112.00, '2026-01-19 00:00:00'),
    (32, '2026-01-05', 4077.00, '2026-01-05 00:00:00'),
    (34, '2025-09-03', 15165.00, '2025-09-03 00:00:00');

  SELECT COUNT(*)
    INTO v_matching_count
  FROM tmp_bc_backload_reporting_date_expected e
  JOIN iset_case_intervention ci ON ci.id = e.intervention_id
  JOIN iset_case c ON c.id = ci.case_id
  WHERE ci.start_date = e.expected_start_date
    AND ROUND(COALESCE(ci.approved_amount, ci.budget_amount, ci.intervention_cost, 0), 2) = e.expected_amount
    AND DATE(COALESCE(ci.reviewed_at, ci.created_at)) BETWEEN '2026-04-01' AND '2027-03-31'
    AND (
      JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'manual_backload'
      OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) = 'existing'
    );

  IF v_matching_count <> v_expected_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected BC backload intervention rows do not all match current PROD state.';
  END IF;

  START TRANSACTION;

  UPDATE iset_case_intervention ci
  JOIN tmp_bc_backload_reporting_date_expected e ON e.intervention_id = ci.id
     SET ci.reviewed_at = e.proposed_reviewed_at,
         ci.updated_at = CURRENT_TIMESTAMP
   WHERE ci.start_date = e.expected_start_date
     AND ROUND(COALESCE(ci.approved_amount, ci.budget_amount, ci.intervention_cost, 0), 2) = e.expected_amount
     AND DATE(COALESCE(ci.reviewed_at, ci.created_at)) BETWEEN '2026-04-01' AND '2027-03-31'
     AND (
       JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'manual_backload'
       OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.entryMode')) = 'existing'
     );

  SET v_updated_count = ROW_COUNT();

  IF v_updated_count <> v_expected_count THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: reviewed_at update count did not match expected BC backload row count.';
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
      'repairId', 'prod-bc-backload-intervention-reporting-date-repair-20260708',
      'interventionId', ci.id,
      'previousReportingBasis', 'PATH entry date via created_at fallback',
      'newReviewedAt', DATE_FORMAT(ci.reviewed_at, '%Y-%m-%d %H:%i:%s'),
      'inferredFrom', 'intervention.start_date',
      'reason', 'Financial Reports are approval-date based; manual historic interventions infer approval date from start date.'
    ),
    CURRENT_TIMESTAMP(3),
    'codex-prod-data-repair'
  FROM iset_case_intervention ci
  JOIN tmp_bc_backload_reporting_date_expected e ON e.intervention_id = ci.id;

  SET v_event_count = ROW_COUNT();

  IF v_event_count <> v_expected_count THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: case event insert count did not match expected BC backload row count.';
  END IF;

  COMMIT;

  SELECT
    v_expected_count AS expected_rows,
    v_updated_count AS updated_rows,
    v_event_count AS audit_events_inserted;

  SELECT
    ci.id AS intervention_id,
    c.case_number,
    CONCAT(cl.first_name, ' ', cl.last_name) AS client_name,
    COALESCE(ci.approved_amount, ci.budget_amount, ci.intervention_cost, 0) AS amount,
    ci.start_date,
    ci.reviewed_at,
    CASE
      WHEN MONTH(ci.reviewed_at) >= 4 THEN CONCAT(YEAR(ci.reviewed_at), '-', RIGHT(YEAR(ci.reviewed_at) + 1, 2))
      ELSE CONCAT(YEAR(ci.reviewed_at) - 1, '-', RIGHT(YEAR(ci.reviewed_at), 2))
    END AS repaired_reporting_fiscal_year
  FROM tmp_bc_backload_reporting_date_expected e
  JOIN iset_case_intervention ci ON ci.id = e.intervention_id
  JOIN iset_case c ON c.id = ci.case_id
  LEFT JOIN client cl ON cl.id = c.client_id
  ORDER BY client_name, ci.id;
END//

DELIMITER ;

CALL prod_bc_backload_reporting_date_repair_20260708();

DROP PROCEDURE IF EXISTS prod_bc_backload_reporting_date_repair_20260708;
