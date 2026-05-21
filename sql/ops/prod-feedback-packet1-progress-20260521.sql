-- PROD feedback queue progress notes for Packet 1 ILMP validation fixes.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @packet_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'in_progress', updated_at = @packet_at
 WHERE id IN (101, 102, 104)
   AND status = 'planned';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT src.report_id, 'planned', 'in_progress', NULL, @actor_name, @actor_email, @packet_at
  FROM (
    SELECT 101 AS report_id
    UNION ALL SELECT 102
    UNION ALL SELECT 104
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
        AND afsh.previous_status = 'planned'
        AND afsh.new_status = 'in_progress'
        AND afsh.changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 101, NULL, @actor_name, @actor_email,
       'Codex packet 1 2026-05-21: DEV code now keeps future-dated active plans non-reportable while avoiding the misleading "At least one intervention is required" blocker when linked planned/draft intervention records exist. Validation copy now says linked interventions exist but are not ILMP-reportable yet. Pending deployment and PROD revalidation before this can be resolved.',
       @packet_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 101 AND note_text LIKE 'Codex packet 1 2026-05-21:%'
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 102, NULL, @actor_name, @actor_email,
       'Codex packet 1 2026-05-21: DEV code now normalizes current intake/case barrier values including funding, location, lack-of-job-opportunities, other, and health variants through a shared ILMP barrier mapper used by validation and payload generation. Pending deployment and PROD revalidation before this can be resolved.',
       @packet_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 102 AND note_text LIKE 'Codex packet 1 2026-05-21:%'
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 104, NULL, @actor_name, @actor_email,
       'Codex packet 1 2026-05-21: DEV code now collects NOC/version lookup candidates from snake_case and camelCase action-plan/intervention fields, including related_noc/related_noc_version, relatedNoc/relatedNocVersion, and noc/nocVersion before checking active noc_code rows. This should clear the false invalid NOC blocker for case 73 / 2021:42201 and duplicate report 106 / 2021:33109 after deployment and revalidation.',
       @packet_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 104 AND note_text LIKE 'Codex packet 1 2026-05-21:%'
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 106, NULL, @actor_name, @actor_email,
       'Codex packet 1 2026-05-21: Covered by canonical report 104. DEV NOC lookup fix should also clear this duplicate case 49 / 2021:33109 false invalid blocker after deployment and revalidation.',
       @packet_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 106 AND note_text LIKE 'Codex packet 1 2026-05-21:%'
 );

COMMIT;
