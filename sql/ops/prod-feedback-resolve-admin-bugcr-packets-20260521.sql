-- PROD feedback queue resolution after admin release 20260521-prod-admin-bugcr-packets.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();
SET @release_id := '20260521-prod-admin-bugcr-packets';

CREATE TEMPORARY TABLE IF NOT EXISTS tmp_feedback_resolution (
  report_id INT PRIMARY KEY,
  previous_status VARCHAR(32),
  note_text TEXT NOT NULL
);

DELETE FROM tmp_feedback_resolution;

INSERT INTO tmp_feedback_resolution (report_id, previous_status, note_text)
SELECT r.id, r.status,
       CASE r.id
         WHEN 99 THEN CONCAT('Codex deploy 2026-05-21: PROD admin release ', @release_id, ' is live and admin health smoke passed. Application approval/denial commits now remain on the Approval and decision step and offer letter preparation as an explicit follow-up action. Resolving canonical decision-screen UX report; duplicate report 107 remains closed.')
         WHEN 101 THEN CONCAT('Codex deploy 2026-05-21: PROD admin release ', @release_id, ' is live and admin health smoke passed. Future-dated action plans remain non-reportable by rule, but validation now gives the clearer linked-intervention-not-reportable-yet guidance instead of incorrectly saying no intervention exists. Resolving after deployment.')
         WHEN 102 THEN CONCAT('Codex deploy 2026-05-21: PROD admin release ', @release_id, ' is live and admin health smoke passed. ILMP barrier validation now maps current PATH barrier values such as funding, location, lack-of-job-opportunities, other, and health variants to ESDC barrier codes. Resolving after deployment.')
         WHEN 103 THEN CONCAT('Codex deploy 2026-05-21: PROD admin release ', @release_id, ' is live and admin health smoke passed. Case 127 still retains archived historical participant submission 21 for audit, while current submission 106 is tied to non-archived action plan 46; deployed lookup/reset code ignores archived-plan submissions for current validation. Resolving after deployment/recheck.')
         WHEN 104 THEN CONCAT('Codex deploy 2026-05-21: PROD admin release ', @release_id, ' is live and admin health smoke passed. ILMP NOC validation now checks stored related NOC fields across snake_case and camelCase action-plan/intervention payloads before validating against active NOC rows. Resolving canonical NOC validation report; duplicate report 106 remains closed.')
         WHEN 105 THEN CONCAT('Codex deploy 2026-05-21: PROD admin release ', @release_id, ' is live and admin health smoke passed. Shayleen McNabb case 94 is confirmed closed/withdrawn in PROD, and future withdrawn-only cases now align to closed/withdrawn. Withdrawal remains distinct from denial, so no denial-reporting interventions are created. Resolving after deployment/recheck.')
       END
  FROM admin_feedback_report r
 WHERE r.id IN (99, 101, 102, 103, 104, 105)
   AND r.status <> 'resolved';

START TRANSACTION;

UPDATE admin_feedback_report r
  JOIN tmp_feedback_resolution t ON t.report_id = r.id
   SET r.status = 'resolved',
       r.updated_at = @resolved_at
 WHERE r.status <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT t.report_id, t.previous_status, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
  FROM tmp_feedback_resolution t
 WHERE t.previous_status <> 'resolved'
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history h
      WHERE h.report_id = t.report_id
        AND h.previous_status = t.previous_status
        AND h.new_status = 'resolved'
        AND h.changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT t.report_id, NULL, @actor_name, @actor_email, t.note_text, @resolved_at
  FROM tmp_feedback_resolution t
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note n
    WHERE n.report_id = t.report_id
      AND n.note_text LIKE CONCAT('Codex deploy 2026-05-21: PROD admin release ', @release_id, '%')
 );

COMMIT;

SELECT id, status, updated_at
  FROM admin_feedback_report
 WHERE id IN (96, 97, 98, 99, 101, 102, 103, 104, 105, 107)
 ORDER BY id;
