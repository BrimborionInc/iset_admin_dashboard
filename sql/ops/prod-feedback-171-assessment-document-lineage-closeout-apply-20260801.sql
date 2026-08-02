-- Guarded PROD closeout for feedback #171.
-- Scope: admin_feedback_report, admin_feedback_status_history, and
-- admin_feedback_note for report 171 only. No client, case, application,
-- assessment, document, schema, runtime-config, or external-provider change.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := UTC_TIMESTAMP();
SET @release_id := '20260801-assessment-document-lineage-r2';

DROP PROCEDURE IF EXISTS prod_feedback_171_closeout_20260801;

DELIMITER //

CREATE PROCEDURE prod_feedback_171_closeout_20260801()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_status VARCHAR(32) DEFAULT NULL;
  DECLARE v_prerelease_note_count INT DEFAULT 0;
  DECLARE v_note_text TEXT;

  SET v_note_text = CONCAT(
    'Codex resolved 2026-08-01 after deployed verification: Release ',
    @release_id,
    ' is live in PROD from admin commit aa2817711154f07ba051dc0af2d520383e066a12. ',
    'DEV qualification passed all 16 required gates; deployed TEST acceptance passed all 11 required gates under evidence fc1cb076aaa608e72134f36b58d4a41819f28e8b64c0b202393700af76d7dfc8 with zero fixture residue. ',
    'PROD manifest /home/bill/ISET/release-20260801-assessment-document-lineage-r2/admin-dashboard/tmp/path-deploy/prod/20260801-assessment-document-lineage-r2--2026-08-01T11-28-25-843Z.json records immutable admin artifact SHA-256 ca3b6dc0bf21acfb42250166e80c6a8ad612b079733c01698231fa2e4d1494ee and successful ASG refresh 33f8be0e-7dac-4e86-b139-b0e76ba4099d on replacement i-0ec48d0f0d226be2f. ',
    'All three public /readyz checks returned 200, both target groups are healthy, both PM2 services are online with zero restarts, and normal forwarding is restored. ',
    'Deployed read-only SSM check 825273d4-8ccd-4619-aa98-9513be371e92 evaluated Case 76 / Application 123 and returned preserveExistingFinancialOverview=false, proving that the older case-level Financial Overview no longer suppresses generation for the current application. ',
    'The fix also fails explicit Application Form and Financial Overview preservation closed unless an active document belongs to the exact application being submitted. ',
    'No client, case, application, assessment, or document data was changed; no schema, runtime configuration, email, AI, Finance, Intacct, or other provider operation ran. ',
    'Report #171 is closed immediately after verification per the standing instruction; no staff-confirmation hold is required.'
  );

  START TRANSACTION;

  SELECT COUNT(*), MAX(status)
    INTO v_report_count, v_status
    FROM admin_feedback_report
   WHERE id = 171
     AND report_type = 'bug'
     AND summary = 'Assessment Required'
     AND page_url = 'https://nwac-console.awentech.ca/application-case/76'
   FOR UPDATE;

  IF v_report_count <> 1 OR v_status <> 'planned' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_report';
  END IF;

  SELECT COUNT(*)
    INTO v_prerelease_note_count
    FROM admin_feedback_note
   WHERE report_id = 171
     AND id = 508
     AND author_email = @actor_email
     AND note_text LIKE 'Codex implementation and qualification update 2026-07-31:%';

  IF v_prerelease_note_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_prerelease_note';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = 171
       AND author_email = @actor_email
       AND note_text LIKE CONCAT('Codex resolved 2026-08-01 after deployed verification: Release ', @release_id, '%')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_duplicate_closeout';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'resolved',
         updated_at = @resolved_at
   WHERE id = 171
     AND status = 'planned';

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_update';
  END IF;

  INSERT INTO admin_feedback_status_history (
    report_id,
    previous_status,
    new_status,
    changed_by_staff_profile_id,
    changed_by_name,
    changed_by_email,
    changed_at
  ) VALUES (
    171,
    'planned',
    'resolved',
    NULL,
    @actor_name,
    @actor_email,
    @resolved_at
  );

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_history';
  END IF;

  INSERT INTO admin_feedback_note (
    report_id,
    author_staff_profile_id,
    author_name,
    author_email,
    note_text,
    created_at
  ) VALUES (
    171,
    NULL,
    @actor_name,
    @actor_email,
    v_note_text,
    @resolved_at
  );

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_note';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_171_closeout_20260801();

DROP PROCEDURE IF EXISTS prod_feedback_171_closeout_20260801;

SELECT id, report_type, severity, status, summary, page_url, updated_at
  FROM admin_feedback_report
 WHERE id = 171;

SELECT id, report_id, previous_status, new_status,
       changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 171
 ORDER BY id DESC
 LIMIT 5;

SELECT id, report_id, author_name, author_email, created_at,
       LEFT(note_text, 1200) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 171
 ORDER BY id DESC
 LIMIT 5;
