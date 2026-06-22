-- PROD feedback #144 planned status after Financial Overview repeat-signing fix.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'planned'
 WHERE id = 144
   AND status = 'in_progress'
   AND summary = 'Financial Overview Document';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 144, 'in_progress', 'planned', NULL, @actor_name, @actor_email, @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 144
          AND status = 'planned'
          AND summary = 'Financial Overview Document'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 144
          AND previous_status = 'in_progress'
          AND new_status = 'planned'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 144, NULL, @actor_name, @actor_email,
       'Codex planned fix 2026-06-22: Confirmed a real Financial Overview signing bug. If an already-signed Financial Overview signing request was submitted again, PATH could regenerate the signed PDF and overwrite the same funding overview version snapshot, leaving multiple active signed Financial Overview PDFs for one version. Fix prepared in admin and public portal signing APIs: already-signed requests now return the existing signed result with alreadySigned=true and do not rewrite the signed payload, artifact, funding overview snapshot, or document rows. DEV verification completed with real Cognito/local MySQL/MinIO/admin+portal browser flow: node scripts/financial-overview-editable-dev-smoke.js passed twice, including the new repeat-sign idempotency assertion and fixture cleanup verification. Additional verification: npm test focused regression suites passed (9 suites/39 tests plus Financial Overview helper test), npm run build completed with existing source-map/Browserslist warnings only, and related Home/Application browser smokes passed. PROD data cleanup scripts prepared for post-release use; read-only preview found 4 unreferenced active signed Financial Overview PDFs to archive after the app patch is deployed. Report moved to planned pending tonight''s PROD patch and targeted live recheck.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 144
          AND summary = 'Financial Overview Document'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 144
          AND note_text LIKE 'Codex planned fix 2026-06-22: Confirmed a real Financial Overview signing bug%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 144;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 144
 ORDER BY changed_at DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 144
 ORDER BY id DESC
 LIMIT 4;
