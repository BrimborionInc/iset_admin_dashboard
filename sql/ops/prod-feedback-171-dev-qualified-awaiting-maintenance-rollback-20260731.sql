-- Roll back only the exact DEV-qualification note created for feedback #171.

SET @report_id := 171;
SET @note_text := 'Codex implementation and qualification update 2026-07-31: Root cause is confirmed as a class-wide repeat-application/document-lineage defect, not missing staff evidence. The DEV fix now requires Application Form and Financial Overview preservation to match an active document on the exact application being submitted in both assessment submission paths. Automatic Financial Overview preservation supports both formal version-document links and older metadata-only version links, while older-application and case-level documents can no longer suppress generation for the current application. All callers were reviewed. Qualification passed 69 frontend suites / 297 tests and 21 backend suites / 112 tests (90 suites / 409 tests total), full lint with zero errors, syntax/diff checks, and rollback-only real-DEV MySQL contracts covering valid current-application preservation, older-application isolation, case-level isolation, legacy metadata compatibility, and zero fixture residue. Remaining work is tonight''s deployed TEST end-to-end submission/PDF-storage/reopen verification, followed by the approved PROD maintenance deployment and targeted live recheck. Keep this report planned until deployment; after technical verification, resolve it immediately without a staff-confirmation hold. No PROD case, application, assessment, or document data was changed by this update.';

START TRANSACTION;

DELETE FROM admin_feedback_note
 WHERE report_id = @report_id
   AND author_name = 'Codex'
   AND author_email = 'codex@openai.com'
   AND note_text = @note_text;

SELECT ROW_COUNT() AS deleted_note_rows;

COMMIT;
