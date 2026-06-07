-- PROD feedback queue entry for ILMP/manual-backload participant-data confusion.
-- Scope: admin_feedback_* tables only. No client/case/application/action-plan data is mutated.

DROP PROCEDURE IF EXISTS prod_feedback_ilmp_backload_fallback_bug_20260605;

DELIMITER //

CREATE PROCEDURE prod_feedback_ilmp_backload_fallback_bug_20260605()
BEGIN
  DECLARE v_report_id INT DEFAULT NULL;
  DECLARE v_summary VARCHAR(255) DEFAULT 'ILMP manual backloaded action plans do not reliably inherit participant/application facts';
  DECLARE v_note TEXT DEFAULT 'Initial Codex triage: Shayleen McNabb (ISET-20260410-78062A) exposed a data-flow bug. Participant Details can display application fallback values while root case Participant Details fields remain null, and Add Existing Action Plan does not fill action-plan-specific ILMP fields from the effective participant/application facts. Validation/export then correctly blocks the action plan because esdc_action_plan_json is missing education, barrier, EI claimant, social assistance, and previous employment NOC fields. Planned handling: guarded data-repair preview for safe facts, ask the case manager for genuine unknowns, and code changes to prevent recurrence.';

  START TRANSACTION;

  SELECT id
    INTO v_report_id
    FROM admin_feedback_report
   WHERE report_type = 'bug'
     AND summary = v_summary
   ORDER BY id DESC
   LIMIT 1
   FOR UPDATE;

  IF v_report_id IS NULL THEN
    INSERT INTO admin_feedback_report (
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
    VALUES (
      'bug',
      'high',
      'in_progress',
      v_summary,
      CONCAT(
        'ILMP reporting can become misleading for cases where a public application exists but an action plan is later added through Add Existing Action Plan/manual backload. ',
        'The Participant Details widget may display application fallback values, but those values are not necessarily persisted as root case Participant Details fields. ',
        'The action plan ILMP JSON also remains blank unless staff manually enter the Appendix A action-plan fields. ',
        'Observed on Shayleen McNabb, case ISET-20260410-78062A, action plan 53. ',
        'Fix requires a safe data repair for unambiguous fields and code changes so future backloaded plans prefill/require the right ILMP fields without hiding unresolved business facts.'
      ),
      1,
      'Bill Sillery',
      'bill@sillery.co.uk',
      'System Administrator',
      'ILMP Submissions & Exports',
      '/esdc/ilmp-submissions',
      NULL,
      JSON_OBJECT(
        'source', 'codex',
        'createdForCaseNumber', 'ISET-20260410-78062A',
        'createdForClient', 'Shayleen McNabb',
        'actionPlanId', 53,
        'identifiedAtUtc', UTC_TIMESTAMP(),
        'plannedWork', JSON_ARRAY(
          'guarded data-repair preview for safe fields',
          'case-manager request for EI claimant, barrier, and previous employment NOC/version',
          'code change for Add Existing Action Plan prefill/validation',
          'clarify or materialize Participant Details fallback values'
        )
      ),
      NOW(),
      NOW()
    );

    SET v_report_id = LAST_INSERT_ID();

    INSERT INTO admin_feedback_status_history (
      report_id,
      previous_status,
      new_status,
      changed_by_staff_profile_id,
      changed_by_name,
      changed_by_email,
      changed_at
    )
    VALUES (
      v_report_id,
      NULL,
      'in_progress',
      1,
      'Bill Sillery',
      'bill@sillery.co.uk',
      NOW()
    );
  ELSE
    UPDATE admin_feedback_report
       SET status = CASE
             WHEN status IN ('resolved', 'closed') THEN status
             ELSE 'in_progress'
           END,
           updated_at = NOW()
     WHERE id = v_report_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = v_report_id
       AND note_text = v_note
     LIMIT 1
  ) THEN
    INSERT INTO admin_feedback_note (
      report_id,
      author_staff_profile_id,
      author_name,
      author_email,
      note_text,
      created_at
    )
    VALUES (
      v_report_id,
      1,
      'Bill Sillery',
      'bill@sillery.co.uk',
      v_note,
      NOW()
    );
  END IF;

  COMMIT;

  SELECT
    r.id,
    r.report_type,
    r.severity,
    r.status,
    r.summary,
    r.submitted_by_name,
    r.submitted_at,
    r.updated_at
  FROM admin_feedback_report r
  WHERE r.id = v_report_id;
END //

DELIMITER ;

CALL prod_feedback_ilmp_backload_fallback_bug_20260605();

DROP PROCEDURE IF EXISTS prod_feedback_ilmp_backload_fallback_bug_20260605;
