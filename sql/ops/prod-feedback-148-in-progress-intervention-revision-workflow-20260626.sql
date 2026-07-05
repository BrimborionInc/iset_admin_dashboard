START TRANSACTION;

SET @report_id := 148;
SET @expected_status := 'triaging';

UPDATE admin_feedback_report
   SET status = 'in_progress'
 WHERE id = @report_id
   AND status = @expected_status
   AND submitted_by_email = 'emarion@nwac.ca'
   AND summary = 'Edit to an approved intervention';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email)
SELECT @report_id, @expected_status, 'in_progress', NULL, 'Codex', 'codex@openai.com'
 WHERE ROW_COUNT() = 1;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text)
VALUES
  (
    @report_id,
    NULL,
    'Codex',
    'codex@openai.com',
    'Codex triage 2026-06-26: Confirmed report #148 as a real two-step review workflow defect, not only training. Case 16 / application 54 has intervention revision draft 198 and proposal 320 in submitted state from Emilie Marion, but no iset_review_workflow row, no review workflow events, and no Case manager assessment v2/redline v2 documents. Root cause matches the RM draft-submit class: the UI allowed a Regional Manager to submit an intervention revision, but the shared transition helper denied Regional Manager starts for intervention_revision, after the route had already updated the row. Local fix prepared to allow Regional Managers acting as submitters to start supported application assessment, intervention proposal, and intervention revision workflows while keeping final Decision Maker decisions blocked. Existing Case 16 needs targeted recovery after/with release.'
  );

SELECT id, status, summary
  FROM admin_feedback_report
 WHERE id = @report_id;

SELECT id, report_id, previous_status, new_status, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 5;

SELECT id, report_id, author_name, created_at
  FROM admin_feedback_note
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 5;

COMMIT;
