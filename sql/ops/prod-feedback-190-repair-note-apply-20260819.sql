-- Guarded append-only repair note for PROD feedback #190.
-- The report is already planned; this does not change report status/history.

CREATE TEMPORARY TABLE tmp_feedback_190_repair_note_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
);

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 190
 FOR UPDATE;

SET @feedback_190_report_count := (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE admin_feedback_report.id = 190
     AND admin_feedback_report.report_type = 'bug'
     AND admin_feedback_report.severity = 'medium'
     AND admin_feedback_report.status = 'planned'
     AND admin_feedback_report.summary = 'Applicant replied message'
     AND admin_feedback_report.submitted_by_staff_profile_id = 55
     AND admin_feedback_report.submitted_at = '2026-08-19 13:23:49'
     AND admin_feedback_report.updated_at = '2026-08-19 13:48:08'
);

SET @feedback_190_existing_note_count := (
  SELECT COUNT(*)
    FROM admin_feedback_note
   WHERE admin_feedback_note.report_id = 190
     AND admin_feedback_note.note_text LIKE 'Codex repair closeout 2026-08-19:%'
);

SET @feedback_190_note_ready := (
  @feedback_190_report_count = 1
  AND @feedback_190_existing_note_count = 0
);

INSERT INTO tmp_feedback_190_repair_note_guard (guard_key)
VALUES ('repair_note_ready');

INSERT INTO tmp_feedback_190_repair_note_guard (guard_key)
SELECT 'repair_note_ready'
 WHERE @feedback_190_note_ready <> 1;

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text)
VALUES
  (
    190,
    NULL,
    'Codex',
    NULL,
    'Codex repair closeout 2026-08-19: Implemented the direction-aware admin reply fix locally. A staff follow-up that quotes a staff-origin sent item now preserves its existing applicant-facing sent/read state; only an applicant-origin target can be marked replied by the staff send route. The canonical admin aggregate passed 94 frontend suites / 522 tests and 54 backend/tooling suites / 530 tests; quiet lint, all 73 privacy-route checks, and the production build also passed. No code was deployed; the fix is ready for the next release. The guarded PROD data repair changed only messages.status for three fully evidenced false positives: 2573 to unread, 2587 to read, and report-linked 2590 to unread. Each had an exact later staff-send event quoting the target, with zero applicant-origin message rows and zero applicant-message events after it. Message content, actor links, mailbox rows/folders/deletion state, events, cases, applications, and notifications were unchanged. The first transaction failed closed before its UPDATE on a temporary-column collation mismatch and independent verification proved zero change; after live collation discovery, the exact read-only guard passed 3/3/3/0/0, the corrected transaction updated exactly three rows, and a separate read verified the committed states.'
  );

SET @feedback_190_inserted_note_count := ROW_COUNT();

INSERT INTO tmp_feedback_190_repair_note_guard (guard_key)
VALUES ('one_note_inserted');

INSERT INTO tmp_feedback_190_repair_note_guard (guard_key)
SELECT 'one_note_inserted'
 WHERE @feedback_190_inserted_note_count <> 1;

SELECT @feedback_190_report_count,
       @feedback_190_existing_note_count,
       @feedback_190_inserted_note_count;

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 190;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 190
 ORDER BY admin_feedback_note.id DESC
 LIMIT 1;

COMMIT;

DROP TEMPORARY TABLE tmp_feedback_190_repair_note_guard;
