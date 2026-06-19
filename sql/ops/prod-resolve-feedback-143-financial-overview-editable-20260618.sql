-- Resolve PROD feedback #143 after editable Financial Overview PROD deploy.
-- Scope: admin_feedback_* tables only. No client/case/application/document/signing data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();
SET @previous_status_143 := NULL;

START TRANSACTION;

SELECT status
  INTO @previous_status_143
  FROM admin_feedback_report
 WHERE id = 143
   AND summary = 'Fillable Financial Form'
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @resolved_at
 WHERE id = 143
   AND @previous_status_143 IS NOT NULL
   AND @previous_status_143 <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 143, @previous_status_143, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE @previous_status_143 IS NOT NULL
   AND @previous_status_143 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 143
        AND previous_status = @previous_status_143
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 143, NULL, @actor_name, @actor_email,
       'Codex resolution 2026-06-18: PROD release 20260618-prod-financial-overview-editable replaces the old Financial Overview signature-only send for new requests. Staff can now send workflow 52 as either a blank editable form or a pre-filled editable form; participant submissions capture monthly income, monthly expenses, other-income/other-expense notes, and signature, then update case Participant Details, refresh the Financial Overview version snapshot, and store the official signed Financial Overview PDF. The participant form was tightened to the financial fields only and uses the intake-style amount controls with $ prefixes, per-month suffixes, and explanatory hints. Deployment evidence: PROD app/schema-only rollout used --skip-data with no runtime/config/intake data promotion, ASG refresh 7b20abe1-3b14-4b59-84d4-8c368e893940 completed on replacement instance i-0ef59338917626359, normal-routing smoke returned 200 for nwac-console.awentech.ca, iset.nwac.ca, and nwac-public.awentech.ca, fallback and service warning were cleared, service.announcement row count was 0, and SSM marker check 3e47f51c-6cee-4f75-a1c9-dbdc145605fe confirmed fundingOverviewMode, finalizeFundingOverviewSigningSubmission, FINANCIAL_OVERVIEW_SUBMISSION_KEYS, per month copy, and the release id on the live host. This fixes future Financial Overview sends; it does not rewrite Kaitlyn Kitson''s already-signed historical blank PDFs/documents from signing request 66. No client/case/application/document/signing rows were mutated by this feedback reconciliation.',
       @resolved_at
 WHERE @previous_status_143 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 143
        AND note_text LIKE 'Codex resolution 2026-06-18: PROD release 20260618-prod-financial-overview-editable replaces the old Financial Overview signature-only send%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 143;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 143
 ORDER BY id DESC
 LIMIT 5;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 600) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 143
 ORDER BY id DESC
 LIMIT 5;
