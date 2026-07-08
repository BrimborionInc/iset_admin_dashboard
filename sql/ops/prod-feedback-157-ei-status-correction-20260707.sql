-- PROD feedback #157 targeted EI eligibility correction.
-- Scope:
-- - Updates only iset_application_assessment.esdc_eligibility for case 109 / application 27.
-- - Bumps the application row_version so browsers reload the changed assessment state.
-- - Adds a case event and feedback note.
-- - Moves feedback report #157 to in_progress.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

DROP PROCEDURE IF EXISTS prod_feedback_157_ei_status_correction;

DELIMITER //

CREATE PROCEDURE prod_feedback_157_ei_status_correction()
BEGIN
  DECLARE v_report_id INT DEFAULT 157;
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 109;
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 27;
  DECLARE v_assessment_id BIGINT UNSIGNED DEFAULT 30;
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_assessment_count INT DEFAULT 0;
  DECLARE v_action_plan_count INT DEFAULT 0;
  DECLARE v_intervention_count INT DEFAULT 0;
  DECLARE v_previous_report_status VARCHAR(32) DEFAULT NULL;
  DECLARE v_previous_eligibility VARCHAR(100) DEFAULT NULL;
  DECLARE v_event_summary VARCHAR(255) DEFAULT 'Corrected EI eligibility from EI Active Claim to EI Reach Back for feedback #157.';
  DECLARE v_note_text TEXT DEFAULT 'Codex data correction 2026-07-07: Per Bill approval, corrected case 109 / ISET-20260418-D6CEEE / application 27 assessment EI eligibility from EI Active Claim to EI Reach Back. Guard checks confirmed feedback report #157 belongs to emarion@nwac.ca, the target assessment row was still EI Active Claim, and the case had zero action-plan/intervention rows, so there were no active plan/reporting records to reconcile. Updated iset_application_assessment row 30 only for the eligibility value, bumped iset_application row_version for application 27, added a case data-repair event, and moved report #157 to in_progress pending the product/UI fix for authorized post-submission EI corrections.';

  START TRANSACTION;

  SELECT COUNT(*), MAX(status)
    INTO v_report_count, v_previous_report_status
    FROM admin_feedback_report
   WHERE id = v_report_id
     AND submitted_by_email = 'emarion@nwac.ca'
   FOR UPDATE;

  IF v_report_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_157_report';
  END IF;

  SELECT COUNT(*), MAX(ca.esdc_eligibility)
    INTO v_assessment_count, v_previous_eligibility
    FROM iset_case c
    JOIN iset_application a ON a.case_id = c.id
    JOIN iset_application_assessment ca ON ca.application_id = a.id
   WHERE c.id = v_case_id
     AND c.case_number = 'ISET-20260418-D6CEEE'
     AND a.id = v_application_id
     AND ca.id = v_assessment_id
     AND ca.case_id = v_case_id
     AND ca.esdc_eligibility = 'EI Active Claim'
   FOR UPDATE;

  IF v_assessment_count <> 1 OR v_previous_eligibility <> 'EI Active Claim' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_157_assessment';
  END IF;

  SELECT COUNT(*)
    INTO v_action_plan_count
    FROM iset_case_action_plan
   WHERE case_id = v_case_id
     AND archived_at IS NULL;

  IF v_action_plan_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_157_action_plan_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_intervention_count
    FROM iset_case_intervention
   WHERE case_id = v_case_id;

  IF v_intervention_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_157_intervention_exists';
  END IF;

  UPDATE iset_application_assessment
     SET esdc_eligibility = 'EI Reach Back',
         updated_at = NOW()
   WHERE id = v_assessment_id
     AND case_id = v_case_id
     AND application_id = v_application_id
     AND esdc_eligibility = 'EI Active Claim';

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_feedback_157_assessment';
  END IF;

  UPDATE iset_application
     SET row_version = row_version + 1,
         updated_at = NOW()
   WHERE id = v_application_id
     AND case_id = v_case_id;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_feedback_157_application_version';
  END IF;

  UPDATE esdc_participant_submission
     SET readiness_status = 'needs_review',
         readiness_summary = NULL,
         warnings = NULL,
         blocking_issues = NULL,
         last_validated_at = NULL,
         payload_snapshot = NULL,
         payload_checksum = NULL
   WHERE case_id = v_case_id
     AND application_id = v_application_id
     AND submission_status = 'pending';

  INSERT INTO iset_case_event
    (case_id, event_type, summary, payload_json, occurred_at, actor_staff_profile_id, actor_user_id, source_system)
  VALUES (
    v_case_id,
    'data_repair',
    v_event_summary,
    JSON_OBJECT(
      'feedbackReportId', v_report_id,
      'caseId', v_case_id,
      'applicationId', v_application_id,
      'assessmentId', v_assessment_id,
      'field', 'iset_application_assessment.esdc_eligibility',
      'previousValue', 'EI Active Claim',
      'newValue', 'EI Reach Back',
      'reason', 'Approved correction after updated EI evidence; no active action plan or intervention dependencies existed.'
    ),
    NOW(3),
    NULL,
    NULL,
    'codex_prod_sql'
  );

  IF v_previous_report_status <> 'in_progress' THEN
    UPDATE admin_feedback_report
       SET status = 'in_progress'
     WHERE id = v_report_id
       AND status = v_previous_report_status;

    INSERT INTO admin_feedback_status_history
      (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
    SELECT v_report_id, v_previous_report_status, 'in_progress', NULL, @actor_name, @actor_email, @note_at
     WHERE NOT EXISTS (
       SELECT 1
         FROM admin_feedback_status_history
        WHERE report_id = v_report_id
          AND previous_status = v_previous_report_status
          AND new_status = 'in_progress'
     );
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
  VALUES (v_report_id, NULL, @actor_name, @actor_email, v_note_text, @note_at);

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_157_ei_status_correction();

DROP PROCEDURE IF EXISTS prod_feedback_157_ei_status_correction;

SELECT
  c.id AS case_id,
  c.case_number,
  a.id AS application_id,
  a.row_version,
  ca.id AS assessment_id,
  ca.esdc_eligibility,
  ca.updated_at AS assessment_updated_at
FROM iset_case c
JOIN iset_application a ON a.case_id = c.id
JOIN iset_application_assessment ca ON ca.application_id = a.id
WHERE c.id = 109
  AND a.id = 27
  AND ca.id = 30;

SELECT
  id,
  status,
  summary,
  updated_at
FROM admin_feedback_report
WHERE id = 157;

SELECT
  report_id,
  previous_status,
  new_status,
  changed_by_name,
  changed_at
FROM admin_feedback_status_history
WHERE report_id = 157
ORDER BY changed_at DESC, id DESC
LIMIT 3;

SELECT
  id,
  report_id,
  author_name,
  created_at,
  LEFT(note_text, 900) AS note_excerpt
FROM admin_feedback_note
WHERE report_id = 157
ORDER BY id DESC
LIMIT 3;

SELECT
  id,
  case_id,
  event_type,
  summary,
  occurred_at,
  source_system
FROM iset_case_event
WHERE case_id = 109
  AND event_type = 'data_repair'
  AND summary = 'Corrected EI eligibility from EI Active Claim to EI Reach Back for feedback #157.'
ORDER BY id DESC
LIMIT 1;
