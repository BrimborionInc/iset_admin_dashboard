-- Guarded PROD triage update for feedback #195.
-- Scope: feedback metadata only. No case, client, application, assessment,
-- ILMP, reporting, document, notification, or runtime row is mutated.
--
-- Required before execution:
--   * current-task PROD identity proof;
--   * current live DDL/columns/indexes for admin_feedback_report,
--     admin_feedback_status_history, and admin_feedback_note;
--   * reviewed preview showing the exact submitted report identity below.

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
 FOR UPDATE;

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
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'low'
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-24 17:20:24';

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
       'Codex triage 2026-08-24: Confirmed as a reproducible application-scope regression, not a training issue. The reported Regional Manager journey entered case 279 from ISET Clients at /cases/279, which intentionally carries no applicationId. Participant details saves by copying and resending the complete caseContext. When that existing context contains applicationDecisionLetters or another application-owned decision field, the backend correctly refuses the unscoped request before mutation with application_id_required_for_application_mutation, even when the staff edit itself is only the case postal code. The same caller mismatch can block other Participant details edits from any direct case-workspace entry; the ISET Clients table and several ILMP/import links use that entry shape. Severity raised to Medium because this blocks a required ILMP-readiness correction without evidence of data loss. Keep triaging. A fix must preserve the exact-application guard while separating case/client participant corrections from application-owned assessment/decision state or supplying an explicitly selected application where the operation truly owns that scope. Required scenarios: direct case and exact-application entry; single, repeat, and application-less cases; all authorized roles and object scope; no sibling-application mutation; ILMP revalidation; and correction after any prior export. Unresolved policy: which participant facts are the authoritative current case/client facts versus application-frozen facts, especially for repeat applications and ESDC correction/resubmission.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'low'
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-24 17:20:24';

UPDATE admin_feedback_report
   SET status = 'triaging',
       severity = 'medium'
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'low'
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-24 17:20:24';

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 195
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 195
 ORDER BY admin_feedback_note.id;
