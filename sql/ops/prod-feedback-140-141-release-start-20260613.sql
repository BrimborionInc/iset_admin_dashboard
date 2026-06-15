-- PROD release-start notes for reports #140 and #141 before release 20260612-212548.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260612-212548';

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_feedback_release_start (
  report_id INT PRIMARY KEY,
  note_text TEXT NOT NULL
) ENGINE=InnoDB;

INSERT INTO tmp_feedback_release_start (report_id, note_text)
VALUES
  (
    140,
    CONCAT(
      'Codex release-start update 2026-06-13: report #140 is included in PROD release ',
      @release_id,
      '. The release ships the System Administrator-only Case Workspace recovery action for reopening a closed action plan when circumstances change after closeout, with reason capture, ILMP validation/submission reset, internal note/audit event, and optional completed-intervention reopen for amendment. Keep this report in_progress until PROD smoke and targeted workflow verification complete.'
    )
  ),
  (
    141,
    CONCAT(
      'Codex release-start update 2026-06-13: report #141 is included in PROD release ',
      @release_id,
      '. The release ships the funding-revision-letter recovery path that creates the missing Client Funding Agreement draft from the selected action plan when an approved current amendment needs one and no draft exists. Keep this report in_progress until PROD smoke and targeted workflow/artifact verification complete.'
    )
  );

CREATE TEMPORARY TABLE tmp_feedback_release_status_change AS
SELECT r.id AS report_id,
       r.status AS previous_status
  FROM admin_feedback_report r
  JOIN tmp_feedback_release_start s ON s.report_id = r.id
 WHERE r.status <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT c.report_id, c.previous_status, 'in_progress', NULL, @actor_name, @actor_email, @note_at
  FROM tmp_feedback_release_status_change c
 WHERE c.previous_status <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = c.report_id
        AND h.new_status = 'in_progress'
        AND h.changed_by_name = @actor_name
        AND h.changed_at >= DATE_SUB(@note_at, INTERVAL 1 DAY)
   );

UPDATE admin_feedback_report r
JOIN tmp_feedback_release_start s ON s.report_id = r.id
   SET r.status = 'in_progress',
       r.updated_at = @note_at
 WHERE r.status <> 'in_progress';

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT s.report_id, NULL, @actor_name, @actor_email, s.note_text, @note_at
  FROM tmp_feedback_release_start s
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report r WHERE r.id = s.report_id)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note n
      WHERE n.report_id = s.report_id
        AND n.note_text = s.note_text
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (140, 141)
 ORDER BY id;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (140, 141)
 ORDER BY id DESC
 LIMIT 4;
