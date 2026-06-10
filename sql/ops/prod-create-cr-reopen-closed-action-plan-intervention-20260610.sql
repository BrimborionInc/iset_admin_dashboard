DROP PROCEDURE IF EXISTS prod_create_cr_reopen_closed_action_plan_intervention_20260610;

DELIMITER //

CREATE PROCEDURE prod_create_cr_reopen_closed_action_plan_intervention_20260610()
BEGIN
  DECLARE v_existing_id INT DEFAULT NULL;
  DECLARE v_report_id INT DEFAULT NULL;
  DECLARE v_bill_staff_id BIGINT UNSIGNED DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT id
    INTO v_bill_staff_id
    FROM staff_profiles
   WHERE email = 'bill@sillery.co.uk'
     AND status = 'active'
   LIMIT 1
   FOR UPDATE;

  SELECT id
    INTO v_existing_id
    FROM admin_feedback_report
   WHERE report_type = 'change_request'
     AND summary = 'Add admin recovery action to reopen closed plan/intervention for amendment'
   ORDER BY id DESC
   LIMIT 1
   FOR UPDATE;

  IF v_existing_id IS NULL THEN
    INSERT INTO admin_feedback_report
      (
        report_type,
        severity,
        status,
        summary,
        description,
        submitted_by_staff_profile_id,
        submitted_by_name,
        submitted_by_email,
        submitted_by_role,
        page_title,
        page_path,
        page_url,
        context_json,
        submitted_at,
        updated_at
      )
    VALUES
      (
        'change_request',
        'medium',
        'submitted',
        'Add admin recovery action to reopen closed plan/intervention for amendment',
        'Add a restricted recovery workflow for genuine change-in-circumstances cases where staff closed an action plan and intervention in good faith, then later need to propose additional funding through the existing intervention amendment/revision workflow. The UI should provide a System Administrator or otherwise tightly permissioned quick action to reopen the case/action plan/intervention safely, require a reason, write an audit event/internal note, reset ILMP readiness as needed, and avoid direct database repair. Example trigger: Joanna Nevers CASE-2026-0000076 was closed out, then extra funding was needed to get the participant over the line; the action plan and intervention had to be reopened in PROD so Emilie could propose an amendment.',
        v_bill_staff_id,
        'Bill Sillery',
        'bill@sillery.co.uk',
        'System Administrator',
        'Case Workspace',
        '/cases/76',
        NULL,
        CAST(JSON_OBJECT(
          'path', '/cases/76',
          'caseNumber', 'CASE-2026-0000076',
          'clientName', 'Joanna Nevers',
          'source', 'codex-prod-data-repair-follow-up',
          'relatedReportId', 135,
          'requestedBy', 'Bill Sillery',
          'createdFromThreadDate', '2026-06-10'
        ) AS JSON),
        NOW(),
        NOW()
      );

    SET v_report_id = LAST_INSERT_ID();

    INSERT INTO admin_feedback_status_history
      (
        report_id,
        previous_status,
        new_status,
        changed_by_staff_profile_id,
        changed_by_name,
        changed_by_email,
        changed_at
      )
    VALUES
      (
        v_report_id,
        NULL,
        'submitted',
        v_bill_staff_id,
        'Bill Sillery',
        'bill@sillery.co.uk',
        NOW()
      );

    INSERT INTO admin_feedback_note
      (
        report_id,
        author_staff_profile_id,
        author_name,
        author_email,
        note_text,
        created_at
      )
    VALUES
      (
        v_report_id,
        v_bill_staff_id,
        'Bill Sillery',
        'bill@sillery.co.uk',
        'Created by Codex at Bill''s request after PROD data repair for Joanna Nevers / CASE-2026-0000076. This is adjacent to CR #135, which covers amendment cost comparison/display. This new CR is specifically for the missing recovery workflow: when a case/action plan/intervention was legitimately closed and later needs an intervention amendment, a restricted UI action should reopen the necessary records with reason capture, audit trail, and ILMP readiness reset instead of requiring direct SQL.',
        NOW()
      );
  ELSE
    SET v_report_id = v_existing_id;
  END IF;

  COMMIT;

  SELECT v_report_id AS report_id;
END//

DELIMITER ;

CALL prod_create_cr_reopen_closed_action_plan_intervention_20260610();

DROP PROCEDURE IF EXISTS prod_create_cr_reopen_closed_action_plan_intervention_20260610;
