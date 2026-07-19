-- Record the completed DEV fix for PROD feedback #160 without implying deployment.

START TRANSACTION;

SET @report_id := 160;
SET @actor_id := 1;
SET @actor_name := 'Bill Sillery';
SET @actor_email := 'bill@sillery.co.uk';
SET @note := CONCAT(
  'Codex DEV implementation 2026-07-19: Prepared the Regional Manager reassignment policy fix locally. RMs can now assign or reassign a case they are authorized to access to any active staff member in the assignable pool, including another RM or an ISET Coordinator outside their region. ',
  'Existing source-case access rules remain unchanged. The shared backend target guard covers ordinary and conflict-driven reassignment; both assignment UIs show the cross-region pool; disabled Cognito users and inactive staff profiles are excluded/rejected. ',
  'Focused verification passed: backend syntax checks; caseAssignmentPolicy and caseAccess Jest suites (15 tests); focused ESLint; git diff --check; and the local case-assignment browser smoke, including cross-region RM visibility and steady-state request settling. ',
  'Report moved to planned. No TEST or PROD application deployment has occurred; TEST qualification and deployment are intentionally deferred until the 2026-07-19 feedback-review batch is complete.'
);

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT r.id, r.status, 'planned', @actor_id, @actor_name, @actor_email, NOW()
  FROM admin_feedback_report r
 WHERE r.id = @report_id
   AND r.status = 'triaging'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = r.id
        AND h.previous_status = 'triaging'
        AND h.new_status = 'planned'
   );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = NOW()
 WHERE id = @report_id
   AND status = 'triaging';

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT @report_id, @actor_id, @actor_name, @actor_email, @note, NOW()
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = @report_id)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note n
      WHERE n.report_id = @report_id
        AND n.note_text = @note
   );

COMMIT;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = @report_id;

SELECT previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 3;

SELECT author_name, note_text, created_at
  FROM admin_feedback_note
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 2;
