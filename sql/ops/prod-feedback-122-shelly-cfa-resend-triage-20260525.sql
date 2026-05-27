-- PROD feedback #122 triage note for Shelly Van Loon CFA resend question.
-- Scope: admin_feedback_* only. No client/case/application/message/signing data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status
  FROM admin_feedback_report
 WHERE id = 122
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 122
   AND status <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 122, @previous_status, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE COALESCE(@previous_status, '') <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 122
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 122, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex triage 2026-05-25: Rechecked Shelly Van Loon case 85 after report #122. Message 384 from 2026-05-22 did create signing request 42 for Client Funding Agreement v2/redline and signing request 41 for EFT, both still pending. ',
         'The same packet also created signing request 40 for Letter of Approval with stale original application amounts, matching report #120. The PROD code fix is now live for future sends, but this already-created packet is not corrected retroactively. ',
         'Do not advise Emilie to use a generic secure message with only the CFA as the primary recovery path: CFA v2 is already status sent, the intervention approvalLetterFollowUp is marked completed/sent against message 384, and the generic secure-message CFA picker looks for a draft CFA before creating a signing request. ',
         'Recommended recovery is a controlled resend/reset of the funding-revision packet so the client receives a corrected funding revision letter plus the revised CFA/EFT signing items together, then close reports #120/#122 after the client-facing packet is verified.'
       ),
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 122
      AND note_text LIKE 'Codex triage 2026-05-25: Rechecked Shelly Van Loon case 85 after report #122%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, submitted_by_email, submitted_at, updated_at
  FROM admin_feedback_report
 WHERE id = 122;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 122
 ORDER BY changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 122
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
