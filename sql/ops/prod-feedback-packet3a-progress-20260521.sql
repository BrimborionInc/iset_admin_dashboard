-- PROD feedback queue update for Packet 3A on 2026-05-21.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SET @previous_status_99 := (SELECT status FROM admin_feedback_report WHERE id = 99);

UPDATE admin_feedback_report
   SET status = 'in_progress', updated_at = @note_at
 WHERE id = 99
   AND status NOT IN ('in_progress', 'resolved', 'closed');

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 99, @previous_status_99, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_99 IS NOT NULL
   AND @previous_status_99 NOT IN ('in_progress', 'resolved', 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 99
        AND previous_status = @previous_status_99
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 99, NULL, @actor_name, @actor_email,
       'Codex packet 3A 2026-05-21: DEV code now keeps approvers on the Application Assessment "Approval and decision" step after committing an approval or denial, shows a recorded-decision confirmation, and exposes approval/denial-letter preparation as an explicit follow-up action instead of automatically moving the approver into letter writing. Pending deployment and PROD revalidation before this canonical decision-screen UX item should be resolved.',
       @note_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 99
      AND note_text LIKE 'Codex packet 3A 2026-05-21:%'
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 107, NULL, @actor_name, @actor_email,
       'Codex packet 3A 2026-05-21: DEV implementation has been attached to canonical report 99. The fix keeps the approver on the decision screen after approval/denial commit and makes letter preparation a separate explicit follow-up. This duplicate remains closed; revalidate through report 99 after deployment.',
       @note_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 107
      AND note_text LIKE 'Codex packet 3A 2026-05-21:%'
 );

COMMIT;
