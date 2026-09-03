-- Guarded emergency recovery for the feedback #198 planned-status update.
-- Use only if that update itself is found to be incorrect. The original audit
-- rows remain preserved; this appends a recovery transition and note.
-- Exact verified apply revision: report updated_at 2026-09-02 14:50:05,
-- status-history id 643, implementation-note id 569.

START TRANSACTION;

SET @path_feedback_198_recovery_history_id = 0;
SET @path_feedback_198_recovery_note_id = 0;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_role,
       admin_feedback_report.page_path,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 198
 FOR UPDATE;

SET @path_feedback_198_recovery_guard_count = (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE admin_feedback_report.id = 198
     AND admin_feedback_report.report_type = 'bug'
     AND admin_feedback_report.severity = 'medium'
     AND admin_feedback_report.status = 'planned'
     AND admin_feedback_report.summary = 'Unable to Withdraw Application'
     AND admin_feedback_report.submitted_by_staff_profile_id = 60
     AND admin_feedback_report.submitted_by_role = 'ISET Coordinator'
     AND admin_feedback_report.page_path = '/application-case/292?applicationId=233'
     AND admin_feedback_report.updated_at = '2026-09-02 14:50:05'
     AND (
       SELECT MAX(admin_feedback_status_history.id)
         FROM admin_feedback_status_history
        WHERE admin_feedback_status_history.report_id = admin_feedback_report.id
     ) = (
       SELECT MAX(admin_feedback_status_history.id)
        FROM admin_feedback_status_history
        WHERE admin_feedback_status_history.id = 643
          AND admin_feedback_status_history.report_id = admin_feedback_report.id
          AND admin_feedback_status_history.previous_status = 'triaging'
          AND admin_feedback_status_history.new_status = 'planned'
          AND admin_feedback_status_history.changed_by_name = 'Codex (feedback-198-planned-20260902-r1)'
     )
     AND EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.id = 569
          AND admin_feedback_note.report_id = admin_feedback_report.id
          AND admin_feedback_note.author_name = 'Codex'
          AND admin_feedback_note.note_text = 'Product defect confirmed and local fix prepared on 2026-09-02. Application withdrawal now atomically moves any pre-final application-assessment workflow to withdrawn with no owner using the distinct withdraw_application action, requires a reason, preserves the submitted packet and review history, and retains existing escalation, exact-application reporting, row-version, and case-recompute effects. Final-decision and mixed workflow requests fail closed; reopening does not reactivate the review. Local gates passed: 104 frontend suites/672 tests, 69 backend suites/817 tests, lint with 0 errors, privacy-route smoke, optimized production build, and application-assessment browser workflow smoke. No deployment or client/case/application data change has occurred. Next: deploy the exact source to TEST, run the ISET Coordinator returned-to-submitter withdrawal journey and verify application/review/audit/reporting/escalation/sibling scope; then seek approved PROD deployment and repeat the reporter-role check.'
     )
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
       'triaging',
       NULL,
       'Codex (feedback-198-recovery-20260902-r1)',
       NULL
  FROM admin_feedback_report
 WHERE @path_feedback_198_recovery_guard_count = 1
   AND admin_feedback_report.id = 198
   AND admin_feedback_report.status = 'planned';
SET @path_feedback_198_recovery_history_count = ROW_COUNT();
SET @path_feedback_198_recovery_history_id = LAST_INSERT_ID();

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
       'Codex recovery 2026-09-02: Restored feedback #198 to triaging because its planned-status update required recovery. The product investigation, implementation note, and earlier status history remain as audit evidence; this operation changes no client, case, application, workflow, reporting, document, configuration, or notification data.'
  FROM admin_feedback_report
 WHERE @path_feedback_198_recovery_guard_count = 1
   AND @path_feedback_198_recovery_history_count = 1
   AND admin_feedback_report.id = 198
   AND admin_feedback_report.status = 'planned';
SET @path_feedback_198_recovery_note_count = ROW_COUNT();
SET @path_feedback_198_recovery_note_id = LAST_INSERT_ID();

UPDATE admin_feedback_report
   SET status = 'triaging'
 WHERE @path_feedback_198_recovery_guard_count = 1
   AND @path_feedback_198_recovery_history_count = 1
   AND @path_feedback_198_recovery_note_count = 1
   AND admin_feedback_report.id = 198
   AND admin_feedback_report.status = 'planned';
SET @path_feedback_198_recovery_update_count = ROW_COUNT();

DELETE FROM admin_feedback_note
 WHERE @path_feedback_198_recovery_update_count <> 1
   AND admin_feedback_note.id = @path_feedback_198_recovery_note_id
   AND admin_feedback_note.report_id = 198
   AND admin_feedback_note.author_name = 'Codex'
   AND admin_feedback_note.note_text = 'Codex recovery 2026-09-02: Restored feedback #198 to triaging because its planned-status update required recovery. The product investigation, implementation note, and earlier status history remain as audit evidence; this operation changes no client, case, application, workflow, reporting, document, configuration, or notification data.';
SET @path_feedback_198_recovery_note_cleanup_count = ROW_COUNT();

DELETE FROM admin_feedback_status_history
 WHERE @path_feedback_198_recovery_update_count <> 1
   AND admin_feedback_status_history.id = @path_feedback_198_recovery_history_id
   AND admin_feedback_status_history.report_id = 198
   AND admin_feedback_status_history.previous_status = 'planned'
   AND admin_feedback_status_history.new_status = 'triaging'
   AND admin_feedback_status_history.changed_by_name = 'Codex (feedback-198-recovery-20260902-r1)';
SET @path_feedback_198_recovery_history_cleanup_count = ROW_COUNT();

SELECT @path_feedback_198_recovery_guard_count,
       @path_feedback_198_recovery_history_count,
       @path_feedback_198_recovery_history_id,
       @path_feedback_198_recovery_note_count,
       @path_feedback_198_recovery_note_id,
       @path_feedback_198_recovery_update_count,
       @path_feedback_198_recovery_note_cleanup_count,
       @path_feedback_198_recovery_history_cleanup_count;

COMMIT;
