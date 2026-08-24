-- Read-only exact guard preflight for the #182/#193 duplicate triage apply.
-- A successful preflight returns one row from each SELECT and no rows from
-- the final three drift checks. Run immediately before the guarded apply.

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 182
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'in_progress'
   AND admin_feedback_report.summary = 'Alyssa''s Approval Letter'
   AND admin_feedback_report.description = 'Hi Bill. I am trying to send Alyssa her approval letter but I am receiving 2-error bugs.'
   AND admin_feedback_report.submitted_by_staff_profile_id = 60
   AND admin_feedback_report.submitted_by_email = 'iset@mmvi.ca'
   AND admin_feedback_report.page_path = '/application-case/109?entry=approval&approvalType=application&step=communication&applicationId=27'
   AND admin_feedback_report.submitted_at = '2026-08-10 18:10:36'
   AND admin_feedback_report.updated_at = '2026-08-10 21:02:05';

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 193
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.summary = 'Alyssa''s File'
   AND admin_feedback_report.description = 'Hi Bill,\r\n\r\nI invitationally submitted a bug on August 11th because the approval letter wasn''t sending to Alyssa. Going back into her file now, it looks like it sent to her but I want to ensure because i am still stuck at step 14 on the assessment which is the letter'
   AND admin_feedback_report.submitted_by_staff_profile_id = 60
   AND admin_feedback_report.submitted_by_email = 'iset@mmvi.ca'
   AND admin_feedback_report.page_path = '/application-case/109?entry=approval&approvalType=application&step=communication&applicationId=27'
   AND admin_feedback_report.submitted_at = '2026-08-21 15:15:54'
   AND admin_feedback_report.updated_at = '2026-08-21 15:15:54';

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id IN (182, 193)
   AND admin_feedback_status_history.id NOT IN (588, 589, 619);

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 182
   AND admin_feedback_note.id <> 531;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 193;
