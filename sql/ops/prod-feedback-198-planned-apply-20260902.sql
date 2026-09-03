-- Guarded PROD feedback update for confirmed product defect #198.
-- Scope: feedback status/history/note only. No client, case, application,
-- workflow, reporting, document, configuration, or notification data changes.
--
-- Live metadata re-proved immediately before this artifact was prepared:
--   AWS account: 468278742295
--   database: iset_intake
--   server: MySQL 8.0.42 on ip-172-16-0-77:3306
--   user: app_admin@%
--   tables: admin_feedback_report, admin_feedback_status_history,
--           admin_feedback_note

START TRANSACTION;

SET @path_feedback_198_history_id = 0;
SET @path_feedback_198_note_id = 0;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_role,
       admin_feedback_report.page_title,
       admin_feedback_report.page_path,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 198
 FOR UPDATE;

SET @path_feedback_198_guard_count = (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE admin_feedback_report.id = 198
     AND admin_feedback_report.report_type = 'bug'
     AND admin_feedback_report.severity = 'medium'
     AND admin_feedback_report.status = 'triaging'
     AND admin_feedback_report.summary = 'Unable to Withdraw Application'
     AND admin_feedback_report.submitted_by_staff_profile_id = 60
     AND admin_feedback_report.submitted_by_role = 'ISET Coordinator'
     AND admin_feedback_report.page_title = 'Admin Console'
     AND admin_feedback_report.page_path = '/application-case/292?applicationId=233'
     AND admin_feedback_report.submitted_at = '2026-09-01 14:53:28'
     AND admin_feedback_report.updated_at = '2026-09-01 18:04:16'
);

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email)
SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       'planned',
       NULL,
       'Codex (feedback-198-planned-20260902-r1)',
       NULL
  FROM admin_feedback_report
 WHERE @path_feedback_198_guard_count = 1
   AND admin_feedback_report.id = 198
   AND admin_feedback_report.status = 'triaging';
SET @path_feedback_198_history_count = ROW_COUNT();
SET @path_feedback_198_history_id = LAST_INSERT_ID();

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text)
SELECT admin_feedback_report.id,
       NULL,
       'Codex',
       NULL,
       'Product defect confirmed and local fix prepared on 2026-09-02. Application withdrawal now atomically moves any pre-final application-assessment workflow to withdrawn with no owner using the distinct withdraw_application action, requires a reason, preserves the submitted packet and review history, and retains existing escalation, exact-application reporting, row-version, and case-recompute effects. Final-decision and mixed workflow requests fail closed; reopening does not reactivate the review. Local gates passed: 104 frontend suites/672 tests, 69 backend suites/817 tests, lint with 0 errors, privacy-route smoke, optimized production build, and application-assessment browser workflow smoke. No deployment or client/case/application data change has occurred. Next: deploy the exact source to TEST, run the ISET Coordinator returned-to-submitter withdrawal journey and verify application/review/audit/reporting/escalation/sibling scope; then seek approved PROD deployment and repeat the reporter-role check.'
  FROM admin_feedback_report
 WHERE @path_feedback_198_guard_count = 1
   AND @path_feedback_198_history_count = 1
   AND admin_feedback_report.id = 198
   AND admin_feedback_report.status = 'triaging';
SET @path_feedback_198_note_count = ROW_COUNT();
SET @path_feedback_198_note_id = LAST_INSERT_ID();

UPDATE admin_feedback_report
   SET status = 'planned'
 WHERE @path_feedback_198_guard_count = 1
   AND @path_feedback_198_history_count = 1
   AND @path_feedback_198_note_count = 1
   AND admin_feedback_report.id = 198
   AND admin_feedback_report.status = 'triaging'
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE admin_feedback_status_history.id = @path_feedback_198_history_id
        AND admin_feedback_status_history.report_id = admin_feedback_report.id
        AND admin_feedback_status_history.previous_status = 'triaging'
        AND admin_feedback_status_history.new_status = 'planned'
        AND admin_feedback_status_history.changed_by_name = 'Codex (feedback-198-planned-20260902-r1)'
   )
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE admin_feedback_note.id = @path_feedback_198_note_id
        AND admin_feedback_note.report_id = admin_feedback_report.id
        AND admin_feedback_note.author_name = 'Codex'
        AND admin_feedback_note.note_text = 'Product defect confirmed and local fix prepared on 2026-09-02. Application withdrawal now atomically moves any pre-final application-assessment workflow to withdrawn with no owner using the distinct withdraw_application action, requires a reason, preserves the submitted packet and review history, and retains existing escalation, exact-application reporting, row-version, and case-recompute effects. Final-decision and mixed workflow requests fail closed; reopening does not reactivate the review. Local gates passed: 104 frontend suites/672 tests, 69 backend suites/817 tests, lint with 0 errors, privacy-route smoke, optimized production build, and application-assessment browser workflow smoke. No deployment or client/case/application data change has occurred. Next: deploy the exact source to TEST, run the ISET Coordinator returned-to-submitter withdrawal journey and verify application/review/audit/reporting/escalation/sibling scope; then seek approved PROD deployment and repeat the reporter-role check.'
   );
SET @path_feedback_198_update_count = ROW_COUNT();

DELETE FROM admin_feedback_note
 WHERE @path_feedback_198_update_count <> 1
   AND admin_feedback_note.id = @path_feedback_198_note_id
   AND admin_feedback_note.report_id = 198
   AND admin_feedback_note.author_name = 'Codex'
   AND admin_feedback_note.note_text = 'Product defect confirmed and local fix prepared on 2026-09-02. Application withdrawal now atomically moves any pre-final application-assessment workflow to withdrawn with no owner using the distinct withdraw_application action, requires a reason, preserves the submitted packet and review history, and retains existing escalation, exact-application reporting, row-version, and case-recompute effects. Final-decision and mixed workflow requests fail closed; reopening does not reactivate the review. Local gates passed: 104 frontend suites/672 tests, 69 backend suites/817 tests, lint with 0 errors, privacy-route smoke, optimized production build, and application-assessment browser workflow smoke. No deployment or client/case/application data change has occurred. Next: deploy the exact source to TEST, run the ISET Coordinator returned-to-submitter withdrawal journey and verify application/review/audit/reporting/escalation/sibling scope; then seek approved PROD deployment and repeat the reporter-role check.';
SET @path_feedback_198_note_cleanup_count = ROW_COUNT();

DELETE FROM admin_feedback_status_history
 WHERE @path_feedback_198_update_count <> 1
   AND admin_feedback_status_history.id = @path_feedback_198_history_id
   AND admin_feedback_status_history.report_id = 198
   AND admin_feedback_status_history.previous_status = 'triaging'
   AND admin_feedback_status_history.new_status = 'planned'
   AND admin_feedback_status_history.changed_by_name = 'Codex (feedback-198-planned-20260902-r1)';
SET @path_feedback_198_history_cleanup_count = ROW_COUNT();

SELECT @path_feedback_198_guard_count,
       @path_feedback_198_history_count,
       @path_feedback_198_history_id,
       @path_feedback_198_note_count,
       @path_feedback_198_note_id,
       @path_feedback_198_update_count,
       @path_feedback_198_note_cleanup_count,
       @path_feedback_198_history_cleanup_count;

COMMIT;
