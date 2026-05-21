-- PROD feedback queue progress notes for Packet 2 ended-application cleanup.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @packet_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'in_progress', updated_at = @packet_at
 WHERE id IN (103, 105)
   AND status = 'triaging';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT src.report_id, 'triaging', 'in_progress', NULL, @actor_name, @actor_email, @packet_at
  FROM (
    SELECT 103 AS report_id
    UNION ALL SELECT 105
  ) src
 WHERE EXISTS (
   SELECT 1
     FROM admin_feedback_report afr
    WHERE afr.id = src.report_id
      AND afr.status = 'in_progress'
 )
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history afsh
      WHERE afsh.report_id = src.report_id
        AND afsh.previous_status = 'triaging'
        AND afsh.new_status = 'in_progress'
        AND afsh.changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 103, NULL, @actor_name, @actor_email,
       'Codex packet 2 2026-05-21: DEV code now avoids selecting ILMP participant submission rows tied to archived action plans and avoids resetting archived-plan submissions during case-level ILMP review. Case 127 currently has the correct denial-reporting plan/submission 46/106; stale archived-plan submission 21 should no longer be selected after deployment even if it remains in the audit table.',
       @packet_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 103 AND note_text LIKE 'Codex packet 2 2026-05-21:%'
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 105, NULL, @actor_name, @actor_email,
       'Codex packet 2 2026-05-21: Confirmed this is a withdrawn application, not a denial, so denial-reporting Employment Counselling / Career Research interventions should not be created. PROD data repair aligned case 94 to closed/withdrawn and completed the two stale withdrawal reminders. DEV code now recomputes withdrawn-only cases to closed/withdrawn so future withdrawals remain findable under Dormant/All client views after deployment.',
       @packet_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 105 AND note_text LIKE 'Codex packet 2 2026-05-21:%'
 );

COMMIT;
