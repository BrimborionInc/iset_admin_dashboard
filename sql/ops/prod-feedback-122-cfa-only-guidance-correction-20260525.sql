-- PROD feedback #122 correction: CFA-only recovery guidance for Shelly Van Loon.
-- Scope: admin_feedback_note only. No client/case/application/message/signing data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 122, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex correction 2026-05-25: Bill clarified that Emilie is not asking to resend a funding revision letter; report #122 is specifically about Shelly needing the revised CFA to sign. ',
         'Recovery already applied: cancelled the bad Friday signing requests 40/41/42, put CFA v2/version 12 back to draft, and reopened the follow-up flag. ',
         'Correct staff guidance: Emilie should send Shelly a new secure message and attach the Client Funding Agreement signing form, so Shelly receives the revised CFA v2 signing request. ',
         'She should not manually attach the PDF, and she does not need to send a whole new funding-revision letter unless Bill separately wants the corrected letter packet resent. Related code fix for report #120 is live, but #120 remains open pending packet-specific closeout.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 122
      AND note_text LIKE 'Codex correction 2026-05-25: Bill clarified that Emilie is not asking to resend a funding revision letter%'
 );

COMMIT;

SELECT id, status, summary, submitted_by_email, updated_at
  FROM admin_feedback_report
 WHERE id IN (120, 122)
 ORDER BY id;

SELECT report_id, author_name, created_at, LEFT(note_text, 520) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (120, 122)
 ORDER BY created_at DESC, id DESC
 LIMIT 8;
