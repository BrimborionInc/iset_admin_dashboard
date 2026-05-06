-- PROD data repair for application ISET-20260505-4ED405.
-- Restore point: path-prod-kayla-app61-20260506132058
-- Purpose:
--   - Preserve the damaged submitted payload as-is.
--   - Add proven client-derived display/routing facts to iset_application.payload_json.
--   - Assign the case using the existing AB auto-assignment target.
--   - Mark the case's province region as Alberta for regional filtering.

DELIMITER //

DROP PROCEDURE IF EXISTS prod_fix_kayla_application_61//

CREATE PROCEDURE prod_fix_kayla_application_61()
BEGIN
  DECLARE v_reference VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ISET-20260505-4ED405';
  DECLARE v_snapshot_id VARCHAR(128) DEFAULT 'path-prod-kayla-app61-20260506132058';
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 61;
  DECLARE v_submission_id BIGINT UNSIGNED DEFAULT 61;
  DECLARE v_client_id BIGINT UNSIGNED DEFAULT 160;
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 138;
  DECLARE v_assignee_id BIGINT UNSIGNED DEFAULT 51;
  DECLARE v_region_id TINYINT UNSIGNED DEFAULT 1;
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_app_updates INT DEFAULT 0;
  DECLARE v_case_updates INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application a
    JOIN iset_application_submission s ON s.id = a.submission_id
    JOIN iset_case c ON c.id = a.case_id
    JOIN client cl ON cl.id = a.client_id
   WHERE a.id = v_application_id
     AND a.submission_id = v_submission_id
     AND a.client_id = v_client_id
     AND a.case_id = v_case_id
     AND BINARY s.reference_number = BINARY v_reference
     AND BINARY c.case_number = BINARY v_reference
     AND c.assigned_staff_profile_id IS NULL
     AND BINARY cl.first_name = BINARY 'Kayla'
     AND BINARY cl.last_name = BINARY 'Gladue'
     AND BINARY LOWER(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province'))) = BINARY 'ab'
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$.legal_submission_sig.name')) = BINARY 'Kayla Gladue'
     AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."first-name"')), '') IS NULL
     AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$."address-province"')), '') IS NULL;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_kayla_application_61';
  END IF;

  UPDATE iset_application a
  JOIN iset_application_submission s ON s.id = a.submission_id
  JOIN client cl ON cl.id = a.client_id
     SET a.payload_json = JSON_SET(
           JSON_SET(
             COALESCE(a.payload_json, JSON_OBJECT()),
             '$.answers',
             JSON_MERGE_PATCH(
               COALESCE(s.intake_payload, JSON_OBJECT()),
               JSON_OBJECT(
                 'first-name', cl.first_name,
                 'last-name', cl.last_name,
                 'address-province', LOWER(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province'))),
                 'contact-email-address', JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.contact.email')),
                 'phone-number', JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.contact.phone'))
               )
             )
           ),
           '$.personal.first_name', cl.first_name,
           '$.personal.last_name', cl.last_name,
           '$.personal.full_name', CONCAT_WS(' ', cl.first_name, cl.last_name),
           '$.dataRepair.kaylaApp61.restorePoint', v_snapshot_id,
           '$.dataRepair.kaylaApp61.repairedAt', UTC_TIMESTAMP(3),
           '$.dataRepair.kaylaApp61.reason', 'Submission payload contained only final upload/submission fields; display/routing facts were derived from linked client record.',
           '$.dataRepair.kaylaApp61.originalSubmissionPayloadPreserved', TRUE
         ),
         a.updated_at = NOW(),
         a.row_version = COALESCE(a.row_version, 0) + 1
   WHERE a.id = v_application_id
     AND a.submission_id = v_submission_id
     AND a.client_id = v_client_id
     AND a.case_id = v_case_id;

  SET v_app_updates = ROW_COUNT();

  UPDATE iset_case
     SET assigned_staff_profile_id = v_assignee_id,
         portfolio_region_id = v_region_id,
         updated_at = NOW()
   WHERE id = v_case_id
     AND BINARY case_number = BINARY v_reference
     AND assigned_staff_profile_id IS NULL;

  SET v_case_updates = ROW_COUNT();

  IF v_app_updates <> 1 OR v_case_updates <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_count_failed_kayla_application_61';
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    actor_staff_profile_id,
    actor_user_id,
    source_system
  )
  VALUES (
    v_case_id,
    'data_repair',
    'Application display and assignment repaired from linked client record.',
    JSON_OBJECT(
      'snapshot_id', v_snapshot_id,
      'reference_number', v_reference,
      'application_id', v_application_id,
      'submission_id', v_submission_id,
      'client_id', v_client_id,
      'assigned_staff_profile_id', v_assignee_id,
      'portfolio_region_id', v_region_id,
      'note', 'Submitted payload was missing core applicant/province fields; original submission payload was not modified.'
    ),
    UTC_TIMESTAMP(3),
    NULL,
    NULL,
    'codex_prod_data_repair'
  );

  INSERT INTO iset_event_entry (
    id,
    category,
    event_type,
    severity,
    source,
    subject_type,
    subject_id,
    actor_type,
    actor_id,
    actor_display_name,
    payload_json,
    tracking_id,
    captured_by,
    captured_at,
    ingested_at
  )
  VALUES (
    UUID(),
    'application_submission',
    'data_repaired',
    'info',
    'admin',
    'case',
    CAST(v_case_id AS CHAR),
    'system',
    NULL,
    'Codex PROD data repair',
    JSON_OBJECT(
      'snapshot_id', v_snapshot_id,
      'reference_number', v_reference,
      'application_id', v_application_id,
      'submission_id', v_submission_id,
      'client_id', v_client_id,
      'assigned_staff_profile_id', v_assignee_id,
      'portfolio_region_id', v_region_id,
      'message', 'Application display and assignment repaired from linked client record; original submission payload preserved.'
    ),
    v_reference,
    'codex',
    UTC_TIMESTAMP(3),
    UTC_TIMESTAMP(3)
  );

  COMMIT;

  SELECT
    v_reference AS reference_number,
    v_snapshot_id AS restore_point,
    v_app_updates AS application_rows_updated,
    v_case_updates AS case_rows_updated;
END//

CALL prod_fix_kayla_application_61()//

DROP PROCEDURE IF EXISTS prod_fix_kayla_application_61//

DELIMITER ;
