-- PROD feedback #117 support closure for 2026-05-25.
-- Scope: admin_feedback_* only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @closed_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status
  FROM admin_feedback_report
 WHERE id = 117
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'closed',
       updated_at = @closed_at
 WHERE id = 117
   AND status <> 'closed';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 117, @previous_status, 'closed', NULL, @actor_name, @actor_email, @closed_at
 WHERE COALESCE(@previous_status, '') <> 'closed'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 117
        AND previous_status = @previous_status
        AND new_status = 'closed'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 117, NULL, @actor_name, @actor_email,
       'Codex closure 2026-05-25: Closed as support/deliverability rather than a PATH code defect. Krista Caspick case 9/client 9 is linked to kaaylcee@gmail.com and remains invitation_sent. PATH activation emails were sent/resent to that exact address on 2026-05-15, 2026-05-19, and 2026-05-25; the latest resend recorded Cognito user status CONFIRMED before/after. Public portal audit shows Cognito accepted activation-code requests and returned deliveryMedium=EMAIL plus deliveryDestination=k***@g*** on 2026-05-15, 2026-05-19, 2026-05-21, and 2026-05-25. Some repeated attempts hit the daily reset-code limit, which can make further retries fail temporarily. No PATH-side failed send or account-link defect was found. Recovery guidance: ask the participant to wait for the daily limit to clear, use the latest activation link once, request only one new activation code, search the Gmail inbox/spam/promotions/all mail for the verification email, and confirm she is checking kaaylcee@gmail.com. If still not received, staff should verify identity and either update to a confirmed alternate email then resend activation, or escalate as an email-provider/Cognito deliverability issue.',
       @closed_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 117
      AND note_text LIKE 'Codex closure 2026-05-25: Closed as support/deliverability%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 117;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 117
 ORDER BY changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 320) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 117
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
