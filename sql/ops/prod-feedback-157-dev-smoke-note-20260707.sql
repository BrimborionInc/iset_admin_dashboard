-- PROD feedback #157 DEV smoke validation note for 2026-07-07.
-- Scope: admin_feedback_note only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 157, NULL, @actor_name, @actor_email,
       'Codex validation update 2026-07-07: Added and passed focused DEV end-to-end smoke `npm run smoke:application-assessment:ei-correction:dev`. It created disposable DEV Cognito Regional Manager and ISET Coordinator users plus a synthetic Nunavut submitted-assessment fixture, authenticated real staff tokens via Hosted UI fallback, verified RM can correct EI before dependencies through real `/api/locks/application/:id` and `PUT /api/cases/:id`, verified the real browser dropdown remains enabled and sends the correction PUT, verified ISET Coordinator is blocked with `ei_eligibility_forbidden`, verified RM is blocked with `ei_eligibility_dependency_blocked` after an active action plan exists, and cleanup left zero synthetic DB rows/Cognito users. Report remains planned pending PROD release and live recheck.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 157
          AND status = 'planned'
          AND submitted_by_email = 'emarion@nwac.ca'
          AND summary = 'Changing EI Status after it has been set and v1 of an assessment has already been submitted'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 157
          AND note_text LIKE 'Codex validation update 2026-07-07: Added and passed focused DEV end-to-end smoke%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 157;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 157
 ORDER BY id DESC
 LIMIT 5;
