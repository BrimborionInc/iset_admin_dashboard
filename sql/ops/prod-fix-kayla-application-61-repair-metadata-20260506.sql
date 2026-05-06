-- PROD data repair metadata follow-up for application ISET-20260505-4ED405.
-- Restore point: path-prod-kayla-app61-20260506132058
-- Main repair script already populated the UI-facing answers and assignment.
-- This follow-up embeds the audit metadata and personal display object in
-- iset_application.payload_json using parent-object paths MySQL will create.

DELIMITER //

DROP PROCEDURE IF EXISTS prod_fix_kayla_application_61_metadata//

CREATE PROCEDURE prod_fix_kayla_application_61_metadata()
BEGIN
  DECLARE v_reference VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ISET-20260505-4ED405';
  DECLARE v_snapshot_id VARCHAR(128) DEFAULT 'path-prod-kayla-app61-20260506132058';
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 61;
  DECLARE v_submission_id BIGINT UNSIGNED DEFAULT 61;
  DECLARE v_client_id BIGINT UNSIGNED DEFAULT 160;
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 138;
  DECLARE v_updates INT DEFAULT 0;

  START TRANSACTION;

  UPDATE iset_application a
  JOIN iset_application_submission s ON s.id = a.submission_id
  JOIN iset_case c ON c.id = a.case_id
  JOIN client cl ON cl.id = a.client_id
     SET a.payload_json = JSON_SET(
           COALESCE(a.payload_json, JSON_OBJECT()),
           '$.personal',
           JSON_OBJECT(
             'first_name', cl.first_name,
             'last_name', cl.last_name,
             'full_name', CONCAT_WS(' ', cl.first_name, cl.last_name)
           ),
           '$.dataRepair',
           JSON_OBJECT(
             'kaylaApp61',
             JSON_OBJECT(
               'restorePoint', v_snapshot_id,
               'repairedAt', UTC_TIMESTAMP(3),
               'reason', 'Submission payload contained only final upload/submission fields; display/routing facts were derived from linked client record.',
               'originalSubmissionPayloadPreserved', TRUE
             )
           )
         ),
         a.updated_at = NOW(),
         a.row_version = COALESCE(a.row_version, 0) + 1
   WHERE a.id = v_application_id
     AND a.submission_id = v_submission_id
     AND a.client_id = v_client_id
     AND a.case_id = v_case_id
     AND BINARY s.reference_number = BINARY v_reference
     AND BINARY c.case_number = BINARY v_reference
     AND c.assigned_staff_profile_id = 51
     AND c.portfolio_region_id = 1
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."first-name"')) = BINARY 'Kayla'
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."last-name"')) = BINARY 'Gladue'
     AND BINARY JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."address-province"')) = BINARY 'ab';

  SET v_updates = ROW_COUNT();

  IF v_updates <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'metadata_update_count_failed_kayla_application_61';
  END IF;

  COMMIT;

  SELECT
    v_reference AS reference_number,
    v_snapshot_id AS restore_point,
    v_updates AS application_rows_updated;
END//

CALL prod_fix_kayla_application_61_metadata()//

DROP PROCEDURE IF EXISTS prod_fix_kayla_application_61_metadata//

DELIMITER ;
