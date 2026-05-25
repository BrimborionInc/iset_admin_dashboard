-- PROD feedback #117 evidence note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @noted_at := NOW();

SET @note_text := CONCAT(
'Codex evidence note 2026-05-25: Activation invitation and activation/reset code audit for report #117. Timestamps below are PROD database UTC time.', CHAR(10), CHAR(10),
'Activation invitations', CHAR(10),
'| Sent at (UTC) | Event | Mode | Recipient | Result |', CHAR(10),
'| --- | --- | --- | --- | --- |', CHAR(10),
'| 2026-05-15 20:30:14 | invitation_sent | send | kaaylcee@gmail.com | Activation link recorded for finalRecipient kaaylcee@gmail.com. |', CHAR(10),
'| 2026-05-19 12:55:34 | invitation_sent | resend | kaaylcee@gmail.com | Activation link recorded for finalRecipient kaaylcee@gmail.com. |', CHAR(10),
'| 2026-05-25 12:58:02 | invitation_sent | resend | kaaylcee@gmail.com | Activation link recorded; Cognito status was CONFIRMED before and after; temporary password repair was false. |', CHAR(10), CHAR(10),
'Activation/reset code requests', CHAR(10),
'| Requested at (UTC) | Route | Flow | Outcome | Delivery evidence |', CHAR(10),
'| --- | --- | --- | --- | --- |', CHAR(10),
'| 2026-05-15 20:30:53.930 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-15 20:31:44.923 | /reset-password | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-15 20:31:50.185 | /reset-password | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-15 20:58:53.932 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-15 20:59:02.186 | /reset-password | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-15 20:59:04.249 | /reset-password | activation | daily_limit_exceeded | Daily limiter blocked additional request, attemptCount 6. |', CHAR(10),
'| 2026-05-19 00:58:01.352 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-19 01:05:12.161 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-19 01:07:23.108 | /forgot-password | forgot-password | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-19 12:56:43.625 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-19 12:57:11.798 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-19 12:57:32.070 | /reset-password | activation | daily_limit_exceeded | Daily limiter blocked additional request, attemptCount 6. |', CHAR(10),
'| 2026-05-19 12:57:34.651 | /activate-account | activation | daily_limit_exceeded | Daily limiter blocked additional request, attemptCount 7. |', CHAR(10),
'| 2026-05-21 21:54:15.951 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-21 21:54:28.846 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |', CHAR(10),
'| 2026-05-25 13:07:29.385 | /activate-account | activation | submitted | Cognito returned EMAIL delivery to k***@g***. |'
);

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 117, NULL, @actor_name, @actor_email, @note_text, @noted_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 117
      AND note_text LIKE 'Codex evidence note 2026-05-25: Activation invitation and activation/reset code audit for report #117%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 117;

SELECT report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 117
 ORDER BY created_at DESC, id DESC
 LIMIT 3;
