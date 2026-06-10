-- PROD cleanup for System Administrator trial ILMP exports.
-- Purpose: clear the Recent ILMP exports widget without changing participant submission,
-- client, case, application, action-plan, or intervention records.
--
-- Requested by Bill on 2026-06-09 after confirming all three Bill-created trial
-- batch groups should be removed from export history.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS prod_ilmp_trial_export_history_cleanup_20260609 (
  audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cleanup_reason VARCHAR(255) NOT NULL,
  cleanup_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  history_id BIGINT UNSIGNED NOT NULL,
  participant_submission_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  payload_checksum CHAR(64) DEFAULT NULL,
  actor_user_id INT DEFAULT NULL,
  event_details JSON DEFAULT NULL,
  occurred_at TIMESTAMP NOT NULL,
  batch_id VARCHAR(128) DEFAULT NULL,
  filename VARCHAR(255) DEFAULT NULL,
  downloaded_by_display_name VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (audit_id),
  UNIQUE KEY uq_prod_ilmp_trial_export_history_cleanup_history (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TEMPORARY TABLE IF EXISTS tmp_bill_trial_ilmp_batches_20260609;
CREATE TEMPORARY TABLE tmp_bill_trial_ilmp_batches_20260609 (
  batch_id VARCHAR(128) NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  expected_history_rows INT NOT NULL
);

INSERT INTO tmp_bill_trial_ilmp_batches_20260609 (batch_id, filename, expected_history_rows) VALUES
  ('ilmp-batch-1780923595289-3f7e4f', 'esdc-participants-2026-06-08.xml', 49),
  ('ilmp-batch-1780620906044-70f57c', 'esdc-participants-2026-06-05.xml', 38),
  ('ilmp-batch-1780576722592-f9bd4a', 'esdc-participants-2026-06-04.xml', 41);

SELECT
  t.batch_id,
  t.filename,
  t.expected_history_rows,
  COUNT(h.id) AS matched_history_rows,
  COUNT(DISTINCT h.participant_submission_id) AS matched_submission_rows,
  GROUP_CONCAT(DISTINCT eps.submission_status ORDER BY eps.submission_status SEPARATOR ',') AS current_submission_statuses,
  MIN(eps.submitted_at) AS min_submission_submitted_at,
  MAX(eps.submitted_at) AS max_submission_submitted_at
FROM tmp_bill_trial_ilmp_batches_20260609 t
LEFT JOIN esdc_participant_submission_history h
  ON JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.batchId')) = t.batch_id
 AND JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.filename')) = t.filename
 AND h.event_type = 'submitted'
LEFT JOIN esdc_participant_submission eps
  ON eps.id = h.participant_submission_id
GROUP BY t.batch_id, t.filename, t.expected_history_rows
ORDER BY t.filename DESC;

SET @matched_rows := (
  SELECT COUNT(*)
  FROM esdc_participant_submission_history h
  JOIN tmp_bill_trial_ilmp_batches_20260609 t
    ON JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.batchId')) = t.batch_id
   AND JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.filename')) = t.filename
  JOIN esdc_participant_submission eps
    ON eps.id = h.participant_submission_id
  WHERE h.event_type = 'submitted'
    AND h.actor_user_id = 4
    AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.downloadedByDisplayName')), '') = 'bill@sillery.co.uk'
    AND eps.submission_status = 'pending'
    AND eps.submitted_at IS NULL
);

SET @expected_rows := (
  SELECT SUM(expected_history_rows)
  FROM tmp_bill_trial_ilmp_batches_20260609
);

SELECT @matched_rows AS matched_rows, @expected_rows AS expected_rows;

INSERT INTO prod_ilmp_trial_export_history_cleanup_20260609 (
  cleanup_reason,
  history_id,
  participant_submission_id,
  event_type,
  payload_checksum,
  actor_user_id,
  event_details,
  occurred_at,
  batch_id,
  filename,
  downloaded_by_display_name
)
SELECT
  'Bill System Administrator trial ILMP export history cleanup 2026-06-09',
  h.id,
  h.participant_submission_id,
  h.event_type,
  h.payload_checksum,
  h.actor_user_id,
  h.event_details,
  h.occurred_at,
  JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.batchId')) AS batch_id,
  JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.filename')) AS filename,
  JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.downloadedByDisplayName')) AS downloaded_by_display_name
FROM esdc_participant_submission_history h
JOIN tmp_bill_trial_ilmp_batches_20260609 t
  ON JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.batchId')) = t.batch_id
 AND JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.filename')) = t.filename
JOIN esdc_participant_submission eps
  ON eps.id = h.participant_submission_id
WHERE h.event_type = 'submitted'
  AND h.actor_user_id = 4
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.downloadedByDisplayName')), '') = 'bill@sillery.co.uk'
  AND eps.submission_status = 'pending'
  AND eps.submitted_at IS NULL
ON DUPLICATE KEY UPDATE
  cleanup_reason = VALUES(cleanup_reason),
  cleanup_created_at = cleanup_created_at;

SET @audited_rows := ROW_COUNT();
SELECT @audited_rows AS newly_audited_rows;

DELETE h
FROM esdc_participant_submission_history h
JOIN tmp_bill_trial_ilmp_batches_20260609 t
  ON JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.batchId')) = t.batch_id
 AND JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.filename')) = t.filename
JOIN esdc_participant_submission eps
  ON eps.id = h.participant_submission_id
WHERE h.event_type = 'submitted'
  AND h.actor_user_id = 4
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.downloadedByDisplayName')), '') = 'bill@sillery.co.uk'
  AND eps.submission_status = 'pending'
  AND eps.submitted_at IS NULL
  AND @matched_rows = @expected_rows
  AND (
    SELECT COUNT(*)
    FROM prod_ilmp_trial_export_history_cleanup_20260609 audit
    WHERE audit.history_id = h.id
  ) = 1;

SET @deleted_rows := ROW_COUNT();
SELECT @deleted_rows AS deleted_rows;

SELECT
  JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.batchId')) AS remaining_batch_id,
  JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.filename')) AS remaining_filename,
  COUNT(*) AS remaining_history_rows
FROM esdc_participant_submission_history h
JOIN tmp_bill_trial_ilmp_batches_20260609 t
  ON JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.batchId')) = t.batch_id
 AND JSON_UNQUOTE(JSON_EXTRACT(h.event_details, '$.filename')) = t.filename
WHERE h.event_type = 'submitted'
GROUP BY remaining_batch_id, remaining_filename;

COMMIT;
