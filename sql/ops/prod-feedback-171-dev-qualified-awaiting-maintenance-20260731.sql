-- Record DEV qualification and the remaining maintenance-window work for feedback #171.
-- Scope: one guarded admin_feedback_note row only; report status remains planned.

SET @report_id := 171;
SET @note_text := 'Codex implementation and qualification update 2026-07-31: Root cause is confirmed as a class-wide repeat-application/document-lineage defect, not missing staff evidence. The DEV fix now requires Application Form and Financial Overview preservation to match an active document on the exact application being submitted in both assessment submission paths. Automatic Financial Overview preservation supports both formal version-document links and older metadata-only version links, while older-application and case-level documents can no longer suppress generation for the current application. All callers were reviewed. Qualification passed 69 frontend suites / 297 tests and 21 backend suites / 112 tests (90 suites / 409 tests total), full lint with zero errors, syntax/diff checks, and rollback-only real-DEV MySQL contracts covering valid current-application preservation, older-application isolation, case-level isolation, legacy metadata compatibility, and zero fixture residue. Remaining work is tonight''s deployed TEST end-to-end submission/PDF-storage/reopen verification, followed by the approved PROD maintenance deployment and targeted live recheck. Keep this report planned until deployment; after technical verification, resolve it immediately without a staff-confirmation hold. No PROD case, application, assessment, or document data was changed by this update.';

START TRANSACTION;

SELECT id, status, summary, page_path
  FROM admin_feedback_report
 WHERE id = @report_id
 FOR UPDATE;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT r.id, NULL, 'Codex', 'codex@openai.com', @note_text, UTC_TIMESTAMP()
  FROM admin_feedback_report r
 WHERE r.id = @report_id
   AND r.status = 'planned'
   AND r.summary = 'Assessment Required'
   AND r.page_path = '/application-case/76'
   AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_note n
          WHERE n.report_id = r.id
            AND n.note_text = @note_text
       );

SELECT ROW_COUNT() AS inserted_note_rows;

COMMIT;

SELECT id, report_type, severity, status, summary, page_path, updated_at
  FROM admin_feedback_report
 WHERE id = @report_id;

SELECT id, report_id, author_name, author_email, created_at, note_text
  FROM admin_feedback_note
 WHERE report_id = @report_id
   AND note_text = @note_text;
