-- Guarded PROD feedback-log closeout for reports #154, #163, #165, and #166.
-- Scope is limited to admin_feedback_report, admin_feedback_status_history,
-- and admin_feedback_note. No client, case, application, message, document,
-- schema, runtime configuration, or external-provider data is changed.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @closeout_at := UTC_TIMESTAMP();

DROP PROCEDURE IF EXISTS prod_feedback_154_163_165_166_closeout_20260801;

DELIMITER //

CREATE PROCEDURE prod_feedback_154_163_165_166_closeout_20260801()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_evidence_count INT DEFAULT 0;
  DECLARE v_duplicate_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_report_count
    FROM admin_feedback_report
   WHERE (id = 154 AND report_type = 'bug' AND status = 'in_progress' AND summary = 'Deleted secure message')
      OR (id = 163 AND report_type = 'bug' AND status = 'triaging' AND summary = 'Email not received')
      OR (id = 165 AND report_type = 'bug' AND status = 'in_progress' AND summary = 'Action Plan')
      OR (id = 166 AND report_type = 'bug' AND status = 'in_progress' AND summary = 'Financial Overview');

  IF v_report_count <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_reports';
  END IF;

  SELECT COUNT(*)
    INTO v_evidence_count
    FROM admin_feedback_note
   WHERE (id = 488 AND report_id = 154 AND author_email = @actor_email)
      OR (id = 489 AND report_id = 163 AND author_email = @actor_email)
      OR (id = 490 AND report_id = 165 AND author_email = @actor_email)
      OR (id = 491 AND report_id = 166 AND author_email = @actor_email);

  IF v_evidence_count <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_evidence';
  END IF;

  SELECT COUNT(*)
    INTO v_duplicate_count
    FROM admin_feedback_note
   WHERE report_id IN (154, 163, 165, 166)
     AND author_email = @actor_email
     AND note_text LIKE 'Codex queue closeout 2026-08-01:%';

  IF v_duplicate_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_duplicate';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'resolved', updated_at = @closeout_at
   WHERE id = 154 AND status = 'in_progress';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_154_update';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'closed', updated_at = @closeout_at
   WHERE id = 163 AND status = 'triaging';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_163_update';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'resolved', updated_at = @closeout_at
   WHERE id = 165 AND status = 'in_progress';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_165_update';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'resolved', updated_at = @closeout_at
   WHERE id = 166 AND status = 'in_progress';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_166_update';
  END IF;

  INSERT INTO admin_feedback_status_history (
    report_id, previous_status, new_status, changed_by_staff_profile_id,
    changed_by_name, changed_by_email, changed_at
  ) VALUES
    (154, 'in_progress', 'resolved', NULL, @actor_name, @actor_email, @closeout_at),
    (163, 'triaging', 'closed', NULL, @actor_name, @actor_email, @closeout_at),
    (165, 'in_progress', 'resolved', NULL, @actor_name, @actor_email, @closeout_at),
    (166, 'in_progress', 'resolved', NULL, @actor_name, @actor_email, @closeout_at);

  IF ROW_COUNT() <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_history';
  END IF;

  INSERT INTO admin_feedback_note (
    report_id, author_staff_profile_id, author_name, author_email,
    note_text, created_at
  ) VALUES
    (
      154, NULL, @actor_name, @actor_email,
      'Codex queue closeout 2026-08-01: Resolved after technical delivery. Wrong-recipient secure message 1128 was contained and redacted, both mailbox copies remain deleted, and the secure-message withdrawal safeguards were deployed and live-verified under release 20260705-secure-message-batch. Any remaining privacy-governance follow-up belongs in the incident process rather than leaving the implemented bug open for staff confirmation. No message or client data changed in this closeout.',
      @closeout_at
    ),
    (
      163, NULL, @actor_name, @actor_email,
      'Codex queue closeout 2026-08-01: Closed as support-only, not an established PATH defect. PATH stored the secure messages for the intended active participant account and handed each separate notification email to AWS SES successfully on the first attempt with no PATH queue or provider-handoff error. Gmail inbox placement cannot be proven from PATH and recipient mailbox searching remains ordinary user support. No message, email, client, or provider data changed in this closeout.',
      @closeout_at
    ),
    (
      165, NULL, @actor_name, @actor_email,
      'Codex queue closeout 2026-08-01: Resolved after the guarded July 27 fiscal-period repair. Solana Henderson''s prior and renewal action plans/interventions were separated, the renewal intervention and funding evidence were restored to the correct period, and the orphaned returned revision was archived. The repair and independent verification completed successfully; the report is closed rather than held open solely for staff confirmation. No case or application data changed in this closeout.',
      @closeout_at
    ),
    (
      166, NULL, @actor_name, @actor_email,
      'Codex queue closeout 2026-08-01: Resolved after recovery and prevention delivery. The signed July 6 Financial Overview v1 was restored and its PDF object verified, the unnecessary v2 request was withdrawn, and the deployed preservation guard prevents the signed version-managed document from being archived by the legacy path. The report is closed rather than held open solely for staff confirmation. No document, signing, case, or application data changed in this closeout.',
      @closeout_at
    );

  IF ROW_COUNT() <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_notes';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_154_163_165_166_closeout_20260801();

DROP PROCEDURE IF EXISTS prod_feedback_154_163_165_166_closeout_20260801;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (154, 163, 165, 166)
 ORDER BY id;

SELECT id, report_id, previous_status, new_status,
       changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (154, 163, 165, 166)
 ORDER BY id DESC
 LIMIT 12;

SELECT id, report_id, author_name, author_email, created_at,
       LEFT(note_text, 1000) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (154, 163, 165, 166)
 ORDER BY id DESC
 LIMIT 12;
